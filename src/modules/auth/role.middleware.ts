import type { Context, Next } from "hono";

import { AppError } from "../../errors/app-error.ts";

import type { AppVariables } from "../../types/context.ts";
import type { AuthRole } from "./auth.types.ts";

import { getUserRole } from "./profile.service.ts";

type RoleContext = Context<{
  Variables: AppVariables & {
    user: {
      id: string;
      email?: string;
    };
    userRole?: AuthRole;
  };
}>;

/**
 * Requires the authenticated user to have one of the specified roles.
 *
 * Authentication is performed by `requireAuth`.
 * This middleware uses the authenticated user stored in
 * the request context instead of reading authentication state
 * from the shared Supabase client.
 *
 * This is important because the Supabase client is shared
 * by the application and its authentication state must not
 * determine authorization for an individual request.
 */
export function requireRole(...allowedRoles: AuthRole[]) {
  return async (c: RoleContext, next: Next) => {
    const user = c.get("user");

    if (!user) {
      throw new AppError(401, "Authentication required.");
    }

    const supabase = c.get("supabase");

    const role = await getUserRole(supabase, user.id);

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
