import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIProviderError } from "../../src/utils/errors";

/**
 * Unit tests for embedding.service (ai-architecture.md "embedding.service.ts").
 *
 * generateEmbedding/generateEmbeddings mock the global `fetch` to avoid
 * real HF API calls. regenerateProjectEmbedding/regenerateVolunteerEmbedding
 * additionally mock the Supabase client with a queue-based builder.
 */

// -- AI config mock (provide a valid-looking HF token) -------------------------

vi.mock("../../src/config/ai", () => ({
  aiConfig: {
    huggingFace: {
      token: "hf_test_token_for_unit_tests",
      embeddingModel: "sentence-transformers/all-MiniLM-L6-v2",
    },
    gemini: { apiKey: "test", model: "test" },
    qwen: { apiKey: "test", model: "test" },
    bigDataCloud: { apiKey: "placeholder" },
  },
}));

// -- Supabase mock (queue-based, same pattern as registration tests) ----------

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

vi.mock("../../src/lib/supabase", () => {
  const queues = new Map<string, QueryResult[]>();
  const calls: { upserts: Record<string, unknown[]> } = { upserts: {} };

  function makeBuilder(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    const take = (): QueryResult => {
      const queue = queues.get(table);
      return queue?.shift() ?? { data: null, error: null, count: null };
    };

    builder.select = chain;
    builder.insert = chain;
    builder.update = chain;
    builder.delete = chain;
    builder.eq = chain;
    builder.in = chain;
    builder.order = chain;
    builder.range = chain;
    builder.contains = chain;
    builder.single = () => Promise.resolve(take());
    builder.maybeSingle = () => Promise.resolve(take());
    builder.then = (onFulfilled: never, onRejected?: never) =>
      Promise.resolve(take()).then(onFulfilled, onRejected);
    builder.upsert = (args: unknown) => {
      (calls.upserts[table] ??= []).push(args);
      return builder;
    };

    return builder;
  }

  const supabase = { from: (table: string) => makeBuilder(table) };

  return {
    supabase,
    __mock: {
      queue(table: string, results: QueryResult[]) {
        queues.set(table, [...results]);
      },
      reset() {
        queues.clear();
        calls.upserts = {};
      },
      calls,
    },
  };
});

import * as supabaseModule from "../../src/lib/supabase";

const mock = (supabaseModule as unknown as {
  __mock: {
    queue: (table: string, results: QueryResult[]) => void;
    reset: () => void;
    calls: { upserts: Record<string, unknown[]> };
  };
}).__mock;

// -- Fetch mock ---------------------------------------------------------------

const FIXED_VECTOR = [0.1, 0.2, 0.3, 0.4, 0.5];

function mockFetchSuccess(vector: number[] = FIXED_VECTOR) {
  const response = new Response(JSON.stringify(vector), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

function mockFetchError(status: number, body = "error") {
  const response = new Response(body, { status });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

function mockFetchNetworkError() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("fetch failed"))
  );
}

function mockFetchTimeout() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => {
      // Simulate AbortError
      const err = new DOMException("The operation was aborted", "AbortError");
      return Promise.reject(err);
    })
  );
}

