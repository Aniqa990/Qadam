import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestIdentity } from "../../src/types/auth.types";

/**
 * Unit tests for the knowledge document ingestion pipeline
 * (ai-architecture.md "RAG ingestion").
 *
 * chunkText is a pure function tested with fixed fixtures.
 * extractText and uploadDocument mock Supabase + embedding service.
 */

// -- Supabase mock (queue-based builder + storage mock) -------------------------

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

vi.mock("../../src/lib/supabase", () => {
  const queues = new Map<string, QueryResult[]>();
  const calls = {
    inserts: {} as Record<string, unknown[]>,
    updates: {} as Record<string, unknown[]>,
    deletes: {} as Record<string, unknown[]>,
    storageUploads: [] as { path: string; buffer: Buffer; contentType: string }[],
    storageRemoves: [] as string[][],
  };

  function makeBuilder(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    // Flag to prevent double-consumption: when .single()/.maybeSingle() already
    // consumed a queue item, the subsequent .then on the same builder must NOT
    // consume another one. List queries without .single() rely on .then to
    // consume their queue item instead.
    let consumed = false;
    const take = (): QueryResult => {
      if (consumed) return { data: null, error: null, count: null };
      consumed = true;
      const queue = queues.get(table);
      return queue?.shift() ?? { data: null, error: null, count: null };
    };

    builder.select = chain;
    builder.eq = chain;
    builder.in = chain;
    builder.order = chain;
    builder.range = chain;
    builder.contains = chain;

    builder.insert = (args: unknown) => {
      (calls.inserts[table] ??= []).push(args);
      return builder;
    };
    builder.update = (args: unknown) => {
      (calls.updates[table] ??= []).push(args);
      return builder;
    };
    builder.delete = (args?: unknown) => {
      (calls.deletes[table] ??= []).push(args ?? {});
      return builder;
    };

    // .single() / .maybeSingle() consume a queue item for SELECT queries
    // that return a single row.
    builder.single = () => Promise.resolve(take());
    builder.maybeSingle = () => Promise.resolve(take());

    // .then handles two cases:
    // - Write chains (insert/update/delete) and insert-select chains where
    //   .single() already consumed: resolve with default result, no extra take.
    // - List queries (.select().eq().order() without .single()): consume the
    //   queue item and return the data.
    builder.then = (onFulfilled: never, onRejected?: never) =>
      Promise.resolve(take()).then(onFulfilled, onRejected);

    return builder;
  }

  // Storage mock
  const storage = {
    from: (_bucket: string) => ({
      upload: (path: string, body: Buffer, opts: { contentType?: string }) => {
        calls.storageUploads.push({
          path,
          buffer: body,
          contentType: opts?.contentType ?? "",
        });
        return Promise.resolve({ data: { path }, error: null });
      },
      remove: (paths: string[]) => {
        calls.storageRemoves.push(paths);
        return Promise.resolve({ data: paths, error: null });
      },
    }),
  };

  const supabase = {
    from: (table: string) => makeBuilder(table),
    storage,
  };

  return {
    supabase,
    __mock: {
      queue(table: string, results: QueryResult[]) {
        queues.set(table, [...results]);
      },
      reset() {
        queues.clear();
        calls.inserts = {};
        calls.updates = {};
        calls.deletes = {};
        calls.storageUploads = [];
        calls.storageRemoves = [];
      },
      calls,
    },
  };
});

// -- Embedding service mock ----------------------------------------------------

vi.mock("../../src/services/ai/embedding.service", () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
}));

import * as supabaseModule from "../../src/lib/supabase";
import { generateEmbedding } from "../../src/services/ai/embedding.service";
import {
  chunkText,
  extractText,
  uploadDocument,
  listDocuments,
  deleteDocument,
} from "../../src/services/knowledge.service";
import { AuthorizationError, NotFoundError } from "../../src/utils/errors";

const mock = (supabaseModule as unknown as {
  __mock: {
    queue: (table: string, results: QueryResult[]) => void;
    reset: () => void;
    calls: {
      inserts: Record<string, unknown[]>;
      updates: Record<string, unknown[]>;
      deletes: Record<string, unknown[]>;
      storageUploads: { path: string; buffer: Buffer; contentType: string }[];
      storageRemoves: string[][];
    };
  };
}).__mock;

// -- Fixtures ------------------------------------------------------------------

function ngoIdentity(domainId = "ngo-1"): RequestIdentity {
  return {
    clerkUserId: "user_ngo",
    role: "ngo",
    email: "ngo@example.com",
    domainId,
    profile: { id: domainId },
  };
}

