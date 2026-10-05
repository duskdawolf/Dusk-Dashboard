"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { NextStopGeneratorCard } from '@/components/next-stop/NextStopGeneratorCard';
import { Alpha71BrandAssetsPanel } from '@/components/alpha71/Alpha71BrandAssetsPanel';

type PrepOption = {
  id: string;
  event_id: string;
  status: string;
  event: {
    id: string;
    title: string;
    start_at: string;
    end_at?: string | null;
    location: string | null;
  } | null;
};

type Action = {
  id: string;
  action_type: string;
  title: string;
  explanation: string | null;
  payload: {
    record_id?: string | null;
    changes?: Record<string, unknown>;
  };
  status: string;
  created_at: string;
};

function eventTime(value?: string | null) {
  if (!value) return Number.NaN;
  return new Date(value).valueOf();
}

function sortDeployments(items: PrepOption[]) {
  const now = Date.now();
  return [...items].sort((a, b) => {
    const aStart = eventTime(a.event?.start_at);
    const bStart = eventTime(b.event?.start_at);
    const aEnd = eventTime(a.event?.end_at) || aStart;
    const bEnd = eventTime(b.event?.end_at) || bStart;
    const aActive = Number.isFinite(aStart) && aStart <= now && Number.isFinite(aEnd) && aEnd >= now;
    const bActive = Number.isFinite(bStart) && bStart <= now && Number.isFinite(bEnd) && bEnd >= now;
    if (aActive !== bActive) return aActive ? -1 : 1;
    const aFuture = Number.isFinite(aStart) && aStart > now;
    const bFuture = Number.isFinite(bStart) && bStart > now;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    if (aFuture && bFuture) return aStart - bStart;
    if (Number.isFinite(aStart) && Number.isFinite(bStart)) return bStart - aStart;
    return 0;
  });
}

export function Alpha7ConventionOpsDock() {
  const [options, setOptions] = useState<PrepOption[]>([]);
  const [selected, setSelected] = useState('');
  const [instruction, setInstruction] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const current = useMemo(() => options.find((item) => item.id === selected) ?? null, [options, selected]);

  const loadOptions = useCallback(async () => {
    const res = await fetch('/api/alpha7/con-preps', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Could not load deployments');
    const sorted = sortDeployments(json.items ?? []);
    setOptions(sorted);
    setSelected((old) => (old && sorted.some((item) => item.id === old) ? old : sorted[0]?.id ?? ''));
  }, []);

  const loadActions = useCallback(async () => {
    if (!selected) return;
    const res = await fetch(`/api/alpha7/chaos/actions?conPrepId=${encodeURIComponent(selected)}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Could not load actions');
    setActions(json.items ?? []);
  }, [selected]);

  useEffect(() => { loadOptions().catch((e) => setError(e.message)); }, [loadOptions]);
  useEffect(() => { loadActions().catch((e) => setError(e.message)); }, [loadActions]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true); setError(''); setSummary('');
    try {
      const form = new FormData();
      form.set('conPrepId', selected);
      form.set('instruction', instruction);
      if (file) form.set('image', file);
      const res = await fetch('/api/alpha7/chaos/analyze', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Chaos analysis failed');
      setSummary(json.summary ?? '');
      setInstruction('');
      setFile(null);
      const input = document.getElementById('alpha7-image') as HTMLInputElement | null;
      if (input) input.value = '';
      await loadActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chaos analysis failed');
    } finally {
      setBusy(false);
    }
  }

  async function apply(id: string) {
    setApplyBusy(id); setError('');
    try {
      const res = await fetch(`/api/alpha7/chaos/actions/${id}/apply`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not apply action');
      await Promise.all([loadActions(), loadOptions()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply action');
    } finally {
      setApplyBusy(null);
    }
  }

  return (
    <div className="mb-6 grid gap-5">
      <Alpha71BrandAssetsPanel />

      <section className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/5 via-violet-400/5 to-pink-400/5 p-5 md:p-6">
        <div>
          <div className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">v26 Alpha 7</div>
          <h2 className="mt-1 text-2xl font-black text-white">Chaos Copilot — Record Editor</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">Tell Chaos what to change or attach a hotel / travel / registration screenshot. Changes remain proposals until you press Apply.</p>
        </div>

        <div className="mt-5">
          <label className="text-xs font-black uppercase tracking-wider text-slate-400">Deployment</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white">
            {options.map((option, index) => (
              <option key={option.id} value={option.id}>{index === 0 ? 'NEXT — ' : ''}{option.event?.title ?? 'Untitled deployment'} — {option.status}</option>
            ))}
          </select>
        </div>

        <form onSubmit={submit} className="mt-4 grid gap-3">
          <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder='Example: "Update my hotel to this confirmation and set the total to $900."' className="min-h-24 rounded-xl border border-white/10 bg-[#07101b] p-3 text-white placeholder:text-slate-600" />
          <div className="flex flex-wrap items-center gap-3">
            <input id="alpha7-image" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="max-w-full text-sm text-slate-300" />
            <button type="submit" disabled={busy || !selected || (!instruction.trim() && !file)} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40">{busy ? 'Chaos is reading it…' : 'Analyze & Propose Changes'}</button>
          </div>
        </form>

        {summary ? <div className="mt-4 rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4 text-sm text-violet-100"><strong>Chaos:</strong> {summary}</div> : null}
        {error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div> : null}

        <div className="mt-5 grid gap-3">
          {actions.filter((action) => action.status === 'proposed').map((action) => (
            <article key={action.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-black uppercase tracking-wider text-pink-300">{action.action_type.replaceAll('_', ' ')}</div>
              <h3 className="mt-1 font-black text-white">{action.title}</h3>
              {action.explanation ? <p className="mt-1 text-sm text-slate-400">{action.explanation}</p> : null}
              <pre className="mt-3 overflow-x-auto rounded-xl bg-black/30 p-3 text-xs text-cyan-100">{JSON.stringify(action.payload?.changes ?? {}, null, 2)}</pre>
              <button type="button" onClick={() => apply(action.id)} disabled={Boolean(applyBusy)} className="mt-3 rounded-xl bg-pink-400 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{applyBusy === action.id ? 'Applying…' : 'Apply This Change'}</button>
            </article>
          ))}
        </div>
      </section>

      {current?.event_id ? <NextStopGeneratorCard eventId={current.event_id} /> : null}
    </div>
  );
}
