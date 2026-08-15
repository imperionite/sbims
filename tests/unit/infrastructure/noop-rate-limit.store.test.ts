import { assertEquals } from "@std/assert";

import { NoopRateLimitStore } from "../../../src/infrastructure/rate-limit/noop-rate-limit.store.ts";

Deno.test("NoopRateLimitStore always allows requests", async () => {
  const store = new NoopRateLimitStore();

  const result = await store.limit("test-key", {
    windowMs: 60_000,
    maxRequests: 5,
  });

  assertEquals(result.allowed, true);
  assertEquals(result.limit, 5);
  assertEquals(result.remaining, 5);
  assertEquals(result.resetAt > Date.now(), true);
});
