"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type AuthMode = "sign_in" | "sign_up";

export function LoginForm() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === "sign_in") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.push("/library");
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, session is available immediately.
    if (data.session) {
      router.push("/library");
      router.refresh();
      return;
    }

    setMessage(
      "Account created. Check your email to confirm, then sign in."
    );
    setMode("sign_in");
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800 bg-black p-1">
        <button
          type="button"
          onClick={() => {
            setMode("sign_in");
            setError(null);
            setMessage(null);
          }}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            mode === "sign_in"
              ? "bg-zinc-100 text-black"
              : "text-zinc-300 hover:bg-zinc-900"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("sign_up");
            setError(null);
            setMessage(null);
          }}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            mode === "sign_up"
              ? "bg-zinc-100 text-black"
              : "text-zinc-300 hover:bg-zinc-900"
          }`}
        >
          Sign up
        </button>
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-100 shadow-sm outline-none ring-zinc-500 focus:ring-2"
          placeholder="user@example.com"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="password"
          className="text-sm font-medium text-zinc-300"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-100 shadow-sm outline-none ring-zinc-500 focus:ring-2"
          placeholder="********"
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:bg-zinc-500"
      >
        {loading
          ? mode === "sign_in"
            ? "Signing in..."
            : "Creating account..."
          : mode === "sign_in"
            ? "Sign in"
            : "Create account"}
      </button>
    </form>
  );
}
