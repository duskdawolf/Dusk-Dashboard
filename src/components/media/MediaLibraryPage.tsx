"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { MediaLibraryItem } from "./MediaLibraryPicker";

export function MediaLibraryPage() {
  const [items, setItems] = useState<MediaLibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/alpha91/media", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not load media.");
    setItems(json.items ?? []);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/alpha91/media", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");
      event.currentTarget.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, changes: Record<string, unknown>) {
    const res = await fetch("/api/alpha91/media", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...changes }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not update media.");
    await load();
  }

  async function remove(item: MediaLibraryItem) {
    if (!window.confirm(`Delete "${item.title}" from Media Library?`)) return;
    const res = await fetch("/api/alpha91/media", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not delete media.");
    await load();
  }

  const needle = query.trim().toLowerCase();
  const filtered = items.filter(
    (item) =>
      !needle ||
      item.title.toLowerCase().includes(needle) ||
      (item.tags ?? []).some((tag) => tag.toLowerCase().includes(needle)),
  );

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 p-5 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">
            Dusk Induskries
          </div>
          <h1 className="mt-1 text-3xl font-black text-white">Media Library</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Upload photos, schedule screenshots, Dusk art, and video once. Reuse
            them from other tools instead of uploading the same file repeatedly.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/settings/brand/media"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-200"
          >
            Use for Brand
          </Link>
          <Link
            href="/dashboard/con-prep"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-200"
          >
            Deployment Ops
          </Link>
        </div>
      </header>

      <form
        onSubmit={upload}
        className="grid gap-3 rounded-3xl border border-white/10 bg-[#0c1727] p-5"
      >
        <div className="text-sm font-black text-white">Add media</div>
        <input
          name="file"
          type="file"
          required
          accept="image/*,video/mp4,video/quicktime,video/webm"
          className="text-sm text-slate-300"
        />
        <div className="grid gap-3 md:grid-cols-3">
          <input name="title" placeholder="Title" className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
          <input name="tags" placeholder="dusk, furpoc, schedule" className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
          <input name="caption" placeholder="Caption / notes" className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-fit rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload to Library"}
        </button>
      </form>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search media or tags…"
        className="rounded-2xl border border-white/10 bg-[#0c1727] px-4 py-3 text-white"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c1727]"
          >
            {item.kind === "image" ? (
              <img
                src={item.url}
                alt={item.alt_text || item.title}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <video
                src={item.url}
                controls
                className="aspect-square w-full object-cover"
              />
            )}

            <div className="grid gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">
                    {item.title}
                  </div>
                  {(item.tags ?? []).length ? (
                    <div className="mt-1 text-[10px] text-slate-500">
                      {(item.tags ?? []).join(", ")}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    patch(item.id, { favorite: !item.favorite }).catch((e) =>
                      setError(e.message),
                    )
                  }
                  className="text-lg"
                >
                  {item.favorite ? "★" : "☆"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(item.url)}
                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-300"
                >
                  Copy URL
                </button>
                <button
                  type="button"
                  onClick={() =>
                    remove(item).catch((e) => setError(e.message))
                  }
                  className="rounded-lg bg-red-400/10 px-2.5 py-1.5 text-[11px] font-bold text-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
    </main>
  );
}
