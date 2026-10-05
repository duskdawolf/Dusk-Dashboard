"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alpha8ChaosCard } from "./Alpha8ChaosCard";
import { Alpha8NextStopCard } from "./Alpha8NextStopCard";
import { DisclosureCard } from "./DisclosureCard";

type Option = {
  id: string;
  event_id: string;
  status: string;
  event: {
    id: string;
    title: string;
    start_at: string;
    end_at?: string | null;
    location: string | null;
    state_code?: string | null;
  } | null;
};

type Summary = {
  prep: any;
  event: any;
  packing: any[];
  tasks: any[];
  hotels: any[];
  travel: any[];
  registrations: any[];
  costs: any[];
  metrics: {
    packingTotal: number;
    packedCount: number;
    taskTotal: number;
    taskDoneCount: number;
    openTaskCount: number;
    nextTask: any | null;
    totalCostCents: number;
    paidCostCents: number;
  };
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
}

function niceDate(value?: string | null) {
  if (!value) return "TBA";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function dateRange(start?: string | null, end?: string | null) {
  if (!start) return "Dates TBA";
  const a = niceDate(start);
  if (!end) return a;
  const b = niceDate(end);
  return a === b ? a : `${a} – ${b}`;
}

function completedTask(status: unknown) {
  return ["done", "complete", "completed"].includes(String(status ?? "").toLowerCase());
}

function selectedFromUrl(options: Option[]) {
  if (typeof window === "undefined") return null;
  const id = new URL(window.location.href).searchParams.get("prep");
  return id && options.some((option) => option.id === id) ? id : null;
}

export function Alpha8ConventionWorkspace() {
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentOption = useMemo(() => options.find((option) => option.id === selected) ?? null, [options, selected]);

  const loadOptions = useCallback(async () => {
    const res = await fetch("/api/alpha7/con-preps", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not load deployments");
    const items = json.items ?? [];
    setOptions(items);
    setSelected((old) => old || selectedFromUrl(items) || items[0]?.id || "");
  }, []);

  const loadSummary = useCallback(async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/alpha8/con-preps/${id}/summary`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not load convention workspace");
    setSummary(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOptions().catch((e) => { setError(e.message); setLoading(false); });
  }, [loadOptions]);

  useEffect(() => {
    if (!selected) return;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("prep", selected);
      window.history.replaceState({}, "", url.toString());
    }
    loadSummary(selected).catch((e) => { setError(e.message); setLoading(false); });
  }, [selected, loadSummary]);

  if (!currentOption) {
    return (
      <section className="rounded-3xl border border-white/10 bg-[#0c1727] p-6 text-sm text-slate-400">
        {error || "Loading Convention Ops…"}
      </section>
    );
  }

  const event = summary?.event ?? currentOption.event;
  const prep = summary?.prep;
  const metrics = summary?.metrics;
  const readiness = Number(prep?.readiness_score ?? 0);
  const hotel = summary?.hotels?.[0] ?? null;
  const badge = summary?.registrations?.[0] ?? null;
  const packingSummary = metrics ? `${metrics.packedCount}/${metrics.packingTotal} packed` : "Loading packing…";
  const tasksSummary = metrics ? `${metrics.openTaskCount} open${metrics.nextTask?.due_at ? ` · next ${niceDate(metrics.nextTask.due_at)}` : ""}` : "Loading tasks…";
  const travelSummary = hotel
    ? `${hotel.hotel_name}${hotel.checkin_at ? ` · ${niceDate(hotel.checkin_at)}` : ""}${badge ? ` · badge ${badge.status}` : ""}`
    : `${summary?.travel?.length ?? 0} travel · ${summary?.hotels?.length ?? 0} hotel`;

  return (
    <section className="grid gap-5">
      <header className="overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#101b2e] via-[#111a2d] to-[#19192e] shadow-[0_28px_80px_rgba(0,0,0,.18)]">
        <div className="p-5 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-300">v26 Alpha 8 · Convention Ops</div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">Convention Workspace</h1>
            </div>
            <button type="button" onClick={() => document.getElementById("alpha8-legacy")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300">
              Advanced tools
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#07101b] px-4 py-3.5 text-base font-bold text-white outline-none focus:border-cyan-300/40">
              {options.map((option, index) => (
                <option key={option.id} value={option.id}>{index === 0 ? "NEXT — " : ""}{option.event?.title ?? "Untitled deployment"}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => document.getElementById("alpha8-chaos")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-white">Ask Chaos</button>
              <button type="button" onClick={() => document.getElementById("alpha8-next-stop")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="rounded-xl bg-cyan-300 px-4 py-3 text-xs font-black text-slate-950">Share Card</button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-white/8 pt-5">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">{event?.title ?? "Deployment"}</h2>
              <div className="mt-2 text-sm text-slate-400">{dateRange(event?.start_at, event?.end_at)}{event?.location ? ` · ${event.location}` : ""}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-cyan-300/10 px-3 py-1.5 font-bold text-cyan-100">{metrics?.openTaskCount ?? 0} open tasks</span>
                <span className="rounded-full bg-violet-400/10 px-3 py-1.5 font-bold text-violet-100">{packingSummary}</span>
                {hotel ? <span className="rounded-full bg-pink-400/10 px-3 py-1.5 font-bold text-pink-100">{hotel.hotel_name}</span> : null}
                {metrics ? <span className="rounded-full bg-amber-300/10 px-3 py-1.5 font-bold text-amber-100">{money(metrics.totalCostCents)} planned</span> : null}
              </div>
            </div>

            <div className="text-right">
              <div className="text-4xl font-black text-cyan-300">{readiness}%</div>
              <div className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Deployment ready</div>
            </div>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</div> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,.75fr)] lg:items-start">
        <main className="grid gap-4">
          <DisclosureCard title="Readiness" summary={prep?.ai_summary || `${readiness}% ready · ${metrics?.openTaskCount ?? 0} open tasks`} defaultOpen>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/[0.035] p-4"><div className="text-3xl font-black text-cyan-300">{readiness}%</div><div className="mt-1 text-xs text-slate-500">Ready</div></div>
              <div className="rounded-2xl bg-white/[0.035] p-4"><div className="text-3xl font-black text-white">{metrics?.openTaskCount ?? "—"}</div><div className="mt-1 text-xs text-slate-500">Open tasks</div></div>
              <div className="rounded-2xl bg-white/[0.035] p-4"><div className="text-lg font-black text-white">{prep?.status ?? "planning"}</div><div className="mt-1 text-xs text-slate-500">Deployment state</div></div>
            </div>
            {prep?.ai_summary ? <p className="mt-4 text-sm leading-6 text-slate-300">{prep.ai_summary}</p> : null}
          </DisclosureCard>

          <DisclosureCard title="Packing & Loadouts" summary={packingSummary} badge={metrics?.packingTotal ? `${Math.round((metrics.packedCount / metrics.packingTotal) * 100)}%` : undefined}>
            <div className="grid gap-2">
              {(summary?.packing ?? []).slice(0, 18).map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white/[0.025] px-3 py-2.5 text-sm">
                  <span className={`h-4 w-4 rounded border ${item.packed ? "border-cyan-300 bg-cyan-300" : "border-white/20"}`} />
                  <span className={item.packed ? "text-slate-500 line-through" : "text-slate-200"}>{item.label}</span>
                  {item.quantity > 1 ? <span className="ml-auto text-xs text-slate-500">×{item.quantity}</span> : null}
                </div>
              ))}
              {!(summary?.packing?.length) ? <div className="text-sm text-slate-500">No packing items yet.</div> : null}
            </div>
          </DisclosureCard>

          <DisclosureCard title="Tasks & Subtasks" summary={tasksSummary} defaultOpen>
            <div className="grid gap-2">
              {(summary?.tasks ?? []).slice(0, 16).map((task) => (
                <div key={task.id} className="rounded-xl bg-white/[0.025] px-3 py-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${completedTask(task.status) ? "border-cyan-300 bg-cyan-300" : "border-white/20"}`} />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-bold ${completedTask(task.status) ? "text-slate-500 line-through" : "text-slate-200"}`}>{task.title}</div>
                      {task.due_at ? <div className="mt-1 text-xs text-slate-500">Due {niceDate(task.due_at)}</div> : null}
                    </div>
                  </div>
                </div>
              ))}
              {!(summary?.tasks?.length) ? <div className="text-sm text-slate-500">No prep tasks yet.</div> : null}
            </div>
          </DisclosureCard>

          <DisclosureCard title="Travel, Hotel & Badge" summary={travelSummary} defaultOpen>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/[0.03] p-4">
                <div className="text-[11px] font-black uppercase tracking-[.16em] text-pink-300">Hotel</div>
                {hotel ? <><div className="mt-2 text-base font-black text-white">{hotel.hotel_name}</div><div className="mt-1 text-xs leading-5 text-slate-400">{hotel.checkin_at ? `${niceDate(hotel.checkin_at)} → ${niceDate(hotel.checkout_at)}` : "Dates not set"}{hotel.cost_cents ? ` · ${money(hotel.cost_cents)}` : ""}</div></> : <div className="mt-2 text-sm text-slate-500">No hotel attached.</div>}
              </div>
              <div className="rounded-2xl bg-white/[0.03] p-4">
                <div className="text-[11px] font-black uppercase tracking-[.16em] text-violet-300">Badge</div>
                {badge ? <><div className="mt-2 text-base font-black text-white">{badge.badge_name}</div><div className="mt-1 text-xs text-slate-400">{badge.status}{badge.cost_cents ? ` · ${money(badge.cost_cents)}` : ""}</div></> : <div className="mt-2 text-sm text-slate-500">No registration record.</div>}
              </div>
            </div>
            {(summary?.travel ?? []).length ? <div className="mt-3 grid gap-2">{summary!.travel.map((segment) => <div key={segment.id} className="rounded-xl bg-white/[0.025] p-3 text-sm text-slate-300"><strong className="text-white">{segment.kind}</strong>{segment.provider ? ` · ${segment.provider}` : ""}{segment.origin || segment.destination ? ` · ${segment.origin ?? "?"} → ${segment.destination ?? "?"}` : ""}</div>)}</div> : null}
          </DisclosureCard>

          <DisclosureCard title="Budget & Costs" summary={metrics ? `${money(metrics.totalCostCents)} planned · ${money(metrics.paidCostCents)} paid` : "Loading costs…"}>
            <div className="grid gap-2">
              {(summary?.costs ?? []).map((cost) => (
                <div key={cost.id} className="flex items-center gap-3 rounded-xl bg-white/[0.025] px-3 py-3 text-sm">
                  <div className="min-w-0 flex-1"><div className="font-bold text-white">{cost.description || cost.vendor || cost.category}</div><div className="mt-1 text-xs text-slate-500">{cost.category} · {cost.cost_status}</div></div>
                  <div className="font-black text-amber-200">{money(cost.amount_cents)}</div>
                </div>
              ))}
              {!(summary?.costs?.length) ? <div className="text-sm text-slate-500">No costs logged yet.</div> : null}
            </div>
          </DisclosureCard>

          <DisclosureCard title="Event Notes & Programming" summary={event?.find_me_notes || prep?.notes || "No notes added"}>
            <div className="grid gap-4 text-sm leading-6 text-slate-300">
              {event?.appearance_mode ? <div><span className="font-black text-cyan-300">Appearance:</span> {event.appearance_mode}</div> : null}
              {event?.find_me_notes ? <div><span className="font-black text-cyan-300">How to find Dusk:</span><div className="mt-1 whitespace-pre-wrap">{event.find_me_notes}</div></div> : null}
              {prep?.notes ? <div><span className="font-black text-cyan-300">Prep notes:</span><div className="mt-1 whitespace-pre-wrap">{prep.notes}</div></div> : null}
            </div>
          </DisclosureCard>
        </main>

        <aside className="grid gap-4 lg:sticky lg:top-4">
          <div className="rounded-3xl border border-white/10 bg-[#0c1727] p-5"><Alpha8ChaosCard conPrepId={selected} /></div>
          {event?.id ? <div className="rounded-3xl border border-white/10 bg-[#0c1727] p-5"><Alpha8NextStopCard eventId={event.id} /></div> : null}
          <div className="rounded-3xl border border-white/10 bg-[#0c1727] p-5">
            <div className="text-sm font-black text-white">Quick details</div>
            <dl className="mt-3 grid gap-3 text-xs">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Status</dt><dd className="font-bold text-slate-200">{prep?.status ?? currentOption.status}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Dates</dt><dd className="text-right font-bold text-slate-200">{dateRange(event?.start_at, event?.end_at)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Location</dt><dd className="text-right font-bold text-slate-200">{event?.location ?? "TBA"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Packing</dt><dd className="font-bold text-slate-200">{packingSummary}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Budget</dt><dd className="font-bold text-slate-200">{metrics ? money(metrics.totalCostCents) : "—"}</dd></div>
            </dl>
          </div>
        </aside>
      </div>

      {loading ? <div className="fixed bottom-5 right-5 rounded-full border border-white/10 bg-[#07101b]/95 px-4 py-2 text-xs font-bold text-slate-300 shadow-2xl backdrop-blur">Updating workspace…</div> : null}
    </section>
  );
}
