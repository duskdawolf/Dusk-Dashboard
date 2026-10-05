"use client";

import { FormEvent, useState } from "react";
import { WorkspaceSheet } from "./WorkspaceSheet";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
        event_type: String(data.get("event_type") ?? "convention"),
        tag: String(data.get("tag") ?? "Convention"),
        event_theme: String(data.get("event_theme") ?? "").trim() || null,
        appearance_mode:
          String(data.get("appearance_mode") ?? "").trim() || null,
        notes: String(data.get("notes") ?? "").trim() || null,
        route_visible: true,
        status: "planning",
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add deployment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceSheet
      title="Add Deployment"
      subtitle="Creates the event and its Convention Ops workspace together."
      onClose={props.onClose}
    >
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Event name
          </span>
          <input
            name="title"
            required
            className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Starts
            </span>
            <input
              name="start_at"
              type="datetime-local"
              required
              className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Ends
            </span>
            <input
              name="end_at"
              type="datetime-local"
              className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Location
            </span>
            <input
              name="location"
              className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              State
            </span>
            <input
              name="state_code"
              placeholder="CT"
              className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Event type
            </span>
            <select
              name="event_type"
              defaultValue="convention"
              className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
            >
              <option value="convention">Convention</option>
              <option value="hosting">Hosting</option>
              <option value="meetup">Meetup</option>
              <option value="public">Public event</option>
              <option value="performance">Performance</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Tag
            </span>
            <input
              name="tag"
              defaultValue="Convention"
              className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
            />
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Theme
          </span>
          <input
            name="event_theme"
            placeholder="Rock 'N' Roll Nightmare"
            className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Appearance
          </span>
          <input
            name="appearance_mode"
            placeholder="Fullsuit + panel host + nightlife"
            className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Prep notes
          </span>
          <textarea
            name="notes"
            className="min-h-24 rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
          />
        </label>

        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Add Deployment"}
          </button>
        </div>
      </form>
    </WorkspaceSheet>
  );
}
