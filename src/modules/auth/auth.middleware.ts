import type { Context, Next } from "hono";

import { supabaseAdmin, supabaseClient } from "../../lib/supabase.ts";

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

  // Check the current profile status on every authenticated request.
  // This prevents users who were deactivated after login from
  // continuing to access protected routes with an existing token.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    throw new AppError(500, "Unable to verify account status.");
  }

  if (!profile) {
    throw new AppError(401, "User profile not found.");
  }

  if (!profile.is_active) {
    throw new AppError(403, "Account disabled.");
  }

  c.set("user", {
    id: data.user.id,
    email: data.user.email,
  });

  await next();
}
