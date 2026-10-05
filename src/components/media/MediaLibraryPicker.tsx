"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { WorkspaceSheet } from "@/components/alpha8/WorkspaceSheet";

export type MediaLibraryItem = {
  id: string;
  title: string;
  kind: "image" | "video";
  url: string;
  caption?: string | null;
  alt_text?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  tags?: string[];
  favorite?: boolean;
};

export function MediaLibraryPicker(props: {
  open: boolean;
  kind?: "image" | "video";
  title?: string;
  onClose: () => void;
  onSelect: (item: MediaLibraryItem) => void | Promise<void>;
}) {
  const [items, setItems] = useState<MediaLibraryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const suffix = props.kind ? `?kind=${props.kind}` : "";
    const res = await fetch(`/api/alpha91/media${suffix}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not load media.");
    setItems(json.items ?? []);
  }, [props.kind]);

  useEffect(() => {
    if (props.open) load().catch((e) => setError(e.message));
  }, [props.open, load]);

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

  if (!props.open) return null;

  const needle = query.trim().toLowerCase();
  const filtered = items.filter(
    (item) =>
      !needle ||
      item.title.toLowerCase().includes(needle) ||
      (item.tags ?? []).some((tag) => tag.toLowerCase().includes(needle)),
  );

  return (
    <WorkspaceSheet
      title={props.title ?? "Media Library"}
      subtitle="Pick an existing asset or upload it once for reuse everywhere."
      onClose={props.onClose}
    >
      <div className="grid gap-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search media or tags…"
          className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={async () => {
                await props.onSelect(item);
                props.onClose();
              }}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] text-left"
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
                  muted
                  className="aspect-square w-full object-cover"
                />
              )}
              <div className="p-2.5">
                <div className="truncate text-xs font-black text-white">
                  {item.title}
                </div>
                {(item.tags ?? []).length ? (
                  <div className="mt-1 truncate text-[10px] text-slate-500">
                    {(item.tags ?? []).join(", ")}
                  </div>
                ) : null}
              </div>
            </button>
          ))}
        </div>

        <form
          onSubmit={upload}
          className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4"
        >
          <div className="text-xs font-black uppercase tracking-wider text-cyan-300">
            Upload once
          </div>
          <input
            name="file"
            type="file"
            required
            accept={
              props.kind === "image"
                ? "image/jpeg,image/png,image/webp,image/gif"
                : props.kind === "video"
                  ? "video/mp4,video/quicktime,video/webm"
                  : "image/*,video/mp4,video/quicktime,video/webm"
            }
            className="text-sm text-slate-300"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="title"
              placeholder="Title"
              className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-2.5 text-white"
            />
            <input
              name="tags"
              placeholder="tags, comma, separated"
              className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-2.5 text-white"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-fit rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Upload to Library"}
          </button>
        </form>

        {error ? (
          <div className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </WorkspaceSheet>
  );
}