function mockFetchMalformedJson() {
  const response = new Response("not-json{{{", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  // Override .json() to throw
  Object.defineProperty(response, "json", {
    value: () => Promise.reject(new SyntaxError("Unexpected token")),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

// -- Import service after mocks are set up ------------------------------------

import {
  buildProjectEmbeddingText,
  buildVolunteerEmbeddingText,
  contentHash,
  generateEmbedding,
  regenerateProjectEmbedding,
  regenerateVolunteerEmbedding,
} from "../../src/services/ai/embedding.service";

// =============================================================================
// generateEmbedding
// =============================================================================

describe("generateEmbedding", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a numeric vector from a successful HF response", async () => {
    mockFetchSuccess([0.1, 0.2, 0.3]);
    const result = await generateEmbedding("Skills: teaching.");
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it("unwraps HF's [vector] wrapper format", async () => {
    // HF sometimes returns [[0.5, 0.6]] instead of [0.5, 0.6]
    mockFetchSuccess([[0.5, 0.6]] as unknown as number[]);
    const result = await generateEmbedding("test");
    expect(result).toEqual([0.5, 0.6]);
  });

  it("throws RATE_LIMITED on 429", async () => {
    mockFetchError(429);
    await expect(generateEmbedding("test")).rejects.toThrow(AIProviderError);
    await expect(generateEmbedding("test")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      provider: "huggingface",
    });
  });

  it("throws RATE_LIMITED on 503 (model loading)", async () => {
    mockFetchError(503);
    await expect(generateEmbedding("test")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      provider: "huggingface",
    });
  });

  it("throws TIMEOUT when fetch is aborted", async () => {
    mockFetchTimeout();
    await expect(generateEmbedding("test")).rejects.toMatchObject({
      code: "TIMEOUT",
      provider: "huggingface",
    });
  });

  it("throws NETWORK_ERROR on fetch failure", async () => {
    mockFetchNetworkError();
    await expect(generateEmbedding("test")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      provider: "huggingface",
    });
  });

  it("throws MALFORMED_RESPONSE on non-2xx status", async () => {
    mockFetchError(500, "Internal Server Error");
    await expect(generateEmbedding("test")).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
      provider: "huggingface",
    });
  });

  it("throws MALFORMED_RESPONSE on unparseable JSON", async () => {
    mockFetchMalformedJson();
    await expect(generateEmbedding("test")).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
      provider: "huggingface",
    });
  });

  it("throws EMPTY_RESPONSE for empty input", async () => {
    await expect(generateEmbedding("")).rejects.toMatchObject({
      code: "EMPTY_RESPONSE",
      provider: "huggingface",
    });
    await expect(generateEmbedding("   ")).rejects.toMatchObject({
      code: "EMPTY_RESPONSE",
      provider: "huggingface",
    });
  });

  it("throws EMPTY_RESPONSE when HF returns an empty vector", async () => {
    mockFetchSuccess([]);
    await expect(generateEmbedding("test")).rejects.toMatchObject({
      code: "EMPTY_RESPONSE",
      provider: "huggingface",
    });
  });

  it("throws MALFORMED_RESPONSE when vector is non-numeric", async () => {
    mockFetchSuccess(["a", "b", "c"] as unknown as number[]);
    await expect(generateEmbedding("test")).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
      provider: "huggingface",
    });
  });

  it("sends the correct Authorization header and model URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(FIXED_VECTOR), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateEmbedding("test input");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("huggingface.co");
    expect(url).toContain("all-MiniLM-L6-v2");
    expect(options.headers.Authorization).toMatch(/^Bearer .+/);
    expect(options.headers["Content-Type"]).toBe("application/json");
  });
});

// =============================================================================
// Content hashing
// =============================================================================

describe("contentHash", () => {
  it("produces a deterministic SHA-256 hex digest", () => {
    const a = contentHash("hello world");
    const b = contentHash("hello world");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different inputs", () => {
    expect(contentHash("hello")).not.toBe(contentHash("world"));
  });
});

// =============================================================================
// Embedding text builders
// =============================================================================

describe("buildVolunteerEmbeddingText", () => {
  it("builds the canonical format: Skills. Interests. Experience.", () => {
    const text = buildVolunteerEmbeddingText({
      skills: ["teaching", "coding"],
      interests: ["education"],
      experience: "2 years tutoring",
    });
    expect(text).toBe(
      "Skills: teaching, coding. Interests: education. Experience: 2 years tutoring."
    );
  });

  it("handles null experience", () => {
    const text = buildVolunteerEmbeddingText({
      skills: ["teaching"],
      interests: ["education"],
      experience: null,
    });
    expect(text).toBe("Skills: teaching. Interests: education. Experience: .");
  });
});

describe("buildProjectEmbeddingText", () => {
  it("builds the canonical format: Title. Category. Description. Required skills. Responsibilities", () => {
    const text = buildProjectEmbeddingText({
      title: "After-School Tutoring",
      category: "education",
      description: "Help kids learn",
      required_skills: ["teaching", "mentoring"],
      responsibilities: ["Tutor students", "Prepare materials"],
    });
    expect(text).toBe(
      "Title: After-School Tutoring. Category: education. Description: Help kids learn. Required skills: teaching, mentoring. Responsibilities: Tutor students, Prepare materials"
    );
  });
});

// =============================================================================
// regenerateProjectEmbedding (mocked fetch + Supabase)
// =============================================================================

