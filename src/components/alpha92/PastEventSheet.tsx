"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceSheet } from "@/components/alpha8/WorkspaceSheet";
import { TagInput } from "@/components/alpha91/TagInput";

function iso(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function tags(value: FormDataEntryValue | null) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export function PastEventSheet(props: { onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const startAt = iso(form.get("start_at"));
      const eventTags = tags(form.get("tags"));

      const res = await fetch("/api/alpha92/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "past",
          title: String(form.get("title") ?? "").trim(),
          start_at: startAt,
          end_at: iso(form.get("end_at")),
          location: String(form.get("location") ?? "").trim() || null,
          state_code: String(form.get("state_code") ?? "").trim() || null,
          event_type: String(form.get("event_type") ?? "convention"),
          tags: eventTags,
          event_theme:
            String(form.get("event_theme") ?? "").trim() || null,
          description:
            String(form.get("description") ?? "").trim() || null,
          suiting_mode: String(form.get("suiting_mode") ?? "not_suiting"),
          published: true,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not add past event.");

      router.push(`/dashboard/events/${json.event.id}`);
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add past event.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceSheet
      title="Add Past Event"
      subtitle="Retroactive entry skips planning tools and starts directly as a Case Study."
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
              Started
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
              Ended
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
              placeholder="FL"
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
              <option value="meetup">Meetup</option>
              <option value="hosting">Hosting</option>
              <option value="public">Public event</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Suiting?
            </span>
            <select
              name="suiting_mode"
              defaultValue="fullsuiting"
              className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
            >
              <option value="not_suiting">Not Suiting</option>
              <option value="partialing">Partialing</option>
              <option value="fullsuiting">Fullsuiting</option>
            </select>
          </label>
        </div>

        <TagInput name="tags" defaultTags="Convention" />

        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Theme
          </span>
          <input
            name="event_theme"
            className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Notes
          </span>
          <textarea
            name="description"
            className="min-h-24 rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
          />
        </label>

        {error ? (
          <div className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">
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
            {busy ? "Creating…" : "Create Case Study"}
          </button>
        </div>
      </form>
    </WorkspaceSheet>
  );
}
