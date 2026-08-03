import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { changePasswordSchema, loginSchema } from "./auth.schema.ts";

import { authService } from "./auth.service.ts";

import { requireAuth } from "./auth.middleware.ts";
import { createAuthenticatedClient } from "../../lib/supabase.ts";
import { logger } from "../../shared/logger.ts";

const auth = new Hono<{
  Variables: {
    user: {
      id: string;
      email?: string;
    };
  };
}>();

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");

  const result = await authService.login(body);

  return c.json({
    success: true,
    data: result,
  });
});

auth.post(
  "/change-password",
  requireAuth,

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

// It does not invalidate the access token on the client side bu revokes refresh token associated with the access token on the server side that expires typicall in one 1 hour
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

export default auth;
