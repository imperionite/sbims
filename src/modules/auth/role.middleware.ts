import type { Context, Next } from "hono";

import { AppError } from "../../errors/app-error.ts";

import type { AuthRole } from "./auth.types.ts";

import { getUserRole } from "./profile.service.ts";

export function requireRole(...allowedRoles: AuthRole[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user");

    if (!user) {
      throw new AppError(401, "Authentication required.");
    }

    const role = await getUserRole(user.id);

    if (!role) {
      throw new AppError(404, "User profile not found.");
    }

    if (!allowedRoles.includes(role as AuthRole)) {
      throw new AppError(403, "Insufficient permissions.");
    }

    c.set("userRole", role as AuthRole);

    await next();
  };
}
