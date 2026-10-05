"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceSheet } from "@/components/alpha8/WorkspaceSheet";
import { PastEventSheet } from "./PastEventSheet";

type Scope = "upcoming" | "past" | "all";

function date(value?: string | null) {
  if (!value) return "TBA";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function suiting(mode?: string) {
  if (mode === "fullsuiting") return "🐺 Fullsuiting";
  if (mode === "partialing") return "🐾 Partialing";
  return "Not suiting";
}

export function UnifiedEventsPage() {
  const router = useRouter();
  const search = useSearchParams();

  const initialScope = (
    ["upcoming", "past", "all"].includes(search.get("scope") ?? "")
      ? search.get("scope")
      : "upcoming"
  ) as Scope;

  const [scope, setScope] = useState<Scope>(initialScope);
  const [query, setQuery] = useState(search.get("q") ?? "");
  const [tag, setTag] = useState(search.get("tag") ?? "");
  const [items, setItems] = useState<any[]>([]);
  const [addChoice, setAddChoice] = useState(false);
  const [addPast, setAddPast] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("scope", scope);
    if (tag) params.set("tag", tag);
    if (query.trim()) params.set("q", query.trim());

    const res = await fetch(`/api/alpha92/events?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not load events.");
    setItems(json.items ?? []);
  }, [scope, tag, query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      load().catch((e) => setError(e.message));
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (scope !== "upcoming") params.set("scope", scope);
    if (tag) params.set("tag", tag);
    if (query.trim()) params.set("q", query.trim());

    const suffix = params.toString();
    window.history.replaceState(
      {},
      "",
      `/dashboard/events${suffix ? `?${suffix}` : ""}`,
    );
  }, [scope, tag, query]);

  const knownTags = useMemo(() => {
    const all = new Set<string>();
    items.forEach((item) =>
      (item.event.tags ?? []).forEach((value: string) => all.add(value)),
    );
    return [...all].sort();
  }, [items]);

  async function openUpcoming(item: any) {
    if (item.prep?.id) {
      router.push(`/dashboard/con-prep?prep=${item.prep.id}`);
      return;
    }

    const res = await fetch(`/api/alpha92/events/${item.event.id}/ops`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not start Convention Ops.");
      return;
    }

    router.push(`/dashboard/con-prep?prep=${json.prep.id}`);
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 p-5 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">
            Dusk Induskries
          </div>
          <h1 className="mt-1 text-3xl font-black text-white">Events</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            One event lifecycle: upcoming events open in Convention Ops; past
            events become Case Studies in Chaos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAddChoice(true)}
          className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950"
        >
          + Add Event
        </button>
      </header>

      <section className="grid gap-4 rounded-3xl border border-white/10 bg-[#0c1727] p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {(["upcoming", "past", "all"] as Scope[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              className={
                scope === value
                  ? "rounded-full bg-cyan-300 px-4 py-2 text-xs font-black capitalize text-slate-950"
                  : "rounded-full bg-white/[0.05] px-4 py-2 text-xs font-black capitalize text-slate-300"
              }
            >
              {value}
            </button>
          ))}

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events…"
            className="min-w-52 flex-1 rounded-xl border border-white/10 bg-[#07101b] px-3 py-2.5 text-sm text-white"
          />
        </div>

        {(tag || knownTags.length) ? (
          <div className="flex flex-wrap gap-1.5">
            {tag ? (
              <button
                type="button"
                onClick={() => setTag("")}
                className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black text-cyan-200"
              >
                × {tag}
              </button>
            ) : null}
            {!tag
              ? knownTags.slice(0, 14).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setTag(value);
                      setScope("all");
                    }}
                    className="rounded-full bg-white/[0.045] px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-cyan-200"
                  >
                    {value}
                  </button>
                ))
              : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.event.id}
            className="grid min-h-64 gap-4 rounded-3xl border border-white/10 bg-[#0c1727] p-5"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div
                    className={`text-[10px] font-black uppercase tracking-[.18em] ${
                      item.lifecycle === "upcoming"
                        ? "text-cyan-300"
                        : "text-violet-300"
                    }`}
                  >
                    {item.lifecycle === "upcoming"
                      ? "Upcoming Deployment"
                      : "Past Event"}
                  </div>
                  <h2 className="mt-1 text-xl font-black text-white">
                    {item.event.title}
                  </h2>
                </div>

                {item.lifecycle === "upcoming" && item.prep ? (
                  <div className="text-right">
                    <div className="text-xl font-black text-cyan-300">
                      {item.prep.readiness_score ?? 0}%
                    </div>
                    <div className="text-[9px] uppercase text-slate-600">
                      ready
                    </div>
                  </div>
                ) : item.lifecycle === "past" ? (
                  <div className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[10px] font-black text-violet-200">
                    {item.mediaCount} media
                  </div>
                ) : null}
              </div>

              <div className="mt-2 text-sm text-slate-500">
                {date(item.event.start_at)}
                {item.event.location ? ` · ${item.event.location}` : ""}
              </div>

              <div className="mt-2 text-xs text-slate-500">
                {suiting(item.event.suiting_mode)}
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {(item.event.tags ?? []).map((eventTag: string) => (
                  <button
                    key={eventTag}
                    type="button"
                    onClick={() => {
                      setTag(eventTag);
                      setScope("all");
                    }}
                    className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-cyan-200"
                  >
                    {eventTag}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto">
              {item.lifecycle === "upcoming" ? (
                <button
                  type="button"
                  onClick={() => openUpcoming(item)}
                  className="w-full rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950"
                >
                  {item.prep ? "Open Convention Ops" : "Start Convention Ops"}
                </button>
              ) : (
                <Link
                  href={`/dashboard/events/${item.event.id}`}
                  className="block w-full rounded-xl bg-violet-400 px-4 py-2.5 text-center text-sm font-black text-white"
                >
                  {item.caseStudy ? "Open Case Study" : "Build Case Study"}
                </Link>
              )}
            </div>
          </article>
        ))}
      </section>

      {!items.length && !error ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          No events match this view.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {addChoice ? (
        <WorkspaceSheet
          title="Add Event"
          subtitle="Choose the workflow that matches where the event is in its lifecycle."
          onClose={() => setAddChoice(false)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setAddChoice(false);
                router.push("/dashboard/con-prep?add=1");
              }}
              className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5 text-left"
            >
              <div className="text-xs font-black uppercase tracking-[.16em] text-cyan-300">
                Upcoming
              </div>
              <div className="mt-2 text-lg font-black text-white">
                Upcoming Deployment
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Search the convention, create its Ops workspace, then plan
                packing, travel, schedule, budget, reminders, and Next Stop.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setAddChoice(false);
                setAddPast(true);
              }}
              className="rounded-3xl border border-violet-300/20 bg-violet-400/[0.06] p-5 text-left"
            >
              <div className="text-xs font-black uppercase tracking-[.16em] text-violet-300">
                Retroactive
              </div>
              <div className="mt-2 text-lg font-black text-white">
                Past Event
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Add something that already happened and go straight into its
                Case Study and Media workspace.
              </div>
            </button>
          </div>
        </WorkspaceSheet>
      ) : null}

      {addPast ? <PastEventSheet onClose={() => setAddPast(false)} /> : null}
    </main>
  );
}
