import { supabaseAdmin } from "../../lib/supabase.ts";

export async function getUserRole(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.role;
}
