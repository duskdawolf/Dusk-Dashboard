"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function date(value?: string | null) {
  if (!value) return "TBA";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function DeploymentListPage() {
  const params = useSearchParams();
  const tag = params.get("tag") ?? "";
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const suffix = tag ? `?tag=${encodeURIComponent(tag)}` : "";
    fetch(`/api/alpha91/deployments${suffix}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load deployments.");
        setItems(json.items ?? []);
      })
      .catch((e) => setError(e.message));
  }, [tag]);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 p-5 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">
            Convention Ops
          </div>
          <h1 className="mt-1 text-3xl font-black text-white">
            Deployments{tag ? ` · ${tag}` : ""}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {tag ? `Filtered to “${tag}”.` : "Every convention deployment."}
          </p>
        </div>
        <Link
          href="/dashboard/con-prep"
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-200"
        >
          Back to Workspace
        </Link>
      </header>

      {tag ? (
        <Link
          href="/dashboard/con-prep/deployments"
          className="w-fit rounded-full bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-200"
        >
          × Clear {tag}
        </Link>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map(({ event, prep }) => (
          <article
            key={event.id}
            className="rounded-3xl border border-white/10 bg-[#0c1727] p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">{event.title}</h2>
                <div className="mt-1 text-sm text-slate-500">
                  {date(event.start_at)}
                  {event.location ? ` · ${event.location}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-cyan-300">
                  {prep.readiness_score ?? 0}%
                </div>
                <div className="text-[10px] uppercase text-slate-600">ready</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {(event.tags ?? []).map((eventTag: string) => (
                <Link
                  key={eventTag}
                  href={`/dashboard/con-prep/deployments?tag=${encodeURIComponent(
                    eventTag,
                  )}`}
                  className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-cyan-200"
                >
                  {eventTag}
                </Link>
              ))}
            </div>

            <Link
              href={`/dashboard/con-prep?prep=${prep.id}`}
              className="mt-5 inline-flex rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950"
            >
              Open Deployment
            </Link>
          </article>
        ))}
      </div>

      {!items.length && !error ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
          No deployments match this filter.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
    </main>
  );
}
