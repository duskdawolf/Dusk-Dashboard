"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (password.length < 8) {
      setStatus("Use at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setStatus("Passwords do not match.");
      return;
    }

    setStatus("Updating password...");

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Password updated. Redirecting to Dusk Dashboard...");
    window.setTimeout(() => {
      window.location.href = "/dashboard";
    }, 900);
  }

  return (
    <form onSubmit={submit} className="panel space-y-4">
      <label className="form-label">
        New password
        <input
          className="form-input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      <label className="form-label">
        Confirm new password
        <input
          className="form-input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
        />
      </label>

      <button className="button-primary" type="submit">
        Set dashboard password
      </button>

      {status ? <p className="text-sm text-slate-400">{status}</p> : null}
    </form>
  );
}
