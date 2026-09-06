import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestIdentity } from "../../src/types/auth.types";

/**
 * Unit tests for ngo.service.uploadLogo - authorization, file validation,
 * and the upload → public URL → ngos.logo_url write path. Uses the
 * queue-based Supabase mock pattern from project.service.test.ts, extended
 * with a storage stub (bucket upload / public URL / removal).
 */

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

interface StorageUpload {
  bucket: string;
  path: string;
  contentType: string;
}

vi.mock("../../src/lib/supabase", () => {
  const queues = new Map<string, QueryResult[]>();
  const uploads: StorageUpload[] = [];
  const removed: { bucket: string; paths: string[] }[] = [];

  function makeBuilder(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    const take = (): QueryResult => {
      const queue = queues.get(table);
      const next = queue?.shift();
      return next ?? { data: null, error: null, count: null };
    };

    builder.select = chain;
    builder.insert = chain;
    builder.update = chain;
    builder.delete = chain;
    builder.eq = chain;
    builder.in = chain;
    builder.order = chain;
    builder.range = chain;
    builder.ilike = chain;
    builder.contains = chain;
    builder.or = chain;
    builder.gte = chain;
    builder.lte = chain;
    builder.not = chain;
    builder.single = () => Promise.resolve(take());
    builder.maybeSingle = () => Promise.resolve(take());
    builder.then = (onFulfilled: never, onRejected?: never) =>
      Promise.resolve(take()).then(onFulfilled, onRejected);

    return builder;
  }

  const supabase = {
    from: (table: string) => makeBuilder(table),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _body: Buffer, options: { contentType?: string }) => {
          uploads.push({ bucket, path, contentType: options.contentType ?? "" });
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.example.com/object/public/${bucket}/${path}` },
        }),
        remove: async (paths: string[]) => {
          removed.push({ bucket, paths });
          return { data: null, error: null };
        },
      }),
    },
  };

  return {
    supabase,
    __mock: {
      queue(table: string, results: QueryResult[]) {
        queues.set(table, [...results]);
      },
      reset() {
        queues.clear();
        uploads.length = 0;
        removed.length = 0;
      },
      uploads,
      removed,
    },
  };
});

import * as supabaseModule from "../../src/lib/supabase";
import { uploadLogo } from "../../src/services/ngo.service";

const mock = (supabaseModule as unknown as {
  __mock: {
    queue: (table: string, results: QueryResult[]) => void;
    reset: () => void;
    uploads: StorageUpload[];
    removed: { bucket: string; paths: string[] }[];
  };
}).__mock;

// -- Fixtures ------------------------------------------------------------------

function ngoIdentity(): RequestIdentity {
  return {
    clerkUserId: "user_ngo",
    role: "ngo",
    email: "ngo@example.com",
    domainId: "ngo-1",
    profile: { id: "ngo-1" },
  };
}

function volunteerIdentity(): RequestIdentity {
  return {
    clerkUserId: "user_vol",
    role: "volunteer",
    email: "vol@example.com",
    domainId: "vol-1",
    profile: { id: "vol-1" },
  };
}

function ngoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ngo-1",
    auth_user_id: "user_ngo",
    name: "HopeReach",
    email: "ngo@example.com",
    description: "We help",
    logo_url: null,
    mission: null,
    website: null,
    phone: null,
    categories: [],
    registration_number: null,
    onboarding_complete: true,
    created_at: "2026-09-01",
    updated_at: "2026-09-01",
    ...overrides,
  };
}

const PNG_FILE = { buffer: Buffer.from("fake-png-bytes"), mimetype: "image/png", size: 1024 };

// =============================================================================

describe("uploadLogo", () => {
  beforeEach(() => mock.reset());

  it("rejects non-NGO callers (403)", async () => {
    await expect(uploadLogo(volunteerIdentity(), PNG_FILE)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("rejects unsupported image types (400)", async () => {
    mock.queue("ngos", [{ data: ngoRow(), error: null }]);

    await expect(
      uploadLogo(ngoIdentity(), { ...PNG_FILE, mimetype: "image/gif" })
    ).rejects.toMatchObject({ statusCode: 400, code: "UNSUPPORTED_FILE_TYPE" });
  });

  it("rejects files over the 2 MB limit (400)", async () => {
    mock.queue("ngos", [{ data: ngoRow(), error: null }]);

    await expect(
      uploadLogo(ngoIdentity(), { ...PNG_FILE, size: 2 * 1024 * 1024 + 1 })
    ).rejects.toMatchObject({ statusCode: 400, code: "FILE_TOO_LARGE" });
  });

  it("uploads to the public bucket and stores the public URL", async () => {
    mock.queue("ngos", [
      { data: ngoRow({ logo_url: null }), error: null },
      { data: null, error: null },
    ]);

    const result = await uploadLogo(ngoIdentity(), PNG_FILE);

    expect(result.logo_url).toMatch(
      /^https:\/\/cdn\.example\.com\/object\/public\/ngo-logos\/ngo-1\/logo-\d+\.png$/
    );
    expect(mock.uploads).toHaveLength(1);
    expect(mock.uploads[0].bucket).toBe("ngo-logos");
    expect(mock.uploads[0].contentType).toBe("image/png");
    expect(mock.removed).toHaveLength(0); // no previous logo to clean up
  });

  it("removes the replaced bucket object", async () => {
    const oldBucketUrl = "https://cdn.example.com/object/public/ngo-logos/ngo-1/logo-1000.png";
    mock.queue("ngos", [
      { data: ngoRow({ logo_url: oldBucketUrl }), error: null },
      { data: null, error: null },
    ]);

    await uploadLogo(ngoIdentity(), PNG_FILE);

    expect(mock.removed).toHaveLength(1);
    expect(mock.removed[0]).toMatchObject({
      bucket: "ngo-logos",
      paths: ["ngo-1/logo-1000.png"],
    });
  });

  it("keeps an external logo URL object untouched", async () => {
    mock.queue("ngos", [
      { data: ngoRow({ logo_url: "https://images.example.org/brand.png" }), error: null },
      { data: null, error: null },
    ]);

    await uploadLogo(ngoIdentity(), PNG_FILE);

    expect(mock.removed).toHaveLength(0);
  });
});
