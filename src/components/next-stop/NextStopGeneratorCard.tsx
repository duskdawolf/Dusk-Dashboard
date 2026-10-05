'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type EventMini = {
  id: string;
  title: string;
  city: string | null;
  region: string | null;
};

type Copy = {
  headline: string;
  subheadline: string;
  currentEventKicker: string;
  findMeTitle: string;
  findMeItems: string[];
  flavorText: string;
  pastLabel: string;
  futureLabel: string;
  artDirection: string;
  currentEventTitle: string;
  locationLine: string;
  dateLine: string;
};

type State = {
  route: { previous: EventMini[]; current: EventMini; next: EventMini[] };
  sourceHash: string;
  storedSourceHash: string | null;
  status: 'not_generated' | 'generating' | 'generated' | 'stale' | 'failed';
  stale: boolean;
  imageUrl: string | null;
  generatedAt: string | null;
  copy: Copy | null;
};

function place(event: EventMini) {
  return [event.city, event.region].filter(Boolean).join(', ') || 'TBA';
}

export function NextStopGeneratorCard({ eventId }: { eventId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch(`/api/events/${eventId}/next-stop`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Could not load Next Stop');
    setState(payload);
  }, [eventId]);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  async function run(action: 'generate' | 'regenerate_image' | 'generate_copy') {
    try {
      setBusy(action);
      setError(null);
      const response = await fetch(`/api/events/${eventId}/next-stop`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Next Stop action failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Next Stop action failed');
    } finally {
      setBusy(null);
    }
  }

  const statusLabel = useMemo(() => {
    if (!state) return 'Loading';
    if (state.stale) return 'Stale';
    return state.status.replaceAll('_', ' ');
  }, [state]);

  if (!state) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="text-sm font-bold text-cyan-300">Next Stop Generator</div>
        <div className="mt-2 text-sm text-slate-400">{error ?? 'Loading route context…'}</div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0a1220] shadow-2xl">
      <div className="border-b border-white/10 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Dusk&apos;s Next Stop</div>
            <h2 className="mt-2 text-2xl font-black text-white">Next Stop Generator</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Past paws → current deployment → future chaos. AI makes the themed artwork; Dusk Induskries renders the factual poster text itself.
            </p>
          </div>
          <span className={[
            'rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider',
            state.stale
              ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
              : state.status === 'generated'
                ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
                : 'border-white/10 bg-white/5 text-slate-300',
          ].join(' ')}>{statusLabel}</span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-5 md:p-6">
          <div className="grid gap-3">
            {state.route.previous.map((event) => (
              <div key={event.id} className="rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-300">Past paw</div>
                <div className="mt-1 font-black text-white">{event.title}</div>
                <div className="text-sm text-slate-400">{place(event)}</div>
              </div>
            ))}

            <div className="rounded-3xl border border-pink-400/30 bg-gradient-to-br from-cyan-400/10 via-violet-400/10 to-pink-400/10 p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Now deploying</div>
              <div className="mt-2 text-3xl font-black text-white">{state.route.current.title}</div>
              <div className="mt-1 text-sm font-bold text-pink-200">{place(state.route.current)}</div>
              {state.copy?.findMeItems?.length ? (
                <div className="mt-5">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">{state.copy.findMeTitle}</div>
                  <ul className="mt-2 grid gap-2 text-sm text-slate-200">
                    {state.copy.findMeItems.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex gap-2"><span className="text-cyan-300">●</span><span>{item}</span></li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {state.route.next.map((event) => (
              <div key={event.id} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">Upcoming</div>
                <div className="mt-1 font-black text-white">{event.title}</div>
                <div className="text-sm text-slate-400">{place(event)}</div>
              </div>
            ))}
          </div>

          {state.stale ? (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              The route or event details changed after this poster was generated. Regenerate it before publishing.
            </div>
          ) : null}

          {error ? <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => run('generate')} disabled={Boolean(busy)}
              className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
              {busy === 'generate' ? 'Generating…' : state.imageUrl ? 'Generate Fresh Version' : 'Generate Next Stop Card'}
            </button>
            {state.copy ? (
              <button type="button" onClick={() => run('regenerate_image')} disabled={Boolean(busy)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                {busy === 'regenerate_image' ? 'Regenerating art…' : 'Regenerate Art Only'}
              </button>
            ) : null}
            <button type="button" onClick={() => run('generate_copy')} disabled={Boolean(busy)}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
              {busy === 'generate_copy' ? 'Rewriting…' : 'Rewrite Poster Copy'}
            </button>
          </div>
        </div>

        <aside className="border-t border-white/10 bg-black/20 p-5 lg:border-l lg:border-t-0">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Mobile asset</div>
          {state.imageUrl ? (
            <>
              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.imageUrl} alt={`Dusk's Next Stop — ${state.route.current.title}`} className="aspect-[9/16] w-full object-cover" />
              </div>
              <a href={state.imageUrl} target="_blank" rel="noreferrer"
                className="mt-3 inline-flex rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm font-black text-cyan-100">
                Open full-size 9:16 poster
              </a>
            </>
          ) : (
            <div className="mt-3 grid aspect-[9/16] place-items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
              Generate the first poster to preview it here.
            </div>
          )}
          {state.generatedAt ? <div className="mt-3 text-xs text-slate-500">Generated {new Date(state.generatedAt).toLocaleString()}</div> : null}
        </aside>
      </div>
    </section>
  );
}
