import { supabaseClient } from "../../lib/supabase.ts";

export async function checkDatabase(): Promise<boolean> {
  const { data, error } = await supabaseClient.rpc("health_check");

  if (error) {
    return false;
  }

  return data === true;
}
