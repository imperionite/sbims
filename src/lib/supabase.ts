import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "../config/env.ts";

const env = loadEnv();

/**
 * Public Supabase client.
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
 * Admin Supabase client.
 *
 * Used only for privileged backend operations.
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
 * Used for authentication flows that need
 * a separate client instance.
 */
export function createPublicClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
