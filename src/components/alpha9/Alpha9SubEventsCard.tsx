"use client";

import { FormEvent, useState } from "react";
import { WorkspaceSheet } from "@/components/alpha8/WorkspaceSheet";

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function iso(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function timeLabel(value?: string | null) {
  if (!value) return "TBA";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function suitingLabel(mode: string, deploymentMode: string) {
  const resolved = mode === "inherit" ? deploymentMode : mode;
  if (resolved === "fullsuiting") return "Fullsuiting";
  if (resolved === "partialing") return "Partialing";
  return "Not suiting";
}

function Editor(props: {
  conPrepId: string;
  eventSuitingMode: string;
  record?: any | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const data = new FormData(event.currentTarget);
      const values = {
        title: String(data.get("title") ?? "").trim(),
        starts_at: iso(data.get("starts_at")),
        ends_at: iso(data.get("ends_at")),
        location: String(data.get("location") ?? "").trim() || null,
        room: String(data.get("room") ?? "").trim() || null,
        description:
          String(data.get("description") ?? "").trim() || null,
        attendance_status: String(
          data.get("attendance_status") ?? "going",
        ),
        suiting_mode: String(data.get("suiting_mode") ?? "inherit"),
        show_in_find_dusk: data.get("show_in_find_dusk") === "on",
        feature_on_next_stop:
          data.get("feature_on_next_stop") === "on",
        next_stop_priority: Number(data.get("next_stop_priority") ?? 0),
        reminder_enabled: data.get("reminder_enabled") === "on",
        reminder_minutes_before: Number(
          data.get("reminder_minutes_before") ?? 30,
        ),
        source: props.record?.source ?? "manual",
      };

      const res = await fetch(
        `/api/alpha9/con-preps/${props.conPrepId}/sub-events`,
        {
          method: props.record?.id ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: props.record?.id ?? null,
            values,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save sub-event.");

      await props.onSaved();
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save sub-event.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!props.record?.id) return;
    if (!window.confirm("Remove this sub-event?")) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/alpha9/con-preps/${props.conPrepId}/sub-events`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: props.record.id }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not remove sub-event.");
      await props.onSaved();
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove sub-event.");
    } finally {
      setBusy(false);
    }
  }

  const record = props.record ?? {};

  return (
    <WorkspaceSheet
      title={record.id ? "Edit Schedule Item" : "Add Schedule Item"}
      subtitle="Panels, dances, hosted programming, meetups, and anything else time-bound."
      onClose={props.onClose}
    >
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">Title</span>
          <input name="title" required defaultValue={record.title ?? ""} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Starts</span>
            <input name="starts_at" type="datetime-local" required defaultValue={localDateTime(record.starts_at)} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Ends</span>
            <input name="ends_at" type="datetime-local" defaultValue={localDateTime(record.ends_at)} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Location</span>
            <input name="location" defaultValue={record.location ?? ""} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Room</span>
            <input name="room" defaultValue={record.room ?? ""} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Role</span>
            <select name="attendance_status" defaultValue={record.attendance_status ?? "going"} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white">
              <option value="going">Going</option>
              <option value="maybe">Maybe</option>
              <option value="hosting">Hosting</option>
              <option value="performing">Performing</option>
              <option value="not_going">Not going</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Suiting?</span>
            <select name="suiting_mode" defaultValue={record.suiting_mode ?? "inherit"} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white">
              <option value="inherit">Use deployment default ({suitingLabel("inherit", props.eventSuitingMode)})</option>
              <option value="not_suiting">Not Suiting</option>
              <option value="partialing">Partialing</option>
              <option value="fullsuiting">Fullsuiting</option>
            </select>
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">Notes</span>
          <textarea name="description" defaultValue={record.description ?? ""} className="min-h-20 rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
        </label>

        <div className="grid gap-3 rounded-2xl bg-white/[0.035] p-4 text-sm text-slate-300">
          <label className="flex items-center gap-3">
            <input name="show_in_find_dusk" type="checkbox" defaultChecked={Boolean(record.show_in_find_dusk)} />
            Show in “Where to Find Dusk”
          </label>
          <label className="flex items-center gap-3">
            <input name="feature_on_next_stop" type="checkbox" defaultChecked={Boolean(record.feature_on_next_stop)} />
            Feature on Next Stop card
          </label>
          <label className="flex items-center gap-3">
            <input name="reminder_enabled" type="checkbox" defaultChecked={record.id ? Boolean(record.reminder_enabled) : true} />
            Notify me before it starts
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Reminder</span>
            <select name="reminder_minutes_before" defaultValue={record.reminder_minutes_before ?? 30} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white">
              <option value="10">10 minutes before</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="120">2 hours before</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Next Stop priority</span>
            <input name="next_stop_priority" type="number" defaultValue={record.next_stop_priority ?? 0} className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white" />
          </label>
        </div>

        {error ? <div className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</div> : null}

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div>
            {record.id ? (
              <button type="button" onClick={remove} disabled={busy} className="rounded-xl bg-red-400/10 px-4 py-2.5 text-sm font-black text-red-200">
                Remove
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={props.onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-slate-300">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </WorkspaceSheet>
  );
}

export function Alpha9SubEventsCard(props: {
  conPrepId: string;
  eventSuitingMode: string;
  subEvents: any[];
  onChanged: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<any | "new" | null>(null);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-black text-white">Schedule & Appearances</div>
          <div className="mt-1 text-xs text-slate-500">
            Structured schedule drives reminders, public appearances, and Next Stop.
          </div>
        </div>
        <button type="button" onClick={() => setEditing("new")} className="rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">
          + Add Schedule Item
        </button>
      </div>

      <div className="grid gap-2">
        {props.subEvents.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setEditing(item)}
            className="grid gap-2 rounded-2xl border border-white/8 bg-white/[0.025] p-3 text-left hover:bg-white/[0.045]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-black text-white">{item.title}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {timeLabel(item.starts_at)}
                  {item.room ? ` · ${item.room}` : item.location ? ` · ${item.location}` : ""}
                </div>
              </div>
              <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-black uppercase text-slate-300">
                {item.attendance_status}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
              <span className="rounded-full bg-violet-400/10 px-2 py-1 text-violet-200">
                {suitingLabel(item.suiting_mode, props.eventSuitingMode)}
              </span>
              {item.show_in_find_dusk ? (
                <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-cyan-100">Find Dusk</span>
              ) : null}
              {item.feature_on_next_stop ? (
                <span className="rounded-full bg-pink-400/10 px-2 py-1 text-pink-100">Next Stop</span>
              ) : null}
              {item.reminder_enabled ? (
                <span className="rounded-full bg-amber-300/10 px-2 py-1 text-amber-100">
                  {item.reminder_minutes_before}m reminder
                </span>
              ) : null}
            </div>
          </button>
        ))}
        {!props.subEvents.length ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
            No schedule items yet. Add them manually or give Chaos a screenshot from Sched.
          </div>
        ) : null}
      </div>

      {editing ? (
        <Editor
          conPrepId={props.conPrepId}
          eventSuitingMode={props.eventSuitingMode}
          record={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={props.onChanged}
        />
      ) : null}
    </div>
  );
}
