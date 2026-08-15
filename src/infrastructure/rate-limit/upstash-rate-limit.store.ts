import { Redis } from "@upstash/redis";

import type { RateLimitResult, RateLimitStore, RateLimitStoreConfig } from "./rate-limit.types.ts";

export type UpstashRateLimitStoreConfig = {
  url: string;
  token: string;
};

export class UpstashRateLimitStore implements RateLimitStore {
  private readonly redis: Redis;

  constructor(config: UpstashRateLimitStoreConfig) {
    this.redis = new Redis({
      url: config.url,
      token: config.token,
    });
  }

  async limit(
    key: string,
    config: RateLimitStoreConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();

    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;

    const resetAt = windowStart + config.windowMs;

    const windowId = Math.floor(windowStart / config.windowMs);

    const redisKey = `ratelimit:${key}:${windowId}`;

    const ttlSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    const transaction = this.redis.multi();

    transaction.incr(redisKey);
    transaction.expire(redisKey, ttlSeconds);

    const [count] = await transaction.exec<[number, number]>();

    const currentCount = Number(count);

    return {
      allowed: currentCount <= config.maxRequests,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - currentCount),
      resetAt,
    };
  }
}
