import { createClient } from "@supabase/supabase-js";

import type { AppConfig } from "../config/env.ts";

export function createSupabaseClients(env: AppConfig) {
  const supabaseClient = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const supabaseAdmin = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  function createAuthenticatedClient(accessToken: string) {
    return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
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

  function createPublicClient() {
    return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return {
    supabaseClient,
    supabaseAdmin,
    createAuthenticatedClient,
    createPublicClient,
  };
}

export type SupabaseClients = ReturnType<typeof createSupabaseClients>;
