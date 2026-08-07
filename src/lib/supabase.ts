import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../config/env.ts";

const env = loadEnv();

/**
 * Public Supabase client
 *
 * Used for:
 * - sign in
 * - sign up
 * - public authentication operations
 *
 * Does not persist sessions.
 * Does not bypass RLS.
 */
export const supabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

/**
 * Creates a Supabase client authenticated
 * using the user's access token.
 *
 * Used for operations that require the
 * authenticated user's session context.
 *
 * Examples:
 * - change password
 * - update own profile
 * - user-scoped operations
 */
export function createAuthenticatedClient(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },

    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Admin Supabase client
 *
 * Used only for privileged backend operations.
 *
 * Examples:
 * - profile management
 * - administrative workflows
 * - service-role operations
 *
 * Never expose this client to frontend applications.
 */
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

/**
 * Creates a fresh public Supabase client.
 *
 * Used for authentication flows that need to
 * establish a session explicitly.
 *
 * Examples:
 * - password recovery
 * - email verification
 *
 * Does not persist sessions.
 */
export function createPublicClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