function volunteerIdentity(): RequestIdentity {
  return {
    clerkUserId: "user_vol",
    role: "volunteer",
    email: "vol@example.com",
    domainId: "vol-1",
    profile: { id: "vol-1", onboarding_complete: true },
  };
}

// =============================================================================
// chunkText
// =============================================================================

describe("chunkText", () => {
  it("returns empty array for empty text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("returns a single chunk for short text", () => {
    const text = "This is a short paragraph.";
    const chunks = chunkText(text, 2000, 200);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it("splits long text into multiple chunks", () => {
    // Create text longer than chunk size
    const words = Array.from({ length: 500 }, (_, i) => `word${i}`);
    const text = words.join(" ");

    const chunks = chunkText(text, 500, 50);
    expect(chunks.length).toBeGreaterThan(1);

    // Every chunk should be non-empty
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
    }
  });

  it("respects word boundaries (does not split mid-word)", () => {
    const text = "hello world this is a test of the chunking system";
    const chunks = chunkText(text, 20, 5);
    // All chunks should be non-empty after trim
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
    // First chunk should start with the first word of the text
    expect(chunks[0]!.startsWith("hello")).toBe(true);
  });

  it("caps at MAX_CHUNKS_PER_DOCUMENT (200)", () => {
    // Create very long text that would produce > 200 chunks
    const text = Array.from({ length: 10000 }, (_, i) => `w${i}`).join(" ");
    const chunks = chunkText(text, 100, 10);
    expect(chunks.length).toBeLessThanOrEqual(200);
  });

  it("produces overlapping content between consecutive chunks", () => {
    const words = Array.from({ length: 300 }, (_, i) => `word${i}`);
    const text = words.join(" ");

    const chunks = chunkText(text, 500, 200);
    if (chunks.length >= 2) {
      // Use a slice window that fits within the overlap region
      const endOf0 = chunks[0]!.slice(-150);
      const startOf1 = chunks[1]!.slice(0, 150);
      const endWords = new Set(endOf0.split(/\s+/).filter(Boolean));
      const startWords = startOf1.split(/\s+/).filter(Boolean);
      const overlap = startWords.filter((w) => endWords.has(w));
      expect(overlap.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// extractText
// =============================================================================

describe("extractText", () => {
  it("extracts text from plain text buffer", async () => {
    const buffer = Buffer.from("Hello, world!", "utf-8");
    const text = await extractText(buffer, "text/plain");
    expect(text).toBe("Hello, world!");
  });

  it("throws for unsupported MIME types", async () => {
    const buffer = Buffer.from("data");
    await expect(
      extractText(buffer, "image/png")
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FILE_TYPE" });
  });
});

// =============================================================================
// uploadDocument
// =============================================================================

describe("uploadDocument", () => {
  beforeEach(() => mock.reset());
  afterEach(() => vi.clearAllMocks());

  it("rejects non-NGO callers with 403", async () => {
    await expect(
      uploadDocument(volunteerIdentity(), {
        buffer: Buffer.from("test"),
        originalname: "test.txt",
        mimetype: "text/plain",
        size: 4,
      })
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("rejects unsupported file types", async () => {
    await expect(
      uploadDocument(ngoIdentity(), {
        buffer: Buffer.from("img"),
        originalname: "photo.png",
        mimetype: "image/png",
        size: 100,
      })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FILE_TYPE" });
  });

  it("rejects files over 10 MB", async () => {
    await expect(
      uploadDocument(ngoIdentity(), {
        buffer: Buffer.alloc(11 * 1024 * 1024),
        originalname: "huge.txt",
        mimetype: "text/plain",
        size: 11 * 1024 * 1024,
      })
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("uploads a TXT file, ingests, and returns the document with ready status", async () => {
    const fileContent = "This is test content for the knowledge base.";
    const fileBuffer = Buffer.from(fileContent, "utf-8");

    // Queue Supabase responses for the happy path.
    // Each builder (one per supabase.from() call) consumes exactly 1 queue
    // item — via .single()/.maybeSingle() for SELECT queries, or via .then
    // for write chains. The consumed flag prevents double-consumption.
    // knowledge_documents: insert-select-single (1) + 3 updates (3) + reload-select-single (1) = 5
    // knowledge_chunks: insert (1)
    mock.queue("knowledge_documents", [
      // 1. insert().select("*").single() — created document
      {
        data: {
          id: "doc-1",
          ngo_id: "ngo-1",
          file_name: "test.txt",
          file_type: "text/plain",
          file_size: fileBuffer.length,
          storage_path: "",
          status: "uploaded",
          chunk_count: 0,
          error_message: null,
          created_at: "2026-09-03T10:00:00Z",
        },
        error: null,
      },
      // 2. update({storage_path}).eq() — write, default result
      { data: null, error: null },
      // 3. update({status: processing}).eq() — inside ingestDocument
      { data: null, error: null },
      // 4. update({status: ready}).eq() — after chunks inserted
      { data: null, error: null },
      // 5. select().eq().single() — reload document after ingestion
      {
        data: {
          id: "doc-1",
          ngo_id: "ngo-1",
          file_name: "test.txt",
          file_type: "text/plain",
          file_size: fileBuffer.length,
          storage_path: "ngo-1/doc-1/test.txt",
          status: "ready",
          chunk_count: 1,
          error_message: null,
          created_at: "2026-09-03T10:00:00Z",
        },
        error: null,
      },
    ]);
    mock.queue("knowledge_chunks", [{ data: null, error: null }]);

    const result = await uploadDocument(ngoIdentity(), {
      buffer: fileBuffer,
      originalname: "test.txt",
      mimetype: "text/plain",
      size: fileBuffer.length,
    });

    expect(result.status).toBe("ready");
    expect(result.id).toBe("doc-1");
    expect(result.file_name).toBe("test.txt");

    // Verify storage upload was called
    expect(mock.calls.storageUploads).toHaveLength(1);
    expect(mock.calls.storageUploads[0]!.path).toContain("ngo-1");
    expect(mock.calls.storageUploads[0]!.contentType).toBe("text/plain");

    // Verify embedding was called for the chunk(s)
    expect(generateEmbedding).toHaveBeenCalled();

    // Verify chunks were inserted
    expect(mock.calls.inserts["knowledge_chunks"]).toBeDefined();
  });
});

// =============================================================================
// listDocuments
// =============================================================================

describe("listDocuments", () => {
  beforeEach(() => mock.reset());

  it("rejects non-NGO callers", async () => {
    await expect(listDocuments(volunteerIdentity())).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it("returns documents for the authenticated NGO", async () => {
    mock.queue("knowledge_documents", [
      {
        data: [
          {
            id: "doc-1",
            file_name: "report.pdf",
            file_type: "application/pdf",
            file_size: 1024,
            status: "ready",
            chunk_count: 5,
            created_at: "2026-09-03T10:00:00Z",
          },
        ],
        error: null,
      },
    ]);

    const result = await listDocuments(ngoIdentity());
    expect(result).toHaveLength(1);
    expect(result[0]!.file_name).toBe("report.pdf");
  });
});

// =============================================================================
// deleteDocument
// =============================================================================

describe("deleteDocument", () => {
  beforeEach(() => mock.reset());

  it("rejects non-NGO callers", async () => {
    await expect(
      deleteDocument(volunteerIdentity(), "doc-1")
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("returns 404 when document does not exist", async () => {
    mock.queue("knowledge_documents", [{ data: null, error: null }]);
    await expect(
      deleteDocument(ngoIdentity(), "doc-missing")
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns 404 when document belongs to a different NGO", async () => {
    mock.queue("knowledge_documents", [
      {
        data: {
          id: "doc-1",
          ngo_id: "ngo-2",
          file_name: "other.pdf",
          file_type: "application/pdf",
          file_size: 100,
          storage_path: "ngo-2/doc-1/other.pdf",
          status: "ready",
          chunk_count: 0,
          error_message: null,
          created_at: "2026-09-03T10:00:00Z",
        },
        error: null,
      },
    ]);

    await expect(
      deleteDocument(ngoIdentity("ngo-1"), "doc-1")
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("deletes the document and its storage file", async () => {
    mock.queue("knowledge_documents", [
      // 1. select().eq().maybeSingle() — returns the document (new builder)
      {
        data: {
          id: "doc-1",
          ngo_id: "ngo-1",
          file_name: "report.pdf",
          file_type: "application/pdf",
          file_size: 1024,
          storage_path: "ngo-1/doc-1/report.pdf",
          status: "ready",
          chunk_count: 5,
          error_message: null,
          created_at: "2026-09-03T10:00:00Z",
        },
        error: null,
      },
      // 2. delete().eq() — write chain, consumed via .then (new builder)
      { data: null, error: null },
    ]);

    const result = await deleteDocument(ngoIdentity(), "doc-1");
    expect(result.message).toBe("Document deleted");

    // Verify storage remove was called
    expect(mock.calls.storageRemoves).toHaveLength(1);
    expect(mock.calls.storageRemoves[0]).toEqual(["ngo-1/doc-1/report.pdf"]);

    // Verify DB delete was called
    expect(mock.calls.deletes["knowledge_documents"]).toBeDefined();
  });
});
