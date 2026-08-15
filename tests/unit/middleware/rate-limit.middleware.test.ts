import { assertEquals } from "@std/assert";
import { Hono } from "hono";

import { rateLimit } from "../../../src/middleware/rate-limit.middleware.ts";

import type {
  RateLimitResult,
  RateLimitStore,
  RateLimitStoreConfig,
} from "../../../src/infrastructure/rate-limit/rate-limit.types.ts";

function createStore(result: RateLimitResult): RateLimitStore {
  return {
    limit(
      _key: string,
      _config: RateLimitStoreConfig,
    ): Promise<RateLimitResult> {
      return Promise.resolve(result);
    },
  };
}

Deno.test("rateLimit allows request and sets headers", async () => {
  const store = createStore({
    allowed: true,
    limit: 5,
    remaining: 4,
    resetAt: Date.now() + 60_000,
  });

  const app = new Hono();

  let handlerCalled = false;

  app.get(
    "/",
    rateLimit(
      {
        windowMs: 60_000,
        maxRequests: 5,
      },
      store,
      "test",
    ),
    (c) => {
      handlerCalled = true;

      return c.json({
        success: true,
      });
    },
  );

  const response = await app.request("/");

  assertEquals(response.status, 200);
  assertEquals(handlerCalled, true);

  assertEquals(response.headers.get("RateLimit-Limit"), "5");

  assertEquals(response.headers.get("RateLimit-Remaining"), "4");

  assertEquals(response.headers.has("RateLimit-Reset"), true);
});

Deno.test("rateLimit rejects request with 429", async () => {
  const store = createStore({
    allowed: false,
    limit: 5,
    remaining: 0,
    resetAt: Date.now() + 30_000,
  });

  const app = new Hono();

  let handlerCalled = false;

  app.onError((error, c) => {
    return c.json(
      {
        message: error.message,
      },
      429,
    );
  });

  app.get(
    "/",
    rateLimit(
      {
        windowMs: 60_000,
        maxRequests: 5,
      },
      store,
      "test",
    ),
    (c) => {
      handlerCalled = true;

      return c.json({
        success: true,
      });
    },
  );

  const response = await app.request("/");

  assertEquals(response.status, 429);
  assertEquals(handlerCalled, false);

  assertEquals(response.headers.get("RateLimit-Limit"), "5");

  assertEquals(response.headers.get("RateLimit-Remaining"), "0");

  assertEquals(response.headers.has("RateLimit-Reset"), true);

  assertEquals(response.headers.has("Retry-After"), true);
});

Deno.test("rateLimit uses the configured limiter name in the key", async () => {
  let capturedKey = "";

  const store: RateLimitStore = {
    limit(
      key: string,
      _config: RateLimitStoreConfig,
    ): Promise<RateLimitResult> {
      capturedKey = key;

      return Promise.resolve({
        allowed: true,
        limit: 5,
        remaining: 4,
        resetAt: Date.now() + 60_000,
      });
    },
  };

  const app = new Hono();

  app.get(
    "/",
    rateLimit(
      {
        windowMs: 60_000,
        maxRequests: 5,
      },
      store,
      "auth:login",
    ),
    (c) => c.json({ success: true }),
  );

  await app.request("/", {
    headers: {
      "x-forwarded-for": "203.0.113.10",
    },
  });

  assertEquals(capturedKey, "auth:login:203.0.113.10");
});
