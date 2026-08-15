import type { SupabaseClients } from "../../lib/supabase.ts";

export async function checkDatabase(
  clients: SupabaseClients,
): Promise<boolean> {
  const { data, error } = await clients.supabaseClient.rpc("health_check");

  if (error) {
    return false;
  }

  return data === true;
}
