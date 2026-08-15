import type { RateLimitResult, RateLimitStore, RateLimitStoreConfig } from "./rate-limit.types.ts";

export class NoopRateLimitStore implements RateLimitStore {
  limit(_key: string, config: RateLimitStoreConfig): Promise<RateLimitResult> {
    return Promise.resolve({
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetAt: Date.now() + config.windowMs,
    });
  }
}
