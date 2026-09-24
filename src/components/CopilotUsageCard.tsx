"use client";

import { useEffect, useState } from "react";

type Usage = {
  requests: number;
  inputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  estimatedCostUsd: number;
  pricedRequests: number;
  models: Record<string, number>;
};

type Payload = {
  last24h: Usage;
  last7d: Usage;
  note: string;
};

function n(value: number) {
  return new Intl.NumberFormat().format(value || 0);
}

function money(value: number) {
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function CopilotUsageCard() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/admin/copilot/usage", {
      cache: "no-store",
    });
    const body = await response.json();

    if (!response.ok) {
      setError(body.detail ?? body.error ?? "Could not load AI usage.");
      return;
    }

    setPayload(body);
    setError("");
  }

  useEffect(() => {
    load();
  }, []);

  const usage = payload?.last24h;

  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Admin · AI spend control</div>
          <h2 className="text-2xl font-black">Chaos Copilot Usage</h2>
          <p className="mt-1 text-xs text-slate-500">
            Rolling 24 hours · actual OpenAI token accounting captured by Dusk.
          </p>
        </div>
        <button className="button-secondary" type="button" onClick={load}>
          Refresh usage
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-dusk-pink">{error}</p>
      ) : !usage ? (
        <p className="mt-4 text-sm text-slate-500">Loading usage…</p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="text-xs uppercase tracking-widest text-slate-500">Requests</div>
              <div className="mt-1 text-3xl font-black">{n(usage.requests)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="text-xs uppercase tracking-widest text-slate-500">Input</div>
              <div className="mt-1 text-3xl font-black">{n(usage.inputTokens)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="text-xs uppercase tracking-widest text-slate-500">Cache writes</div>
              <div className={`mt-1 text-3xl font-black ${usage.cacheWriteTokens ? "text-dusk-pink" : "text-dusk-aqua"}`}>
                {n(usage.cacheWriteTokens)}
              </div>
            </div>
            <div className="rounded-2xl border border-dusk-aqua/20 bg-dusk-aqua/5 p-4">
              <div className="text-xs uppercase tracking-widest text-slate-500">Estimated cost</div>
              <div className="mt-1 text-3xl font-black text-dusk-aqua">
                {money(usage.estimatedCostUsd)}
                {usage.pricedRequests < usage.requests ? (
                  <span className="ml-2 text-xs text-slate-500">+ unpriced</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 p-3 text-sm">
              <span className="text-slate-500">Cache reads</span>
              <strong className="float-right">{n(usage.cachedTokens)}</strong>
            </div>
            <div className="rounded-xl border border-white/10 p-3 text-sm">
              <span className="text-slate-500">Output</span>
              <strong className="float-right">{n(usage.outputTokens)}</strong>
            </div>
            <div className="rounded-xl border border-white/10 p-3 text-sm">
              <span className="text-slate-500">Reasoning</span>
              <strong className="float-right">{n(usage.reasoningTokens)}</strong>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(usage.models).map(([model, count]) => (
              <span className="tag !mt-0" key={model}>
                {model} · {count}
              </span>
            ))}
            {!Object.keys(usage.models).length ? (
              <span className="text-xs text-slate-500">
                No Alpha 4 usage recorded yet.
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-[11px] leading-5 text-slate-600">
            {payload?.note}
          </p>
        </>
      )}
    </section>
  );
}
