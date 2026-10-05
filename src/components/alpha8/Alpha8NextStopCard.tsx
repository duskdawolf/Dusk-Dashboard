"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export function Alpha8NextStopCard({ eventId }: { eventId: string }) {
  const [state, setState] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/next-stop`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not load Next Stop");
    setState(json);
  }, [eventId]);

  useEffect(() => {
    setState(null);
    load().catch((e) => setError(e.message));
  }, [load]);

  async function run(action: string) {
    setBusy(action);
    setError("");
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
    return <div className="text-sm text-slate-500">Loading share-card tools…</div>;
  }

  return (
    <div id="alpha8-next-stop" className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-white">Dusk&apos;s Next Stop</div>
          <div className="mt-1 text-xs text-slate-500">
            {state.backgroundUrl ? "Saved background ready" : "No saved background"} · {state.stale ? "card needs rebuild" : state.status}
          </div>
        </div>
        {state.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.imageUrl} alt="Current Next Stop card" className="h-28 w-16 rounded-lg border border-white/10 object-cover" />
        ) : null}
      </div>

      {state.copy?.findMeItems?.length ? (
        <div className="rounded-xl bg-white/[0.035] p-3">
          <div className="text-[11px] font-black uppercase tracking-[.16em] text-cyan-300">How to find Dusk</div>
          <div className="mt-2 text-xs leading-5 text-slate-300">
            {state.copy.findMeItems.slice(0, 3).join(" · ")}
          </div>
        </div>
      ) : null}

      {error ? <div className="text-xs text-red-300">{error}</div> : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => run(state.backgroundUrl ? "generate_card_from_background" : "generate")}
          className="rounded-xl bg-cyan-300 px-3 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"
        >
          {busy ? "Working…" : state.imageUrl ? "Rebuild Card" : "Generate Card"}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => run("refresh_all")}
          className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-xs font-black text-white disabled:opacity-50"
        >
          New Background
        </button>
      </div>

      {state.imageUrl ? (
        <a
          href={`/api/events/${eventId}/next-stop/download`}
          className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-3 py-2.5 text-center text-xs font-black text-cyan-200"
        >
          Download Image
        </a>
      ) : null}

      <Link href="/dashboard/settings/brand" className="text-xs font-bold text-violet-300 hover:text-violet-200">
        Brand & media settings →
      </Link>
    </div>
  );
}
