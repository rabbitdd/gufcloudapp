export function getSupabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!rawUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  if (/^postgres(ql)?:\/\//i.test(rawUrl)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be the Supabase API URL (e.g. http://127.0.0.1:54321 or https://….supabase.co), not a postgresql:// database connection string. Use output from `npm run env:local`."
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is not a valid URL: "${rawUrl.slice(0, 48)}…"`
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must use http:// or https:// (Supabase API URL)."
    );
  }

  return { supabaseUrl: rawUrl, supabaseAnonKey };
}
