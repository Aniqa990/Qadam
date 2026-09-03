export type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

export interface SupabaseMockAccess {
  calls: { inserts: Record<string, unknown[]>; updates: Record<string, unknown[]> };
  queue(table: string, results: QueryResult[]): void;
  reset(): void;
}

export interface SupabaseMockModule {
  supabase: { from: (table: string) => Record<string, unknown> };
  __mock: SupabaseMockAccess;
}

/**
 * Factory behind vi.mock("../../src/lib/supabase", ...) in the unit tests.
 * Returns a module-shaped mock whose builders record inserts/updates and
 * resolve every terminal call (.single/.maybeSingle/direct await) from a
 * per-table queue, in call order. Use it from the mock factory as:
 *
 *   vi.mock("../../src/lib/supabase", async () => {
 *     const { createSupabaseMock } = await import("./helpers/supabase-mock");
 *     return createSupabaseMock();
 *   });
 *
 * then access the control surface via the mocked module's `__mock` export.
 */
export function createSupabaseMock(): SupabaseMockModule {
  const queues = new Map<string, QueryResult[]>();
  const calls: SupabaseMockAccess["calls"] = { inserts: {}, updates: {} };

  function makeBuilder(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    const take = (): QueryResult => {
      const queue = queues.get(table);
      const next = queue?.shift();
      return next ?? { data: null, error: null, count: null };
    };

    builder.select = chain;
    builder.insert = (args: unknown) => {
      (calls.inserts[table] ??= []).push(args);
      return builder;
    };
    builder.update = (args: unknown) => {
      (calls.updates[table] ??= []).push(args);
      return builder;
    };
    builder.delete = chain;
    builder.eq = chain;
    builder.in = chain;
    builder.order = chain;
    builder.range = chain;
    builder.single = () => Promise.resolve(take());
    builder.maybeSingle = () => Promise.resolve(take());
    // supabase-js builders are thenable (awaited directly for head:true counts)
    builder.then = (onFulfilled: never, onRejected?: never) =>
      Promise.resolve(take()).then(onFulfilled, onRejected);

    return builder;
  }

  return {
    supabase: { from: (table: string) => makeBuilder(table) },
    __mock: {
      calls,
      queue(table: string, results: QueryResult[]) {
        queues.set(table, [...results]);
      },
      reset() {
        queues.clear();
        calls.inserts = {};
        calls.updates = {};
      },
    },
  };
}
