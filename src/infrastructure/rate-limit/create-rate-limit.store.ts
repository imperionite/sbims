import type { AppConfig } from "../../config/env.ts";

import type { RateLimitStore } from "./rate-limit.types.ts";

import { NoopRateLimitStore } from "./noop-rate-limit.store.ts";
import { UpstashRateLimitStore } from "./upstash-rate-limit.store.ts";

export function createRateLimitStore(env: AppConfig): RateLimitStore {
  if (!env.RATE_LIMIT_ENABLED) {
    return new NoopRateLimitStore();
  }

  return new UpstashRateLimitStore({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}
