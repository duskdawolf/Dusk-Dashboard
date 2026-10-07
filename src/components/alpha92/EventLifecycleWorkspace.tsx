"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DisclosureCard } from "@/components/alpha8/DisclosureCard";
import { CaseStudyEditor } from "./CaseStudyEditor";
import { CaseStudyMediaManager } from "./CaseStudyMediaManager";

function date(value?: string | null) {
  if (!value) return "TBA";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((cents || 0) / 100);
}

function suiting(mode?: string) {
  if (mode === "fullsuiting") return "🐺 Fullsuiting";
  if (mode === "partialing") return "🐾 Partialing";
  return "Not suiting";
}

export function EventLifecycleWorkspace({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/alpha92/events/${eventId}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not load event.");
    setData(json);
  }, [eventId]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function ensureCaseStudy() {
    const res = await fetch(`/api/alpha92/events/${eventId}/case-study`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not create Case Study.");
    await load();
  }

  async function openOps() {
    if (data.prep?.id) {
      router.push(`/dashboard/con-prep?prep=${data.prep.id}`);
      return;
    }

    const res = await fetch(`/api/alpha92/events/${eventId}/ops`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not start Ops.");
    router.push(`/dashboard/con-prep?prep=${json.prep.id}`);
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-sm text-slate-400">
        {error || "Loading event…"}
      </main>
    );
  }

  const { event, lifecycle, prep, caseStudy, media, subEvents, costs } = data;
  const paid = (costs ?? [])
    .filter((item: any) => item.cost_status === "paid")
    .reduce(
      (total: number, item: any) => total + Number(item.amount_cents ?? 0),
      0,
    );

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-5 p-5 md:p-8">
      <header className="rounded-[32px] border border-white/10 bg-gradient-to-br from-[#101b2e] via-[#111a2d] to-[#19192e] p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link
              href="/dashboard/events"
              className="text-xs font-black uppercase tracking-[.16em] text-cyan-300"
            >
              ← Events
            </Link>
            <div className="mt-4 text-[10px] font-black uppercase tracking-[.2em] text-violet-300">
              {lifecycle === "past" ? "Past Event · Case Study" : "Upcoming Deployment"}
            </div>
            <h1 className="mt-1 text-3xl font-black text-white md:text-4xl">
              {event.title}
            </h1>
            <div className="mt-2 text-sm text-slate-400">
              {date(event.start_at)}
              {event.end_at ? ` – ${date(event.end_at)}` : ""}
              {event.location ? ` · ${event.location}` : ""}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(event.tags ?? []).map((tag: string) => (
                <Link
                  key={tag}
                  href={`/dashboard/events?scope=all&tag=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-black text-slate-300 hover:text-cyan-200"
                >
                  {tag}
                </Link>
              ))}
              <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[10px] font-black text-violet-200">
                {suiting(event.suiting_mode)}
              </span>
            </div>
          </div>

          {lifecycle === "upcoming" ? (
            <button
              type="button"
              onClick={() => openOps().catch((e) => setError(e.message))}
              className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950"
            >
              Open Deployment Ops
            </button>
          ) : (
            <div className="text-right">
              <div className="text-3xl font-black text-violet-300">
                {media.length}
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Case Study media
              </div>
            </div>
          )}
        </div>
      </header>

      {error ? (
        <div className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {lifecycle === "upcoming" ? (
        <section className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.04] p-6">
          <h2 className="text-xl font-black text-white">
            This event is still upcoming.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Planning belongs in Deployment Ops. After the end date passes, the
            same event record automatically appears under Past Events and this
            page becomes its Case Study workspace.
          </p>
          <button
            type="button"
            onClick={() => openOps().catch((e) => setError(e.message))}
            className="mt-4 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950"
          >
            {prep ? "Continue Planning" : "Start Deployment Ops"}
          </button>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)] lg:items-start">
          <section className="grid gap-4">
            <DisclosureCard
              title="Case Study"
              summary={
                caseStudy
                  ? `${caseStudy.status}${caseStudy.published ? " · published" : " · draft"}`
                  : "Create the retrospective"
              }
              defaultOpen
            >
              {caseStudy ? (
                <CaseStudyEditor
                  eventId={eventId}
                  caseStudy={caseStudy}
                  onChanged={load}
                />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    ensureCaseStudy().catch((e) => setError(e.message))
                  }
                  className="rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-black text-white"
                >
                  Create Case Study
                </button>
              )}
            </DisclosureCard>

            <DisclosureCard
              title="Media"
              summary={`${media.length} attached · reusable from Media Library`}
              defaultOpen
            >
              <CaseStudyMediaManager
                eventId={eventId}
                attachments={media}
                onChanged={load}
              />
            </DisclosureCard>

            <DisclosureCard
              title="What Happened"
              summary={`${subEvents.length} schedule items retained from the deployment`}
            >
              <div className="grid gap-2">
                {subEvents.map((item: any) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-white/[0.025] p-3"
                  >
                    <div className="text-sm font-black text-white">
                      {item.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Intl.DateTimeFormat("en-US", {
                        weekday: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(item.starts_at))}
                      {item.room ? ` · ${item.room}` : ""}
                      {item.attendance_status
                        ? ` · ${item.attendance_status}`
                        : ""}
                    </div>
                  </div>
                ))}
                {!subEvents.length ? (
                  <div className="text-sm text-slate-500">
                    No retained schedule items for this event.
                  </div>
                ) : null}
              </div>
            </DisclosureCard>
          </section>

          <aside className="grid gap-4 lg:sticky lg:top-5">
            {caseStudy?.image_url ? (
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c1727]">
                <img
                  src={caseStudy.image_url}
                  alt={caseStudy.title}
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="p-4">
                  <div className="text-xs font-black uppercase tracking-wider text-cyan-300">
                    Case Study Hero
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    Set automatically from the featured Case Study image.
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-3xl border border-white/10 bg-[#0c1727] p-5">
              <div className="text-sm font-black text-white">
                Deployment archive
              </div>
              <dl className="mt-4 grid gap-3 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Media</dt>
                  <dd className="font-bold text-slate-200">{media.length}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Schedule items</dt>
                  <dd className="font-bold text-slate-200">
                    {subEvents.length}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Paid costs</dt>
                  <dd className="font-bold text-slate-200">{money(paid)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Ops history</dt>
                  <dd className="font-bold text-slate-200">
                    {prep ? "retained" : "retroactive entry"}
                  </dd>
                </div>
              </dl>
            </div>

            <Link
              href="/dashboard/media"
              className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-center text-xs font-black text-slate-300"
            >
              Open Media Library
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
