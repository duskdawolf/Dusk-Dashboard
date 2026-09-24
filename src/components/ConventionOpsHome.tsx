"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type CatalogItem = {
  id: string;
  slug: string;
  name: string;
  abbreviation?: string | null;
  edition_year?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  timezone: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  website_url?: string | null;
  source_url?: string | null;
  attendance_rank?: number | null;
  latest_attendance?: number | null;
  latest_attendance_year?: number | null;
  verification_status?: string | null;
};

type Prep = {
  id: string;
  readiness_score?: number | null;
  status: string;
  events?: {
    id: string;
    slug: string;
    title: string;
    start_at: string;
    end_at?: string | null;
    location?: string | null;
  } | null;
  packing_items?: Array<{
    id: string;
    packed: boolean;
    required?: boolean;
    parent_item_id?: string | null;
  }>;
  prep_tasks?: Array<{
    id: string;
    status: string;
    required?: boolean;
    parent_task_id?: string | null;
  }>;
};

function dateLabel(item: CatalogItem) {
  if (!item.start_date) return "Dates not loaded yet";

  const start = new Date(`${item.start_date}T12:00:00Z`);
  const end = new Date(
    `${item.end_date ?? item.start_date}T12:00:00Z`,
  );

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return item.start_date === (item.end_date ?? item.start_date)
    ? formatter.format(start)
    : `${formatter.format(start)} – ${formatter.format(end)}`;
}

function documentType(startAt?: string | null) {
  if (!startAt) return "Deployment";
  return new Date(startAt).getTime() > Date.now()
    ? "Tactical Deployment Plan"
    : "Incident Report";
}

function authorityLabel(item: CatalogItem) {
  if (item.verification_status === "official") return "Official";
  if (item.verification_status === "wikifur") return "WikiFur";
  return "Manual";
}

function locationLabel(item: CatalogItem) {
  return [item.city, item.region, item.country]
    .filter(Boolean)
    .join(", ") || "Location pending";
}

function leafCount<T extends { id: string }>(
  items: T[],
  parentKey: keyof T,
) {
  return items.filter(
    (item) =>
      !items.some(
        (candidate) =>
          candidate[parentKey] === item.id,
      ),
  );
}

