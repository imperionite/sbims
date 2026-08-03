import type { Context, Next } from "hono";

import { supabaseClient } from "../../lib/supabase.ts";
import { AppError } from "../../errors/app-error.ts";

export async function requireAuth(c: Context, next: Next) {
  const authorization = c.req.header("Authorization");

  if (!authorization) {
    throw new AppError(401, "Missing authorization token.");
  }

  const token = authorization.replace("Bearer ", "");

  if (!token) {
    throw new AppError(401, "Invalid authorization header.");
  }

  const { data, error } = await supabaseClient.auth.getUser(token);

  if (error || !data.user) {
    throw new AppError(401, "Invalid authentication token.");
  }

  c.set("user", {
    id: data.user.id,
    email: data.user.email,
  });

  await next();
}
