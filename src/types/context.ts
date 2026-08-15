import type { SupabaseClients } from "../lib/supabase.ts";
import type { AuthRole } from "../modules/auth/auth.types.ts";

export type AppVariables = {
  supabase: SupabaseClients;

  user: {
    id: string;
    email?: string;
  };

  userRole: AuthRole;
};
