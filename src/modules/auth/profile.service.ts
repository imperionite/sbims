import type { SupabaseClients } from "../../lib/supabase.ts";

import type { AuthRole } from "./auth.types.ts";

export async function getUserRole(
  supabase: SupabaseClients,
  userId: string,
): Promise<AuthRole | null> {
  const { data, error } = await supabase.supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.role as AuthRole;
}
