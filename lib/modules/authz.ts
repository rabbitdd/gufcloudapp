import { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "viewer" | "uploader" | "admin";

export type AuthContext = {
  userId: string;
  email: string | null;
  role: UserRole;
};

const MANAGE_ROLES: UserRole[] = ["uploader", "admin"];

export async function getAuthContext(
  supabase: SupabaseClient
): Promise<AuthContext | null> {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (profile?.role ?? "uploader") as UserRole;

  return {
    userId: user.id,
    email: user.email ?? null,
    role
  };
}

export function canManageContent(role: UserRole) {
  return MANAGE_ROLES.includes(role);
}
