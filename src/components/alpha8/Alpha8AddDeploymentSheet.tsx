"use client";

import { FormEvent, useState } from "react";
import { WorkspaceSheet } from "./WorkspaceSheet";
import { TagInput } from "@/components/alpha91/TagInput";

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseTags(value: FormDataEntryValue | null) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function iso(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export function Alpha8AddDeploymentSheet(props: {
  onClose: () => void;
  onCreated: (prepId: string) => Promise<void> | void;
}) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<any | null>(null);
  const [sources, setSources] = useState<Array<{ title: string; url: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function discover() {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      const res = await fetch("/api/alpha9/deployments/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not find event.");
      setFound(json.found);
      setSources(json.sources ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find event.");
    } finally {
      setSearching(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const data = new FormData(event.currentTarget);
      const payload = {
        title: String(data.get("title") ?? "").trim(),
        start_at: iso(data.get("start_at")),
        end_at: iso(data.get("end_at")),
        location: String(data.get("location") ?? "").trim() || null,
        state_code: String(data.get("state_code") ?? "").trim() || null,
        event_type: "convention",
        tags: parseTags(data.get("tags")),
        tag: parseTags(data.get("tags"))[0] ?? "Convention",
        event_theme: String(data.get("event_theme") ?? "").trim() || null,
        description: String(data.get("description") ?? "").trim() || null,
        route_visible: true,
        status: "planning",
        suiting_mode: String(data.get("suiting_mode") ?? "not_suiting"),
      };

      const res = await fetch("/api/alpha8/deployments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not add deployment.");

      await props.onCreated(json.prep.id);
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add deployment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceSheet
      title="Add Deployment"
      subtitle="Search official convention information first, then confirm it."
      onClose={props.onClose}
    >
      <div className="grid gap-5">
        <div className="rounded-2xl bg-white/[0.035] p-4">
          <div className="text-xs font-black uppercase tracking-wider text-cyan-300">
            Find convention
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="FurPocalypse 2026"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
            />
            <button
              type="button"
              disabled={searching || !query.trim()}
              onClick={discover}
              className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
            >
              {searching ? "Searching…" : "Find"}
            </button>
          </div>
          {sources.length ? (
            <div className="mt-3 text-xs text-slate-500">
              Sources:{" "}
              {sources.map((source, index) => (
                <span key={source.url}>
                  {index ? " · " : ""}
                  <a href={source.url} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
                    {source.title}
                  </a>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <form key={JSON.stringify(found)} onSubmit={submit} className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Event name</span>
            <input name="title" required defaultValue={found?.title ?? query} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Starts</span>
              <input name="start_at" type="datetime-local" required defaultValue={localDateTime(found?.start_at)} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Ends</span>
              <input name="end_at" type="datetime-local" defaultValue={localDateTime(found?.end_at)} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Location</span>
              <input name="location" defaultValue={found?.location ?? ""} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">State</span>
              <input name="state_code" defaultValue={found?.state_code ?? ""} placeholder="CT" className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Theme</span>
            <input name="event_theme" defaultValue={found?.event_theme ?? ""} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
          </label>

          <TagInput
            name="tags"
            defaultTags="Convention"
          />

          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Suiting?</span>
            <select name="suiting_mode" defaultValue="not_suiting" className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white">
              <option value="not_suiting">Not Suiting</option>
              <option value="partialing">Partialing</option>
              <option value="fullsuiting">Fullsuiting</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Description</span>
            <textarea name="description" defaultValue={found?.description ?? ""} className="min-h-20 rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
          </label>

          {error ? <div className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</div> : null}

          <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
            <button type="button" onClick={props.onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-300">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:opacity-50">
              {busy ? "Creating…" : "Add Deployment"}
            </button>
          </div>
        </form>
      </div>
    </WorkspaceSheet>
  );
}
