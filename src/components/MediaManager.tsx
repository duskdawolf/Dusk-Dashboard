"use client";

import { FormEvent, useMemo, useState } from "react";

type EventOption = {
  id: string;
  title: string;
  slug: string;
  start_at: string;
};

type MediaRow = {
  id: string;
  title: string;
  kind: "image" | "video";
  url: string;
  storage_path: string | null;
  mime_type: string | null;
  alt_text: string | null;
  caption: string | null;
  event_id: string | null;
  sort_order: number;
  published: boolean;
  created_at: string;
};

export function MediaManager({
  initialMedia,
  events,
}: {
  initialMedia: MediaRow[];
  events: EventOption[];
}) {
  const [items, setItems] = useState(initialMedia);
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const [status, setStatus] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const selectedEvent = events.find((event) => event.id === selectedEventId);

  const eventItems = useMemo(
    () =>
      items
        .filter((item) => item.event_id === selectedEventId)
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order ||
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
    [items, selectedEventId],
  );

  const unassigned = items.filter((item) => !item.event_id);
  const cover = eventItems.find((item) => item.kind === "image") ?? eventItems[0];

  async function refresh() {
    const response = await fetch("/api/admin/media", { cache: "no-store" });
    const body = await response.json();

    if (response.ok) setItems(body.media ?? []);
    else setStatus(body.error ?? "Could not refresh media.");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Uploading evidence...");
    const form = event.currentTarget;
    const formData = new FormData(form);

    if (!formData.get("eventId") && selectedEventId) {
      formData.set("eventId", selectedEventId);
    }

    const response = await fetch("/api/admin/media", {
      method: "POST",
      body: formData,
    });
    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Upload failed.");
      return;
    }

    setStatus("Evidence archived.");
    form.reset();
    await refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this evidence file?")) return;

    const response = await fetch("/api/admin/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Delete failed.");
      return;
    }

    setStatus("Evidence deleted.");
    await refresh();
  }

  async function updateItem(
    id: string,
    patch: {
      title?: string;
      caption?: string | null;
      altText?: string | null;
      published?: boolean;
      eventId?: string | null;
    },
  ) {
    const response = await fetch("/api/admin/media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, ...patch }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Update failed.");
      return;
    }

    setStatus("Evidence updated.");
    await refresh();
  }

  async function persistOrder(orderedIds: string[]) {
    if (!selectedEventId || !orderedIds.length) return;

    const response = await fetch("/api/admin/media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reorder",
        eventId: selectedEventId,
        orderedIds,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Reorder failed.");
      return;
    }

    setStatus("Evidence order saved.");
    await refresh();
  }

  async function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId) return;

    const ids = eventItems.map((item) => item.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);

    if (from < 0 || to < 0) return;

    const reordered = [...ids];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setDraggedId(null);

    setItems((current) =>
      current.map((item) => {
        const index = reordered.indexOf(item.id);
        return index >= 0 ? { ...item, sort_order: index } : item;
      }),
    );

    await persistOrder(reordered);
  }

  async function setCover(id: string) {
    if (!selectedEventId) return;

    const response = await fetch("/api/admin/media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "setCover",
        eventId: selectedEventId,
        id,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Could not set cover.");
      return;
    }

    setStatus("Cover image promoted to the front of the evidence stack.");
    await refresh();
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="eyebrow">Event evidence command center</div>
            <h2 className="text-3xl font-black">Media by Deployment</h2>
          </div>

          <label className="form-label min-w-[280px]">
            Active event
            <select
              className="form-input"
              value={selectedEventId}
              onChange={(event) => {
                setSelectedEventId(event.target.value);
                setStatus("");
              }}
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {new Date(event.start_at).toLocaleDateString()} · {event.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <aside className="space-y-6 self-start xl:sticky xl:top-28">
          <section className="panel">
            <div className="eyebrow">Current public lead image</div>
            <h3 className="text-xl font-black">
              {selectedEvent?.title ?? "Select an event"}
            </h3>

            <div className="mt-4 aspect-video overflow-hidden rounded-2xl border border-white/5 bg-[#07101b]">
              {cover ? (
                cover.kind === "image" ? (
                  <img
                    src={cover.url}
                    alt={cover.alt_text ?? cover.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <video
                    src={cover.url}
                    muted
                    className="h-full w-full object-cover"
                  />
                )
              ) : (
                <div className="grid h-full place-items-center text-sm text-slate-600">
                  No evidence yet
                </div>
              )}
            </div>

            {selectedEvent ? (
              <a
                className="button-secondary mt-4 inline-flex"
                href={`/chaos/${selectedEvent.slug}`}
                target="_blank"
              >
                Preview {new Date(selectedEvent.start_at).getTime() > Date.now()
                  ? "Tactical Deployment Plan"
                  : "Incident Report"} ↗
              </a>
            ) : null}
          </section>

          <section className="panel">
            <div className="eyebrow">Supabase evidence intake</div>
            <h3 className="text-xl font-black">Upload to Event</h3>

            <form onSubmit={upload} className="mt-5 space-y-4">
              <input type="hidden" name="eventId" value={selectedEventId} />

              <label className="form-label">
                File
                <input
                  className="form-input"
                  name="file"
                  type="file"
                  accept="image/*,video/*"
                  required
                />
              </label>

              <label className="form-label">
                Title
                <input className="form-input" name="title" required />
              </label>

              <label className="form-label">
                Alt text
                <input className="form-input" name="altText" />
              </label>

              <label className="form-label">
                Caption / notes
                <textarea className="form-input min-h-24" name="caption" />
              </label>

              <label className="flex items-center gap-3 text-sm font-bold">
                <input name="published" type="checkbox" defaultChecked />
                Show publicly
              </label>

              <button className="button-primary" type="submit">
                Archive evidence
              </button>

              {status ? (
                <p className="text-sm text-slate-400">{status}</p>
              ) : null}
            </form>
          </section>
        </aside>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Evidence sequence</div>
              <h3 className="text-3xl font-black">
                {eventItems.length} file{eventItems.length === 1 ? "" : "s"}
              </h3>
            </div>
            <p className="max-w-md text-right text-sm text-slate-500">
              Drag cards to reorder the public evidence gallery. The first image
              is used as the event cover unless the formal Case Study specifies one.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {eventItems.map((item, index) => (
              <article
                key={item.id}
                draggable
                onDragStart={() => setDraggedId(item.id)}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropOn(item.id)}
                className={`card overflow-hidden transition ${
                  draggedId === item.id
                    ? "scale-[.98] border-dusk-aqua/50 opacity-60"
                    : ""
                }`}
              >
                <div className="relative aspect-video overflow-hidden rounded-xl bg-black/30">
                  {item.kind === "image" ? (
                    <img
                      src={item.url}
                      alt={item.alt_text ?? item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      src={item.url}
                      controls
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  )}

                  <div className="absolute left-3 top-3 flex gap-2">
                    <span className="rounded-full bg-[#07101b]/90 px-2.5 py-1 text-xs font-black backdrop-blur">
                      #{index + 1}
                    </span>
                    {index === 0 && item.kind === "image" ? (
                      <span className="rounded-full border border-dusk-gold/30 bg-[#07101b]/90 px-2.5 py-1 text-xs font-black text-dusk-gold backdrop-blur">
                        COVER
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    className="form-input font-bold"
                    defaultValue={item.title}
                    onBlur={(event) => {
                      if (event.target.value !== item.title) {
                        updateItem(item.id, { title: event.target.value });
                      }
                    }}
                  />

                  <textarea
                    className="form-input mt-3 min-h-20"
                    defaultValue={item.caption ?? ""}
                    placeholder="Caption / evidence notes"
                    onBlur={(event) => {
                      if (event.target.value !== (item.caption ?? "")) {
                        updateItem(item.id, {
                          caption: event.target.value || null,
                        });
                      }
                    }}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      className="button-secondary"
                      href={`/dashboard/posts?eventId=${selectedEventId}&mediaId=${item.id}`}
                    >
                      Create post
                    </a>

                    {item.kind === "image" && index !== 0 ? (
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => setCover(item.id)}
                      >
                        Make cover
                      </button>
                    ) : null}

                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() =>
                        updateItem(item.id, { published: !item.published })
                      }
                    >
                      {item.published ? "Hide publicly" : "Publish"}
                    </button>

                    <button
                      className="rounded-xl border border-dusk-pink/30 bg-dusk-pink/10 px-3 py-2 text-xs font-black"
                      type="button"
                      onClick={() => remove(item.id)}
                    >
                      Delete
                    </button>
                  </div>

                  <p className="mt-3 text-xs uppercase tracking-wide text-slate-600">
                    {item.kind} · {item.published ? "public" : "private"} · drag to reorder
                  </p>
                </div>
              </article>
            ))}
          </div>

          {unassigned.length ? (
            <div className="mt-10">
              <div className="eyebrow">Orphaned evidence</div>
              <h3 className="text-xl font-black">Not Assigned to an Event</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {unassigned.map((item) => (
                  <div key={item.id} className="card">
                    <strong>{item.title}</strong>
                    <select
                      className="form-input mt-3"
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value) {
                          updateItem(item.id, { eventId: event.target.value });
                        }
                      }}
                    >
                      <option value="">Assign to event...</option>
                      {events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
