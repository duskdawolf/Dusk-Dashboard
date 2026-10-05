"use client";

import { useCallback, useEffect, useState } from "react";

export function NextStopGeneratorCard({ eventId }: { eventId: string }) {
  const [state, setState] = useState<any>(null);
  const [busy, setBusy] = useState(false);
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

  async function generate(action = "generate") {
    setBusy(true);
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
      setBusy(false);
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
          <div className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">
            Dusk&apos;s Next Stop
          </div>
          <h3 className="mt-1 text-xl font-black text-white">
            {state.route.current.title}
          </h3>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
          state.stale ? "bg-amber-400/15 text-amber-200" : "bg-cyan-300/10 text-cyan-200"
        }`}>
          {state.stale ? "stale" : state.status}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        {state.route.previous.map((e: any) => (
          <div key={e.id} className="rounded-xl border border-violet-400/15 bg-violet-400/5 p-3 text-slate-300">
            ← {e.title}
          </div>
        ))}
        <div className="rounded-xl border border-pink-400/25 bg-pink-400/10 p-3 font-black text-white">
          ● {state.route.current.title}
        </div>
        {state.route.next.map((e: any) => (
          <div key={e.id} className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3 text-slate-300">
            → {e.title}
          </div>
        ))}
      </div>

      {state.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.imageUrl}
          alt={`Dusk's Next Stop — ${state.route.current.title}`}
          className="mt-4 aspect-[9/16] w-full max-w-sm rounded-2xl border border-white/10 object-cover"
        />
      ) : null}

      {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => generate("generate")}
          className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
        >
          {busy ? "Working…" : state.imageUrl ? "Generate Fresh Version" : "Generate Next Stop Card"}
        </button>
        {state.copy ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => generate("regenerate_image")}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            Regenerate Art Only
          </button>
        ) : null}
      </div>
    </section>
  );
}
