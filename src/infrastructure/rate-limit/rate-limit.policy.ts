export type RateLimitPolicy = {
  /**
   * Unique identifier for this rate-limit policy.
   *
   * Examples:
   * - auth-login
   * - auth-forgot-password
   * - auth-change-password
   */
  name: string;

  /**
   * Maximum number of requests permitted
   * during the configured window.
   */
  maxRequests: number;

  /**
   * Duration of the rate-limit window in milliseconds.
   */
  windowMs: number;
};
