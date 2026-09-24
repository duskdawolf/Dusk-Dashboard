"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type PendingChange =
  | { kind: "email"; email: string }
  | { kind: "password"; password: string }
  | null;

export function AccountSecurity({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nonce, setNonce] = useState("");
  const [pending, setPending] = useState<PendingChange>(null);
  const [status, setStatus] = useState("");

  async function beginReauthentication(change: NonNullable<PendingChange>) {
    const supabase = createBrowserSupabaseClient();
    setStatus("Sending Dusk reauthentication code...");

    const { error } = await supabase.auth.reauthenticate();

    if (error) {
      setStatus(error.message);
      return;
    }

    setPending(change);
    setNonce("");
    setStatus(
      "Verification code sent by email. Enter it below to authorize the change.",
    );
  }

  async function requestEmailChange(event: FormEvent) {
    event.preventDefault();

    if (!newEmail || newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setStatus("Enter a different email address.");
      return;
    }

    await beginReauthentication({ kind: "email", email: newEmail.trim() });
  }

  async function requestPasswordChange(event: FormEvent) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setStatus("Use a password with at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus("The new passwords do not match.");
      return;
    }

    await beginReauthentication({ kind: "password", password: newPassword });
  }

  async function confirmSensitiveChange(event: FormEvent) {
    event.preventDefault();

    if (!pending) return;

    if (!nonce.trim()) {
      setStatus("Enter the reauthentication code from your email.");
      return;
    }

    const supabase = createBrowserSupabaseClient();
    setStatus(
      pending.kind === "email"
        ? "Authorizing email change..."
        : "Authorizing password change...",
    );

    const attributes =
      pending.kind === "email"
        ? { email: pending.email, nonce: nonce.trim() }
        : { password: pending.password, nonce: nonce.trim() };

    const { error } = await supabase.auth.updateUser(attributes);

    if (error) {
      setStatus(error.message);
      return;
    }

    if (pending.kind === "email") {
      setStatus(
        "Reauthentication accepted. Supabase has started the secure email-change confirmation flow. Check the required email inbox(es) for the confirmation message.",
      );
      setNewEmail("");
    } else {
      setStatus("Password changed successfully.");
      setNewPassword("");
      setConfirmPassword("");
    }

    setPending(null);
    setNonce("");
  }

  function cancelPending() {
    setPending(null);
    setNonce("");
    setStatus("Sensitive change cancelled.");
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Account Security</div>
        <h1 className="text-4xl font-black tracking-[-.04em]">
          Reauthenticate Before Credential Changes
        </h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Email and password changes require a verification code sent to your
          current account email before Dusk Dashboard submits the credential change.
        </p>

        <div className="mt-5 rounded-2xl border border-dusk-aqua/20 bg-dusk-aqua/5 p-4 text-sm">
          Signed in as <strong>{currentEmail}</strong>
        </div>
      </section>

      {pending ? (
        <section className="panel !border-dusk-pink/25">
          <div className="eyebrow">Sensitive operation authorization</div>
          <h2 className="text-3xl font-black">
            Enter Reauthentication Code
          </h2>
          <p className="mt-3 text-slate-400">
            A one-time code was sent to <strong>{currentEmail}</strong>. It
            authorizes this specific credential-change session.
          </p>

          <form onSubmit={confirmSensitiveChange} className="mt-6 max-w-lg space-y-4">
            <label className="form-label">
              Verification code
              <input
                className="form-input font-mono text-2xl tracking-[.18em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={nonce}
                onChange={(event) => setNonce(event.target.value)}
                placeholder="00000000"
                required
              />
            </label>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm text-slate-400">
              Requested change:{" "}
              <strong className="text-white">
                {pending.kind === "email"
                  ? `Email → ${pending.email}`
                  : "Change Dashboard password"}
              </strong>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="button-primary" type="submit">
                Verify & apply change
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={cancelPending}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel">
            <div className="eyebrow">Email</div>
            <h2 className="text-2xl font-black">Change Email Address</h2>
            <p className="mt-2 text-sm text-slate-400">
              Reauthentication happens first. Supabase's secure email-change
              confirmation flow then verifies the new address.
            </p>

            <form onSubmit={requestEmailChange} className="mt-5 space-y-4">
              <label className="form-label">
                New email address
                <input
                  className="form-input"
                  type="email"
                  autoComplete="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  required
                />
              </label>

              <button className="button-primary" type="submit">
                Reauthenticate & change email
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="eyebrow">Password</div>
            <h2 className="text-2xl font-black">Change Password</h2>
            <p className="mt-2 text-sm text-slate-400">
              Dusk sends a reauthentication code before submitting the new
              password to Supabase.
            </p>

            <form onSubmit={requestPasswordChange} className="mt-5 space-y-4">
              <label className="form-label">
                New password
                <input
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </label>

              <label className="form-label">
                Confirm new password
                <input
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </label>

              <button className="button-primary" type="submit">
                Reauthenticate & change password
              </button>
            </form>
          </section>
        </div>
      )}

      {status ? (
        <div className="panel text-sm text-slate-300">{status}</div>
      ) : null}
    </div>
  );
}
