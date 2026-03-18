import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/library");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black p-4">
      <section className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-white">Sign in</h1>
        <p className="mb-6 text-sm text-zinc-300">
          Access the shared music library.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
