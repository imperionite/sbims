import type { Context } from "hono";

export function getClientIp(c: Context): string {
  const forwardedFor = c.req.header("x-forwarded-for");

  if (forwardedFor) {
    const firstAddress = forwardedFor.split(",")[0].trim();

    if (firstAddress) {
      return firstAddress;
    }
  }

  return "unknown";
}
