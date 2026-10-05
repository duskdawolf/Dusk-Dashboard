"use client";

import { useCallback, useEffect, useState } from "react";

function StatusPill({ label, tone }: { label: string; tone: "cyan" | "amber" | "violet" | "slate" }) {
  const classes = {
    cyan: "bg-cyan-300/10 text-cyan-200",
    amber: "bg-amber-400/15 text-amber-200",
    violet: "bg-violet-400/15 text-violet-200",
    slate: "bg-white/10 text-slate-200",
  }[tone];
  return <div className={`rounded-full px-3 py-1 text-xs font-black uppercase ${classes}`}>{label}</div>;
}

export function NextStopGeneratorCard({ eventId }: { eventId: string }) {
  const [state, setState] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/next-stop`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not load Next Stop");
    setState(json);
  }, [eventId]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function run(action = "generate") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/next-stop`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(null);
    }
  }

  if (!state) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
        Next Stop Generator: {error ?? "loading…"}
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-[#09131f] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Dusk&apos;s Next Stop</div>
          <h3 className="mt-1 text-xl font-black text-white">{state.route.current.title}</h3>
          <div className="mt-2 text-sm text-slate-400">Background can now be saved once and reused for future card refreshes.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={`card: ${state.stale ? 'stale' : state.status}`} tone={state.stale ? 'amber' : 'cyan'} />
          <StatusPill label={`background: ${state.backgroundStatus}`} tone={state.backgroundStatus === 'generated' ? 'violet' : 'slate'} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        {state.route.previous.map((e: any) => (
          <div key={e.id} className="rounded-xl border border-violet-400/15 bg-violet-400/5 p-3 text-slate-300">← {e.title}</div>
        ))}
        <div className="rounded-xl border border-pink-400/25 bg-pink-400/10 p-3 font-black text-white">● {state.route.current.title}</div>
        {state.route.next.map((e: any) => (
          <div key={e.id} className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3 text-slate-300">→ {e.title}</div>
        ))}
      </div>

      {state.copy ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
          <div className="text-xs font-black uppercase tracking-wider text-cyan-300">How to Find Dusk</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {state.copy.findMeItems?.map((item: string, index: number) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
          <div className="mt-3 text-xs text-slate-500">Tip: keep the event&apos;s <code>find_me_notes</code> and <code>appearance_mode</code> updated if you want richer card details.</div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-black uppercase tracking-wider text-violet-300">Saved Background</div>
          {state.backgroundUrl ? (
            <img src={state.backgroundUrl} alt={`Saved background for ${state.route.current.title}`} className="aspect-[9/16] w-full max-w-sm rounded-2xl border border-white/10 object-cover" />
          ) : (
            <div className="flex aspect-[9/16] w-full max-w-sm items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-sm text-slate-500">No saved background yet</div>
          )}
        </div>
        <div>
          <div className="mb-2 text-xs font-black uppercase tracking-wider text-cyan-300">Current Card</div>
          {state.imageUrl ? (
            <img src={state.imageUrl} alt={`Dusk's Next Stop — ${state.route.current.title}`} className="aspect-[9/16] w-full max-w-sm rounded-2xl border border-white/10 object-cover" />
          ) : (
            <div className="flex aspect-[9/16] w-full max-w-sm items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-sm text-slate-500">No card generated yet</div>
          )}
        </div>
      </div>

      {error ? <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(busy)} onClick={() => run("generate_background")} className="rounded-xl bg-violet-400 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
          {busy === "generate_background" ? "Working…" : state.backgroundUrl ? "Refresh Saved Background" : "Generate Background"}
        </button>
        <button type="button" disabled={Boolean(busy) || !state.backgroundUrl} onClick={() => run("generate_card_from_background")} className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50">
          {busy === "generate_card_from_background" ? "Working…" : state.imageUrl ? "Rebuild Card From Saved Background" : "Build Card From Saved Background"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => run("refresh_all")} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
          {busy === "refresh_all" ? "Working…" : "Full Refresh (New Background + Card)"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => run("generate_copy")} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
          {busy === "generate_copy" ? "Working…" : "Refresh Copy Only"}
        </button>
      </div>
    </section>
  );
}
