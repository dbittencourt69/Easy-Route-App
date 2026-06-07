"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingMagicLink, setLoadingMagicLink] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.access_token) {
        window.location.href = "/techs";
      }
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
        session?.access_token
      ) {
        window.location.href = "/techs";
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handlePasswordLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loadingPassword || loadingMagicLink) return;

    setLoadingPassword(true);
    setMessage("");
    setErrorMsg("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setErrorMsg("Email and password are required.");
      setLoadingPassword(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoadingPassword(false);
      return;
    }

    if (!data.session?.access_token) {
      setErrorMsg("Login succeeded, but no active session was created.");
      setLoadingPassword(false);
      return;
    }

    setMessage(`Login successful for ${data.user?.email}. Redirecting...`);

    setTimeout(() => {
      window.location.href = "/techs";
    }, 300);

    setLoadingPassword(false);
  }

  async function handleMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loadingPassword || loadingMagicLink) return;

    setLoadingMagicLink(true);
    setMessage("");
    setErrorMsg("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMsg("Email is required.");
      setLoadingMagicLink(false);
      return;
    }

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/techs`
        : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setErrorMsg(error.message);
      setLoadingMagicLink(false);
      return;
    }

    setMessage(`Magic link sent to ${cleanEmail}. Check your email.`);
    setLoadingMagicLink(false);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
      <div className="w-full rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Admin Login</h1>
          <p className="mt-1 text-sm text-gray-600">
            Sign in with your admin email and password, or request a magic link.
          </p>
        </div>

        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@email.com"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
            />
          </div>

          {message ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {message}
            </div>
          ) : null}

          {errorMsg ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {errorMsg}
            </div>
          ) : null}

          <div className="space-y-2">
            <button
              type="submit"
              disabled={loadingPassword || loadingMagicLink}
              className="inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPassword ? "Signing in..." : "Sign In with Password"}
            </button>

            <button
              type="button"
              onClick={(e) => {
                void handleMagicLink(e as unknown as FormEvent<HTMLFormElement>);
              }}
              disabled={loadingPassword || loadingMagicLink}
              className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMagicLink ? "Sending magic link..." : "Email Me a Magic Link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}