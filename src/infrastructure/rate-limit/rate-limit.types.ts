/**
 * Configuration used by a rate-limit store.
 */
export type RateLimitStoreConfig = {
  /**
   * Duration of the rate-limit window in milliseconds.
   */
  windowMs: number;

  /**
   * Maximum number of requests allowed
   * within the window.
   */
  maxRequests: number;
};

/**
 * Result returned by a rate-limit store.
 */
export type RateLimitResult = {
  /**
   * Whether the request is allowed to continue.
   */
  allowed: boolean;

  /**
   * Maximum number of requests permitted
   * during the configured window.
   */
  limit: number;

  /**
   * Number of requests remaining.
   */
  remaining: number;

  /**
   * Unix timestamp in milliseconds when
   * the current window resets.
   */
  resetAt: number;
};

/**
 * Provider-agnostic rate-limit storage contract.
 *
 * Implementations may use:
 * - Upstash Redis
 * - in-memory storage
 * - another distributed store
 * - a platform-native implementation
 *
 * The application and middleware do not depend
 * on the underlying storage provider.
 */
export interface RateLimitStore {
  limit(key: string, config: RateLimitStoreConfig): Promise<RateLimitResult>;
}
