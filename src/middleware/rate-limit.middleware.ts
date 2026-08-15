import type { Context, Next } from "hono";

import { AppError } from "../errors/app-error.ts";

import type {
  RateLimitStore,
  RateLimitStoreConfig,
} from "../infrastructure/rate-limit/rate-limit.types.ts";

export function rateLimit(
  config: RateLimitStoreConfig,
  store: RateLimitStore,
  name: string,
) {
  return async function rateLimitMiddleware(
    c: Context,
    next: Next,
  ): Promise<void> {
    const identifier = getClientIdentifier(c);
    const key = `${name}:${identifier}`;

    const result = await store.limit(key, config);

    c.header("RateLimit-Limit", String(result.limit));
    c.header("RateLimit-Remaining", String(result.remaining));
    c.header("RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((result.resetAt - Date.now()) / 1000),
      );

      c.header("Retry-After", String(retryAfterSeconds));

      throw new AppError(429, "Too many requests. Please try again later.");
    }

    await next();
  };
}

function getClientIdentifier(c: Context): string {
  const forwardedFor = c.req.header("x-forwarded-for");

  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
