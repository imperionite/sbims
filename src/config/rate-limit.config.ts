/**
 * Global rate limiting switch.
 *
 * Production:
 *   RATE_LIMIT_ENABLED=true
 *
 * Integration tests / K6 controlled tests:
 *   RATE_LIMIT_ENABLED=false
 *
 * This allows security controls to remain
 * active in production while avoiding
 * artificial blocking during controlled testing.
 */
export const RATE_LIMIT_ENABLED = Deno.env.get("RATE_LIMIT_ENABLED") !== "false";
