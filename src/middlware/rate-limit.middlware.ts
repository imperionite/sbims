import type { Context, Next } from "hono";

import { AppError } from "../errors/app-error.ts";
import { RATE_LIMIT_ENABLED } from "../config/rate-limit.config.ts";

/**
 * ============================================================
 * Lightweight API Rate Limiter Middleware
 * ============================================================
 *
 * Purpose:
 * - Protect sensitive endpoints from abuse.
 * - Prevent brute-force attacks.
 * - Reduce accidental API flooding.
 *
 * Current implementation:
 * - In-memory fixed window counter.
 *
 * Suitable for:
 * - Development
 * - Staging
 * - Single-instance deployments
 *
 * Future production scaling:
 * - Replace Map storage with Redis.
 *
 * Performance Testing:
 * - Disable using:
 *
 *      RATE_LIMIT_ENABLED=false
 *
 * This allows:
 * - K6 baseline throughput testing.
 * - Database/application performance measurement.
 * - Avoiding artificial throttling during benchmarks.
 *
 * ============================================================
 */

type RateLimitConfig = {
  /**
   * Time window duration.
   *
   * Example:
   * 60_000 = 60 seconds
   */
  windowMs: number;

  /**
   * Maximum allowed requests
   * inside the window.
   */
  maxRequests: number;

  /**
   * Identifier for this limiter.
   *
   * Examples:
   * login
   * forgot-password
   */
  name: string;
};

const store = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();

/**
 * Creates reusable rate-limit middleware.
 *
 * Example limits:
 *
 * Login:
 *   5 requests / minute
 *
 * Forgot password:
 *   3 requests / minute
 *
 * Reset password:
 *   10 requests / minute
 */
export function rateLimit(config: RateLimitConfig) {
  return async function (c: Context, next: Next) {
    /**
     * Global bypass switch.
     *
     * Disabled when:
     * - running automated tests
     * - performing K6 benchmarks
     *
     * Enabled by default.
     */
    if (!RATE_LIMIT_ENABLED) {
      await next();
      return;
    }

    /**
     * Client identification.
     *
     * Current strategy:
     * - IP address
     *
     * Future improvement:
     * - IP + email combination
     *   for authentication endpoints.
     */
    const ip = c.req.header("x-forwarded-for") ?? "unknown";

    const key = `${config.name}:${ip}`;

    const now = Date.now();

    const existing = store.get(key);

    /**
     * First request
     * OR expired window.
     */
    if (!existing || now > existing.resetAt) {
      store.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
      });

      await next();
      return;
    }

    /**
     * Existing request window.
     */
    existing.count++;

    if (existing.count > config.maxRequests) {
      throw new AppError(429, "Too many requests. Please try again later.");
    }

    store.set(key, existing);

    await next();
  };
}
