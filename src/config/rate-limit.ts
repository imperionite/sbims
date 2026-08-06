export const rateLimitConfig = {
  /**
   * Login protection
   *
   * Goal:
   * Prevent password guessing attacks.
   *
   * Normal user:
   * - Few attempts per minute.
   *
   * Load testing:
   * Disable globally.
   * 5 attempts per minute per IP
   */
  login: {
    name: "login",
    windowMs: 60_000,
    maxRequests: 5,
  },

  /**
   * Forgot password
   *
   * Protects:
   * - Email abuse
   * - Reset email flooding
   * - Enumeration attempts
   * 3 attempts per minute per IP
   */
  forgotPassword: {
    name: "forgot-password",
    windowMs: 60_000,
    maxRequests: 3,
  },

  /**
   * Reset password
   *
   * Requires valid token,
   * therefore slightly relaxed.
   * 10 attempts per minute per IP
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
   * Logout is low risk.
   */
  logout: {
    name: "logout",
    windowMs: 60_000,
    maxRequests: 30,
  },
};
