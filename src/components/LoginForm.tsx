"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function magicLink() {
    setStatus("Sending magic link...");

    try {
      const supabase = createBrowserSupabaseClient();
      const next = "/dashboard";
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Magic link sent. Check your email.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send magic link.");
    }
  }

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

  return (
    <div className="panel">
      <form onSubmit={passwordLogin} className="space-y-4">
        <label className="form-label">
          Email
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

        <div className="flex flex-wrap gap-3">
          <button className="button-primary" type="submit">
            Sign in with password
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={magicLink}
            disabled={!email}
          >
            Email me a magic link
          </button>
        </div>

        {status ? <p className="text-sm text-slate-400">{status}</p> : null}
      </form>
    </div>
  );
}
