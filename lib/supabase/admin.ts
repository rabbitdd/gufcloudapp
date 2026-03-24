import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";

export function createServerAdminSupabaseClient() {
  const { supabaseUrl } = getSupabaseEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
