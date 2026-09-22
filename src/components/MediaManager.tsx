"use client";

import { FormEvent, useState } from "react";

type EventOption = { id: string; title: string };
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
  const [status, setStatus] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/media", { cache: "no-store" });
    const body = await response.json();

    if (response.ok) setItems(body.media ?? []);
    else setStatus(body.error ?? "Could not refresh media.");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Uploading...");
    const form = event.currentTarget;
    const formData = new FormData(form);

    const response = await fetch("/api/admin/media", {
      method: "POST",
      body: formData,
    });
    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Upload failed.");
      return;
    }

    setStatus("Uploaded.");
    form.reset();
    await refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this media item?")) return;

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

    setStatus("Deleted.");
    await refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[410px_1fr]">
      <section className="panel self-start xl:sticky xl:top-28">
        <div className="eyebrow">Supabase Storage</div>
        <h2 className="text-2xl font-black">Upload Media</h2>

        <form onSubmit={upload} className="mt-5 space-y-4">
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
            Event
            <select className="form-input" name="eventId" defaultValue="">
              <option value="">No event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
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
            Upload
          </button>

          {status ? <p className="text-sm text-slate-400">{status}</p> : null}
        </form>
      </section>

      <section>
        <div className="eyebrow">Content library</div>
        <h2 className="text-3xl font-black">Media</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="card overflow-hidden">
              <div className="aspect-video overflow-hidden rounded-xl bg-black/30">
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
              </div>

              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <strong>{item.title}</strong>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                    {item.kind} · {item.published ? "published" : "draft"}
                  </p>
                </div>
                <button
                  className="rounded-lg border border-dusk-pink/30 bg-dusk-pink/10 px-3 py-2 text-xs font-black"
                  type="button"
                  onClick={() => remove(item.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
