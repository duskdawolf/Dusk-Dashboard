"use client";

import { useEffect, useState } from "react";

type Provider = {
  platform: "telegram" | "twitter" | "instagram" | "snapchat";
  label: string;
  configured: boolean;
  live: boolean;
  connected: boolean;
  account?: string | null;
  target?: string | null;
  detail: string;
  error?: string | null;
  capabilities: {
    text: boolean;
    photo: boolean;
    video: boolean;
    carousel: boolean;
    maxMedia?: number | null;
    maxText?: number | null;
    maxCaption?: number | null;
    analytics: boolean;
  };
};

export function SocialProviderPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [status, setStatus] = useState("Checking provider connections...");
  const [testing, setTesting] = useState(false);
  const [disconnectingX, setDisconnectingX] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/social/providers", {
      cache: "no-store",
    });
    const body = await response.json();

    if (!response.ok) {
      setStatus(body.error ?? "Could not check social providers.");
      return;
    }

    setProviders(body.providers ?? []);
    setStatus("");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const xError = params.get("xError");
    const xConnected = params.get("xConnected");
    if (xError) setStatus(`X connection failed: ${xError}`);
    if (xConnected) setStatus("X account connected successfully.");
    load();
  }, []);

  async function testTelegram() {
    setTesting(true);
    setStatus("Sending Telegram provider test...");

    const response = await fetch("/api/admin/social/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "telegram" }),
    });

    const body = await response.json();
    setTesting(false);

    if (!response.ok) {
      setStatus(body.error ?? "Telegram provider test failed.");
      return;
    }

    setStatus(
      `Telegram test message sent${body.messageId ? ` · message ${body.messageId}` : ""}.`,
    );
    await load();
  }

  function connectX() {
    window.location.href = "/api/admin/social/x/connect";
  }

  async function disconnectX() {
    if (!window.confirm("Disconnect X from Dusk Social Ops? Scheduled X jobs will fail until you reconnect.")) return;
    setDisconnectingX(true);
    setStatus("Disconnecting X...");
    const response = await fetch("/api/admin/social/x/connection", { method: "DELETE" });
    const body = await response.json();
    setDisconnectingX(false);
    if (!response.ok) { setStatus(body.error ?? "Could not disconnect X."); return; }
    setStatus("X disconnected.");
    await load();
  }

  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Live provider layer · v25.1</div>
          <h2 className="text-3xl font-black">Publishing Providers</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Telegram and X are live. X uses OAuth 2.0 PKCE with encrypted
            refresh-token storage. Instagram remains staged for v25.2.
          </p>
        </div>

        <button className="button-secondary" type="button" onClick={load}>
          Recheck providers
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {providers.map((provider) => (
          <div
            key={provider.platform}
            className={`rounded-2xl border p-4 ${
              provider.connected
                ? "border-dusk-aqua/35 bg-dusk-aqua/5"
                : provider.live
                  ? "border-dusk-pink/30 bg-dusk-pink/5"
                  : "border-white/10 bg-white/[0.025]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <strong className="text-lg">{provider.label}</strong>
              <span
                className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${
                  provider.connected
                    ? "border-dusk-aqua/30 text-dusk-aqua"
                    : provider.live
                      ? "border-dusk-pink/30 text-dusk-pink"
                      : "border-white/10 text-slate-500"
                }`}
              >
                {provider.connected
                  ? "connected"
                  : provider.live
                    ? "setup needed"
                    : "coming soon"}
              </span>
            </div>

            {provider.account ? (
              <p className="mt-3 text-sm font-black text-white">
                {provider.account}
              </p>
            ) : null}

            {provider.target ? (
              <p className="mt-1 text-xs text-slate-500">
                Target: {provider.target}
              </p>
            ) : null}

            <p className="mt-3 text-xs leading-5 text-slate-400">
              {provider.detail}
            </p>

            {provider.error ? (
              <div className="mt-3 rounded-xl border border-dusk-pink/20 bg-dusk-pink/5 p-2 text-xs text-dusk-pink">
                {provider.error}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {provider.capabilities.photo ? (
                <span className="tag !mt-0">photo</span>
              ) : null}
              {provider.capabilities.video ? (
                <span className="tag !mt-0">video</span>
              ) : null}
              {provider.capabilities.carousel ? (
                <span className="tag !mt-0">
                  carousel
                  {provider.capabilities.maxMedia
                    ? ` ≤${provider.capabilities.maxMedia}`
                    : ""}
                </span>
              ) : null}
            </div>

            {provider.platform === "telegram" && provider.connected ? (
              <button
                className="button-secondary mt-4 w-full"
                type="button"
                disabled={testing}
                onClick={testTelegram}
              >
                {testing ? "Sending..." : "Send provider test"}
              </button>
            ) : null}

            {provider.platform === "twitter" && provider.configured ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className={provider.connected ? "button-secondary" : "button-primary"}
                  type="button"
                  onClick={connectX}
                >
                  {provider.connected ? "Reconnect X" : "Connect X"}
                </button>

                {provider.connected ? (
                  <button
                    className="rounded-xl border border-dusk-pink/30 bg-dusk-pink/10 px-3 py-2 text-xs font-black"
                    type="button"
                    disabled={disconnectingX}
                    onClick={disconnectX}
                  >
                    {disconnectingX ? "Disconnecting..." : "Disconnect"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {status ? (
        <p className="mt-4 text-sm text-slate-400">{status}</p>
      ) : null}
    </section>
  );
}