export function ConventionOpsHome({
  initialCatalog,
  initialPreps,
}: {
  initialCatalog: CatalogItem[];
  initialPreps: Prep[];
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [preps] = useState(initialPreps);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [dateDrafts, setDateDrafts] = useState<
    Record<string, { startDate: string; endDate: string }>
  >({});

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return catalog;

    return catalog.filter((item) =>
      [
        item.name,
        item.abbreviation,
        item.city,
        item.region,
        item.country,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(needle),
        ),
    );
  }, [catalog, query]);

  async function reloadCatalog() {
    const response = await fetch("/api/admin/conventions", {
      cache: "no-store",
    });
    const body = await response.json();

    if (response.ok) {
      setCatalog(body.conventions ?? []);
      return true;
    }

    setStatus(
      body.detail ??
        body.error ??
        "Could not refresh convention catalog.",
    );
    return false;
  }

  async function syncWikiFur() {
    setSyncing(true);
    setStatus("Refreshing the WikiFur attendance-ranked catalog...");

    const response = await fetch(
      "/api/admin/conventions/sync",
      { method: "POST" },
    );
    const body = await response.json();

    setSyncing(false);

    if (!response.ok) {
      setStatus(
        body.detail ??
          body.error ??
          "Could not sync WikiFur catalog.",
      );
      return;
    }

    await reloadCatalog();
    setStatus(
      `WikiFur catalog refreshed: ${body.upserted ?? 0} entries updated; ${
        body.preservedOfficial ?? 0
      } official-source records preserved.`,
    );
  }

  async function deploy(item: CatalogItem) {
    const draft = dateDrafts[item.id] ?? {
      startDate: "",
      endDate: "",
    };
    const startDate =
      item.start_date || draft.startDate || null;
    const endDate =
      item.end_date ||
      draft.endDate ||
      draft.startDate ||
      null;

    if (!startDate || !endDate) {
      setStatus(
        `${item.name} does not have current dates in the catalog yet. Add the dates before deploying it.`,
      );
      return;
    }

    setDeployingId(item.id);
    setStatus(`Spinning up ${item.name}...`);

    const response = await fetch(
      "/api/admin/conventions/deploy",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "catalog",
          catalogId: item.id,
          startDate,
          endDate,
        }),
      },
    );
    const body = await response.json();
    setDeployingId(null);

    if (!response.ok) {
      setStatus(body.error ?? "Could not create deployment.");
      return;
    }

    window.location.href = `/dashboard/con-prep/${body.prepId}`;
  }

  async function manualDeploy(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus("Creating manual deployment...");

    const response = await fetch(
      "/api/admin/conventions/deploy",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          name: String(data.get("name") ?? ""),
          startDate: String(data.get("startDate") ?? ""),
          endDate: String(data.get("endDate") ?? ""),
          location: String(data.get("location") ?? ""),
        }),
      },
    );

    const body = await response.json();

    if (!response.ok) {
      setStatus(
        body.error ?? "Could not create manual deployment.",
      );
      return;
    }

    window.location.href = `/dashboard/con-prep/${body.prepId}`;
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-dusk-aqua/25 bg-[radial-gradient(circle_at_top_left,rgba(97,232,255,.12),transparent_45%),#091321] p-6">
        <div className="eyebrow">
          v26 Alpha · Convention Operations + Chaos Copilot™
        </div>
        <h1 className="mt-2 text-4xl font-black tracking-[-.05em] sm:text-6xl">
          Deployment Command
        </h1>
        <p className="mt-3 max-w-4xl text-slate-400">
          Pick a convention, hit{" "}
          <strong className="text-white">I&apos;M GOING</strong>,
          and Dusk creates the event, Tactical Deployment Plan,
          Convention Ops workspace, baseline loadouts, nested tasks,
          readiness tracking, and a deployment-scoped Chaos Copilot™
          context.
        </p>

        <div className="mt-5 rounded-2xl border border-dusk-gold/20 bg-dusk-gold/5 p-4 text-sm text-slate-300">
          <strong>Catalog authority:</strong> official convention
          website/social → WikiFur → other/manual sources. WikiFur&apos;s
          in-person attendance list defines the pre-populated catalog
          order; official con sources win whenever Dusk has a verified
          conflict.
        </div>

        {status ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
            {status}
          </div>
        ) : null}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Active operations</div>
            <h2 className="text-3xl font-black">My Deployments</h2>
          </div>
          <span className="tag !mt-0">
            {preps.length} deployment{preps.length === 1 ? "" : "s"}
          </span>
        </div>

        {preps.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {preps.map((prep) => {
              const packing = prep.packing_items ?? [];
              const leafPacking = leafCount(
                packing,
                "parent_item_id",
              );
              const tasks = prep.prep_tasks ?? [];
              const leafTasks = leafCount(
                tasks,
                "parent_task_id",
              );
              const packed = leafPacking.filter(
                (item) => item.packed,
              ).length;
              const tasksDone = leafTasks.filter((task) =>
                ["done", "skipped"].includes(task.status),
              ).length;

              return (
                <Link
                  href={`/dashboard/con-prep/${prep.id}`}
                  key={prep.id}
                  className="panel block transition hover:-translate-y-1 hover:border-dusk-aqua/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="eyebrow">
                        {documentType(prep.events?.start_at)}
                      </div>
                      <h3 className="text-2xl font-black">
                        {prep.events?.title ??
                          "Convention Deployment"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {prep.events?.location ??
                          "Location pending"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-dusk-aqua">
                        {prep.readiness_score ?? 0}%
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                        ready
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-dusk-aqua"
                      style={{
                        width: `${Math.max(
                          2,
                          Math.min(
                            100,
                            prep.readiness_score ?? 0,
                          ),
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <div className="text-xs uppercase text-slate-600">
                        Packing
                      </div>
                      <strong>
                        {packed}/{leafPacking.length}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <div className="text-xs uppercase text-slate-600">
                        Tasks
                      </div>
                      <strong>
                        {tasksDone}/{leafTasks.length}
                      </strong>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="panel mt-5 text-slate-400">
            No deployments yet. Pick a convention below and tell
            Dusk you&apos;re going.
          </div>
        )}
      </section>

      <section className="panel">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">
              WikiFur attendance-ranked convention catalog
            </div>
            <h2 className="text-3xl font-black">
              Find the next incident.
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              The pre-populated list follows WikiFur&apos;s ongoing
              in-person convention attendance ranking. Announced future
              dates are included where the WikiFur Upcoming Events list
              has them; otherwise you can supply the dates before easy-add.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="tag !mt-0">
              {catalog.length} catalog entries
            </span>
            <button
              className="button-secondary"
              type="button"
              disabled={syncing}
              onClick={syncWikiFur}
            >
              {syncing ? "SYNCING..." : "Refresh WikiFur"}
            </button>
          </div>
        </div>

        <input
          className="form-input mt-5"
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Search convention, city, state, country..."
        />

        <div className="mt-5 max-h-[760px] space-y-3 overflow-y-auto pr-1">
          {filtered.map((item) => {
            const draft = dateDrafts[item.id] ?? {
              startDate: "",
              endDate: "",
            };

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.attendance_rank ? (
                        <span className="tag !mt-0">
                          WikiFur #{item.attendance_rank}
                        </span>
                      ) : null}
                      <span
                        className={`tag !mt-0 ${
                          item.verification_status === "official"
                            ? "!border-dusk-aqua/30 !text-dusk-aqua"
                            : ""
                        }`}
                      >
                        {authorityLabel(item)}
                      </span>
                      {item.latest_attendance ? (
                        <span className="text-xs text-slate-500">
                          {item.latest_attendance.toLocaleString()} attendees
                          {item.latest_attendance_year
                            ? ` · ${item.latest_attendance_year}`
                            : ""}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-2 text-xl font-black">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {locationLabel(item)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {dateLabel(item)}
                      {item.venue_name
                        ? ` · ${item.venue_name}`
                        : ""}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3">
                      {item.website_url ? (
                        <a
                          className="text-xs font-black text-dusk-aqua"
                          href={item.website_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Official source ↗
                        </a>
                      ) : null}
                      {item.source_url ? (
                        <a
                          className="text-xs font-black text-slate-500"
                          href={item.source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.verification_status === "wikifur"
                            ? "WikiFur source ↗"
                            : "Source ↗"}
                        </a>
                      ) : null}
                    </div>

                    {!item.start_date ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <label className="form-label">
                          Start date for this deployment
                          <input
                            className="form-input"
                            type="date"
                            value={draft.startDate}
                            onChange={(event) =>
                              setDateDrafts((current) => ({
                                ...current,
                                [item.id]: {
                                  ...draft,
                                  startDate:
                                    event.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                        <label className="form-label">
                          End date
                          <input
                            className="form-input"
                            type="date"
                            value={draft.endDate}
                            onChange={(event) =>
                              setDateDrafts((current) => ({
                                ...current,
                                [item.id]: {
                                  ...draft,
                                  endDate:
                                    event.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>

                  <button
                    className="button-primary shrink-0"
                    type="button"
                    disabled={
                      deployingId === item.id ||
                      (!item.start_date &&
                        !draft.startDate)
                    }
                    onClick={() => deploy(item)}
                  >
                    {deployingId === item.id
                      ? "DEPLOYING..."
                      : "I'M GOING"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="eyebrow">Manual deployment</div>
        <h2 className="text-2xl font-black">
          Not in the catalog? Deploy it manually.
        </h2>

        <form
          className="mt-5 grid gap-4 lg:grid-cols-2"
          onSubmit={manualDeploy}
        >
          <label className="form-label lg:col-span-2">
            Convention / event name
            <input
              className="form-input"
              name="name"
              required
            />
          </label>
          <label className="form-label">
            Start date
            <input
              className="form-input"
              name="startDate"
              type="date"
              required
            />
          </label>
          <label className="form-label">
            End date
            <input
              className="form-input"
              name="endDate"
              type="date"
              required
            />
          </label>
          <label className="form-label lg:col-span-2">
            Location
            <input
              className="form-input"
              name="location"
              placeholder="City, state / region"
              required
            />
          </label>
          <button
            className="button-primary lg:col-span-2"
            type="submit"
          >
            CREATE TACTICAL DEPLOYMENT
          </button>
        </form>
      </section>
    </div>
  );
}
