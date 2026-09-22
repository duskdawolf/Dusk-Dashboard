"use client";

import { FormEvent, useMemo, useState } from "react";
import type { EventType } from "@/types";

type DashboardEvent = {
  id: string;
  slug: string;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  state_code: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  tag: string | null;
  event_type: EventType;
  quarter: "q1" | "q2" | "q3" | "q4";
  published: boolean;
};

type Draft = {
  id?: string;
  title: string;
  slug: string;
  startAt: string;
  endAt: string;
  location: string;
  stateCode: string;
  latitude: string;
  longitude: string;
  description: string;
  tag: string;
  eventType: EventType;
  published: boolean;
};

const EMPTY: Draft = {
  title: "",
  slug: "",
  startAt: "",
  endAt: "",
  location: "",
  stateCode: "",
  latitude: "",
  longitude: "",
  description: "",
  tag: "Event",
  eventType: "meetup",
  published: true,
};

function rowToDraft(row: DashboardEvent): Draft {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    startAt: row.start_at,
    endAt: row.end_at ?? "",
    location: row.location ?? "",
    stateCode: row.state_code ?? "",
    latitude: row.latitude?.toString() ?? "",
    longitude: row.longitude?.toString() ?? "",
    description: row.description ?? "",
    tag: row.tag ?? "Event",
    eventType: row.event_type,
    published: row.published,
  };
}

export function EventManager({
  initialEvents,
}: {
  initialEvents: DashboardEvent[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [status, setStatus] = useState("");

  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      ),
    [events]
  );

  function edit(row: DashboardEvent) {
    setDraft(rowToDraft(row));
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setDraft(EMPTY);
    setStatus("");
  }

  async function refresh() {
    const response = await fetch("/api/admin/events", { cache: "no-store" });
    const body = await response.json();

    if (!response.ok) {
      setStatus(body.error ?? "Could not refresh events.");
      return;
    }

    setEvents(body.events ?? []);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus(draft.id ? "Updating event..." : "Creating event...");

    const payload = {
      ...(draft.id ? { id: draft.id } : {}),
      title: draft.title,
      slug: draft.slug,
      startAt: draft.startAt,
      endAt: draft.endAt || null,
      location: draft.location,
      stateCode: draft.stateCode,
      latitude: draft.latitude ? Number(draft.latitude) : null,
      longitude: draft.longitude ? Number(draft.longitude) : null,
      description: draft.description,
      tag: draft.tag,
      eventType: draft.eventType,
      published: draft.published,
    };

    const response = await fetch("/api/admin/events", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Could not save event.");
      return;
    }

    setStatus(draft.id ? "Event updated." : "Event created.");
    setDraft(EMPTY);
    await refresh();
  }

  async function remove(row: DashboardEvent) {
    const confirmed = window.confirm(`Delete ${row.title}?`);
    if (!confirmed) return;

    setStatus(`Deleting ${row.title}...`);

    const response = await fetch("/api/admin/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Could not delete event.");
      return;
    }

    setStatus("Event deleted.");
    if (draft.id === row.id) reset();
    await refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
      <section className="panel self-start xl:sticky xl:top-28">
        <div className="eyebrow">{draft.id ? "Edit deployment" : "New deployment"}</div>
        <h2 className="text-2xl font-black">
          {draft.id ? draft.title || "Edit event" : "Add event"}
        </h2>

        <form onSubmit={save} className="mt-5 space-y-4">
          <label className="form-label">
            Title
            <input
              className="form-input"
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>

          <label className="form-label">
            Slug
            <input
              className="form-input"
              value={draft.slug}
              placeholder="Auto-generated if left blank"
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            />
          </label>

          <label className="form-label">
            Start time (ISO 8601 with local offset)
            <input
              className="form-input"
              required
              placeholder="2026-10-17T10:00:00-04:00"
              value={draft.startAt}
              onChange={(e) => setDraft({ ...draft, startAt: e.target.value })}
            />
          </label>

          <label className="form-label">
            End time
            <input
              className="form-input"
              placeholder="2026-10-17T17:00:00-04:00"
              value={draft.endAt}
              onChange={(e) => setDraft({ ...draft, endAt: e.target.value })}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-label">
              Location
              <input
                className="form-input"
                placeholder="Portsmouth, RI"
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              />
            </label>

            <label className="form-label">
              State
              <input
                className="form-input"
                placeholder="RI"
                value={draft.stateCode}
                onChange={(e) =>
                  setDraft({ ...draft, stateCode: e.target.value.toUpperCase() })
                }
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-label">
              Latitude
              <input
                className="form-input"
                inputMode="decimal"
                placeholder="41.6023"
                value={draft.latitude}
                onChange={(e) => setDraft({ ...draft, latitude: e.target.value })}
              />
            </label>

            <label className="form-label">
              Longitude
              <input
                className="form-input"
                inputMode="decimal"
                placeholder="-71.2503"
                value={draft.longitude}
                onChange={(e) => setDraft({ ...draft, longitude: e.target.value })}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-label">
              Event type
              <select
                className="form-input"
                value={draft.eventType}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    eventType: e.target.value as EventType,
                  })
                }
              >
                <option value="convention">Convention</option>
                <option value="meetup">Meetup</option>
                <option value="hosting">Hosting / Programming</option>
                <option value="public">Public Event</option>
              </select>
            </label>

            <label className="form-label">
              Display tag
              <input
                className="form-input"
                value={draft.tag}
                onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
              />
            </label>
          </div>

          <label className="form-label">
            Description
            <textarea
              className="form-input min-h-28"
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>

          <label className="flex items-center gap-3 text-sm font-bold">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) =>
                setDraft({ ...draft, published: e.target.checked })
              }
            />
            Published on duskdawolf.com
          </label>

          <div className="flex flex-wrap gap-3">
            <button className="button-primary" type="submit">
              {draft.id ? "Save changes" : "Create event"}
            </button>
            {draft.id ? (
              <button className="button-secondary" type="button" onClick={reset}>
                Cancel
              </button>
            ) : null}
          </div>

          {status ? <p className="text-sm text-slate-400">{status}</p> : null}
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Database source of truth</div>
            <h2 className="text-3xl font-black">Recorded Events</h2>
          </div>
          <button className="button-secondary" type="button" onClick={refresh}>
            Refresh
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="panel text-slate-400">
            No database events yet. Run the schema + seed SQL, or create the
            first deployment here.
          </div>
        ) : (
          sorted.map((row) => (
            <article key={row.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="tag !mt-0">{row.event_type}</span>
                    <span className="tag !mt-0">
                      {row.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-black">{row.title}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {new Date(row.start_at).toLocaleString()}
                    {row.location ? ` • ${row.location}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {row.latitude !== null && row.longitude !== null
                      ? `Map: ${row.latitude}, ${row.longitude}`
                      : "No map coordinates yet"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => edit(row)}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-xl border border-dusk-pink/30 bg-dusk-pink/10 px-4 py-3 font-black"
                    type="button"
                    onClick={() => remove(row)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