describe("regenerateProjectEmbedding", () => {
  beforeEach(() => mock.reset());

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates and stores an embedding when content is new", async () => {
    mockFetchSuccess(FIXED_VECTOR);

    mock.queue("projects", [
      {
        data: {
          title: "Test Project",
          category: "education",
          description: "A test",
          required_skills: ["teaching"],
          responsibilities: ["Teach"],
        },
        error: null,
      },
    ]);
    mock.queue("project_embeddings", [
      { data: null, error: null }, // no existing embedding
      { data: null, error: null }, // upsert success
    ]);

    await regenerateProjectEmbedding("proj-1");

    // Verify upsert was called with correct data
    expect(mock.calls.upserts["project_embeddings"]).toHaveLength(1);
    const upserted = mock.calls.upserts["project_embeddings"][0] as Record<
      string,
      unknown
    >;
    expect(upserted.project_id).toBe("proj-1");
    expect(upserted.content_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(upserted.embedding as string)).toEqual(FIXED_VECTOR);
  });

  it("skips generation when content_hash matches (unchanged content)", async () => {
    // Build the expected text and hash
    const text = buildProjectEmbeddingText({
      title: "Test Project",
      category: "education",
      description: "A test",
      required_skills: ["teaching"],
      responsibilities: ["Teach"],
    });
    const expectedHash = contentHash(text);

    mock.queue("projects", [
      {
        data: {
          title: "Test Project",
          category: "education",
          description: "A test",
          required_skills: ["teaching"],
          responsibilities: ["Teach"],
        },
        error: null,
      },
    ]);
    mock.queue("project_embeddings", [
      { data: { content_hash: expectedHash }, error: null }, // same hash → skip
    ]);

    await regenerateProjectEmbedding("proj-1");

    // No upsert should have happened
    expect(mock.calls.upserts["project_embeddings"]).toBeUndefined();
    // fetch should NOT have been called (HF API not invoked)
    expect(vi.isMockFunction(globalThis.fetch)).toBe(false);
  });

  it("logs and returns when project is not found", async () => {
    mock.queue("projects", [{ data: null, error: null }]);

    // Should not throw
    await regenerateProjectEmbedding("proj-missing");
    expect(mock.calls.upserts["project_embeddings"]).toBeUndefined();
  });

  it("propagates AIProviderError when HF fails", async () => {
    mockFetchError(429);

    mock.queue("projects", [
      {
        data: {
          title: "Test",
          category: "education",
          description: "Desc",
          required_skills: [],
          responsibilities: [],
        },
        error: null,
      },
    ]);
    mock.queue("project_embeddings", [{ data: null, error: null }]);

    await expect(regenerateProjectEmbedding("proj-1")).rejects.toThrow(
      AIProviderError
    );
  });
});

// =============================================================================
// regenerateVolunteerEmbedding (mocked fetch + Supabase)
// =============================================================================

describe("regenerateVolunteerEmbedding", () => {
  beforeEach(() => mock.reset());

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates and stores a volunteer embedding when content is new", async () => {
    mockFetchSuccess(FIXED_VECTOR);

    mock.queue("volunteers", [
      {
        data: {
          skills: ["teaching", "coding"],
          interests: ["education"],
          experience: "2 years",
        },
        error: null,
      },
    ]);
    mock.queue("volunteer_embeddings", [
      { data: null, error: null }, // no existing embedding
      { data: null, error: null }, // upsert success
    ]);

    await regenerateVolunteerEmbedding("vol-1");

    expect(mock.calls.upserts["volunteer_embeddings"]).toHaveLength(1);
    const upserted = mock.calls.upserts["volunteer_embeddings"][0] as Record<
      string,
      unknown
    >;
    expect(upserted.volunteer_id).toBe("vol-1");
    expect(upserted.content_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(upserted.embedding as string)).toEqual(FIXED_VECTOR);
  });

  it("skips generation when content_hash matches", async () => {
    const text = buildVolunteerEmbeddingText({
      skills: ["teaching"],
      interests: ["education"],
      experience: null,
    });
    const expectedHash = contentHash(text);

    mock.queue("volunteers", [
      {
        data: { skills: ["teaching"], interests: ["education"], experience: null },
        error: null,
      },
    ]);
    mock.queue("volunteer_embeddings", [
      { data: { content_hash: expectedHash }, error: null },
    ]);

    await regenerateVolunteerEmbedding("vol-1");

    expect(mock.calls.upserts["volunteer_embeddings"]).toBeUndefined();
  });

  it("propagates errors from DB upsert", async () => {
    mockFetchSuccess(FIXED_VECTOR);

    mock.queue("volunteers", [
      {
        data: { skills: ["a"], interests: ["b"], experience: null },
        error: null,
      },
    ]);
    mock.queue("volunteer_embeddings", [
      { data: null, error: null }, // no existing → proceed
      { data: null, error: { message: "upsert failed" } }, // upsert fails
    ]);

    await expect(regenerateVolunteerEmbedding("vol-1")).rejects.toThrow(
      "Failed to store volunteer embedding"
    );
  });
});
