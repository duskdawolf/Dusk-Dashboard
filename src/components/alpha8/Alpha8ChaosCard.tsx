"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Action = {
  id: string;
  action_type: string;
  title: string;
  explanation: string | null;
  payload: { changes?: Record<string, unknown> };
  status: string;
};

export function Alpha8ChaosCard({ conPrepId }: { conPrepId: string }) {
  const [instruction, setInstruction] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadActions = useCallback(async () => {
    const res = await fetch(`/api/alpha7/chaos/actions?conPrepId=${encodeURIComponent(conPrepId)}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not load proposals");
    setActions(json.items ?? []);
  }, [conPrepId]);

  useEffect(() => {
    setActions([]);
    setSummary("");
    setInstruction("");
    setFile(null);
    loadActions().catch((e) => setError(e.message));
  }, [loadActions]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!instruction.trim() && !file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("conPrepId", conPrepId);
      form.set("instruction", instruction);
      if (file) form.set("image", file);
      const res = await fetch("/api/alpha7/chaos/analyze", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Chaos analysis failed");
      setSummary(json.summary ?? "");
      setInstruction("");
      setFile(null);
      await loadActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chaos analysis failed");
    } finally {
      setBusy(false);
    }
  }

  async function apply(id: string) {
    setApplyBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/alpha7/chaos/actions/${id}/apply`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not apply proposal");
      await loadActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply proposal");
    } finally {
      setApplyBusy(null);
    }
  }

  const proposed = actions.filter((action) => action.status === "proposed");

  return (
    <div id="alpha8-chaos" className="grid gap-4">
      <div>
        <div className="text-sm font-black text-white">Chaos Copilot</div>
        <div className="mt-1 text-xs text-slate-500">Scoped only to this deployment · changes require approval</div>
      </div>

      <form onSubmit={submit} className="grid gap-3">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Ask about this convention, update a record, or attach a confirmation…"
          className="min-h-28 resize-y rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-slate-200">
            Attach image
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
          </label>
          {file ? <span className="max-w-40 truncate text-xs text-slate-500">{file.name}</span> : null}
          <button type="submit" disabled={busy || (!instruction.trim() && !file)} className="ml-auto rounded-xl bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-40">
            {busy ? "Thinking…" : "Send"}
          </button>
        </div>
      </form>

      {summary ? <div className="rounded-xl bg-violet-400/10 p-3 text-xs leading-5 text-violet-100">{summary}</div> : null}
      {error ? <div className="text-xs text-red-300">{error}</div> : null}

      {proposed.length ? (
        <div className="grid gap-2">
          <div className="text-[11px] font-black uppercase tracking-[.16em] text-pink-300">Proposals</div>
          {proposed.slice(0, 4).map((action) => (
            <div key={action.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="text-xs font-black text-white">{action.title}</div>
              {action.explanation ? <div className="mt-1 text-xs leading-5 text-slate-400">{action.explanation}</div> : null}
              <button type="button" disabled={Boolean(applyBusy)} onClick={() => apply(action.id)} className="mt-2 rounded-lg bg-pink-400 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50">
                {applyBusy === action.id ? "Applying…" : "Apply"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
