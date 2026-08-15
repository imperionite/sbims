export const rateLimitConfig = {
  /**
   * Login protection.
   *
   * Prevents password guessing attacks.
   */
  login: {
    name: "login",
    windowMs: 60_000,
    maxRequests: 7,
  },

  /**
   * Forgot-password protection.
   *
   * Helps prevent:
   * - email abuse
   * - reset-email flooding
   * - enumeration attempts
   */
  forgotPassword: {
    name: "forgot-password",
    windowMs: 60_000,
    maxRequests: 3,
  },

  /**
   * Password reset completion.
   *
   * Requires a valid reset token, so this
   * can be slightly more relaxed.
   */
  completePasswordReset: {
    name: "reset-password-complete",
    windowMs: 60_000,
    maxRequests: 10,
  },

  /**
   * Authenticated password change.
   */
  changePassword: {
    name: "change-password",
    windowMs: 60_000,
    maxRequests: 10,
  },

  /**
   * Refresh token.
   */
  refresh: {
    name: "refresh",
    windowMs: 60_000,
    maxRequests: 20,
  },

  /**
   * Logout.
   */
  logout: {
    name: "logout",
    windowMs: 60_000,
    maxRequests: 30,
  },
} as const;
