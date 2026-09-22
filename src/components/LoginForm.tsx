"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function passwordLogin(event: FormEvent) {
    event.preventDefault();
    setStatus("Signing in...");

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setStatus(error.message);
        return;
      }

      window.location.href = "/dashboard";
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not sign in.");
    }
  }

  async function forgotPassword() {
    if (!email) {
      setStatus("Enter your dashboard email first.");
      return;
    }

    setStatus("Sending password reset email...");

    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo =
        `${window.location.origin}/auth/recovery?next=${encodeURIComponent("/reset-password")}`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Reset email sent. Use the link in that email to set your dashboard password.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not send reset email.",
      );
    }
  }

  async function magicLink() {
    if (!email) {
      setStatus("Enter your dashboard email first.");
      return;
    }

    setStatus("Sending magic link...");

    const supabase = createBrowserSupabaseClient();
    const emailRedirectTo =
      `${window.location.origin}/auth/callback?next=${encodeURIComponent("/dashboard")}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });

    setStatus(error ? error.message : "Magic link sent. Check your email.");
  }

  return (
    <div className="panel">
      <form onSubmit={passwordLogin} className="space-y-4">
        <label className="form-label">
          Dashboard email
          <input
            className="form-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="form-label">
          Password
          <input
            className="form-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button className="button-primary w-full" type="submit">
          Sign in
        </button>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            className="button-secondary"
            type="button"
            onClick={forgotPassword}
          >
            Set / reset password
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={magicLink}
          >
            Email magic link
          </button>
        </div>

        <p className="text-xs text-slate-500">
          No Google OAuth setup required. Your dashboard username is your
          authorized email address.
        </p>

        {status ? <p className="text-sm text-slate-400">{status}</p> : null}
      </form>
    </div>
  );
}
