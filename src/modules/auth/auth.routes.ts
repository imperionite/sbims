import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  changePasswordSchema,
  completePasswordResetSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
} from "./auth.schema.ts";

import { authService } from "./auth.service.ts";

import { requireAuth } from "./auth.middleware.ts";
import { createAuthenticatedClient, supabaseAdmin } from "../../lib/supabase.ts";
import { logger } from "../../shared/logger.ts";
import { AppError } from "../../errors/app-error.ts";

import { rateLimit } from "../../middlware/rate-limit.middlware.ts";
import { rateLimitConfig } from "../../config/rate-limit.ts";
import { requireRole } from "./role.middleware.ts";
import { AuthRole } from "./auth.types.ts";

const auth = new Hono<{
  Variables: {
    user: {
      id: string;
      email?: string;
    };

    userRole: AuthRole;
  };
}>();

auth.post(
  "/login",
  rateLimit(rateLimitConfig.login),
  zValidator("json", loginSchema),
  async (c) => {
    const body = c.req.valid("json");

    const result = await authService.login(body);

    return c.json({
      success: true,
      data: result,
    });
  },
);

auth.post(
  "/forgot-password",
  rateLimit(rateLimitConfig.forgotPassword),
  zValidator("json", forgotPasswordSchema),
  async (c) => {
    const body = c.req.valid("json");

    const result = await authService.forgotPassword(body);

    return c.json({
      success: true,
      message: result.message,
      data: null,
    });
  },
);

auth.post(
  "/reset-password/complete",
  rateLimit(rateLimitConfig.completePasswordReset),
  zValidator("json", completePasswordResetSchema),
  async (c) => {
    const body = c.req.valid("json");

    const result = await authService.completePasswordReset(body);

    return c.json({
      success: true,
      message: result.message,
      data: {
        user: result.user,
      },
    });
  },
);

auth.post(
  "/change-password",
  requireAuth,
  rateLimit(rateLimitConfig.changePassword),
  zValidator("json", changePasswordSchema),
  async (c) => {
    const body = c.req.valid("json");

    const user = c.get("user");

    const result = await authService.changePassword(user.id, body);

    return c.json({
      success: true,
      data: result,
    });
  },
);

auth.get("/me", requireAuth, async (c) => {
  const user = c.get("user");

  const result = await authService.getCurrentUser(user.id);

  return c.json({
    success: true,
    data: result,
  });
});

// Logout revokes the refresh token session on Supabase.
// The current access token remains valid until it expires (typically 1 hour)
auth.post("/logout", requireAuth, async (c) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.split(" ")[1];

  if (token) {
    // Create a client scoped to the user's access token
    const authenticatedClient = createAuthenticatedClient(token);

    const { error } = await authenticatedClient.auth.signOut();

    if (error) {
      logger.warn("Error during Supabase sign out", { error });
    }
  }

  return c.json({
    success: true,
    data: {
      message: "Logged out successfully.",
    },
  });
});

auth.post(
  "/refresh",
  rateLimit(rateLimitConfig.refresh),
  zValidator("json", refreshTokenSchema),
  async (c) => {
    const body = c.req.valid("json");

    const result = await authService.refresh(body);

    return c.json({
      success: true,
      data: result,
    });
  },
);

auth.get("/role", requireAuth, async (c) => {
  const user = c.get("user");

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    throw new AppError(404, "Profile not found.");
  }

  return c.json({
    success: true,
    data: {
      role: data.role,
    },
  });
});

auth.get(
  "/admin-check",
  requireAuth,
  requireRole("administrator"),
  (c) => {
    return c.json({
      success: true,
      message: "Administrator access granted.",
    });
  },
);

export default auth;
