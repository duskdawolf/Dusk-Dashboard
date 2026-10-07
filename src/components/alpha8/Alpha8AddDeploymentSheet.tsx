"use client";

import { FormEvent, useState } from "react";
import { WorkspaceSheet } from "./WorkspaceSheet";
import { EditionPicker } from "@/components/convention-directory/EditionPicker";
import type { PublicEdition } from "@/lib/convention-directory/model";
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
  const [eventType, setEventType] = useState("convention");
  const [found, setFound] = useState<PublicEdition | null>(null);
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
        event_type: eventType,
        convention_edition_id: eventType === "convention" ? found?.id : null,
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
      subtitle="Select an official Convention Edition or plan another kind of event."
      onClose={props.onClose}
    >
      <div className="grid gap-5">
        <label className="grid gap-2">
          Deployment type
          <select
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setFound(null);
            }}
            className="rounded-xl border border-white/10 bg-[#07101b] p-3"
          >
            <option value="convention">Convention</option>
            <option value="public">Other Event</option>
            <option value="meetup">Other Event · Meetup</option>
            <option value="hosting">Other Event · Hosting</option>
          </select>
        </label>
        {eventType === "convention" ? (
          <EditionPicker selected={found} onSelect={setFound} />
        ) : null}

        <form
          key={JSON.stringify(found)}
          onSubmit={submit}
          className="grid gap-4"
        >
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Event name
            </span>
            <input
              name="title"
              readOnly={eventType === "convention"}
              required
              defaultValue={found?.name ?? ""}
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
                readOnly={eventType === "convention"}
                type="datetime-local"
                required
                defaultValue={
                  found?.date_precision === "date_only" && found.start_at
                    ? `${found.start_at.slice(0, 10)}T00:00`
                    : localDateTime(found?.start_at)
                }
                className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Ends
              </span>
              <input
                name="end_at"
                readOnly={eventType === "convention"}
                type="datetime-local"
                defaultValue={
                  found?.date_precision === "date_only" && found.end_at
                    ? `${found.end_at.slice(0, 10)}T00:00`
                    : localDateTime(found?.end_at)
                }
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
                readOnly={eventType === "convention"}
                defaultValue={found?.location ?? ""}
                className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                State
              </span>
              <input
                name="state_code"
                defaultValue={""}
                placeholder="CT"
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
              readOnly={eventType === "convention"}
              defaultValue={found?.theme ?? ""}
              className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
            />
          </label>

          <TagInput
            name="tags"
            defaultTags={eventType === "convention" ? "Convention" : "Event"}
          />

          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Suiting?
            </span>
            <select
              name="suiting_mode"
              defaultValue="not_suiting"
              className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
            >
              <option value="not_suiting">Not Suiting</option>
              <option value="partialing">Partialing</option>
              <option value="fullsuiting">Fullsuiting</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Description
            </span>
            <textarea
              name="description"
              defaultValue={""}
              className="min-h-20 rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
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
              disabled={busy || (eventType === "convention" && !found)}
              className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Add Deployment"}
            </button>
          </div>
        </form>
      </div>
    </WorkspaceSheet>
  );
}
