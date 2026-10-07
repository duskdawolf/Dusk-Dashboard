"use client";

import { EditionPicker } from "@/components/convention-directory/EditionPicker";
import type { PublicEdition } from "@/lib/convention-directory/model";
import { FormEvent, useMemo, useState } from "react";
import { WorkspaceSheet } from "./WorkspaceSheet";
import { TagInput } from "@/components/alpha91/TagInput";

export type EditorMode =
  | "event"
  | "readiness"
  | "packing"
  | "task"
  | "hotel"
  | "travel"
  | "registration"
  | "cost";

type Props = {
  conPrepId: string;
  mode: EditorMode;
  record?: any | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  tasks?: any[];
};

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isoOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function tagList(value: FormDataEntryValue | null) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function cents(value: FormDataEntryValue | null) {
  const number = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function Field(props: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  placeholder?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
        {props.label}
      </span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue ?? ""}
        placeholder={props.placeholder}
        required={props.required}
        step={props.step}
        className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
      />
    </label>
  );
}

function Area(props: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
        {props.label}
      </span>
      <textarea
        name={props.name}
        defaultValue={props.defaultValue ?? ""}
        placeholder={props.placeholder}
        className="min-h-24 rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
      />
    </label>
  );
}

function Select(props: {
  label: string;
  name: string;
  defaultValue?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
        {props.label}
      </span>
      <select
        name={props.name}
        defaultValue={props.defaultValue ?? ""}
        className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
      >
        {props.children}
      </select>
    </label>
  );
}

const modeTitle: Record<EditorMode, string> = {
  event: "Edit Event",
  readiness: "Edit Deployment Timing",
  packing: "Packing Item",
  task: "Prep Task",
  hotel: "Hotel",
  travel: "Travel Segment",
  registration: "Badge / Registration",
  cost: "Budget Item",
};

export function Alpha8WorkspaceEditor(props: Props) {
  const [eventType, setEventType] = useState(
    props.record?.event_type ?? "public",
  );
  const [edition, setEdition] = useState<PublicEdition | null>(null);
  const [changeEdition, setChangeEdition] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const creating = !props.record;

  const resource = useMemo(() => {
    if (props.mode === "readiness") return "prep";
    return props.mode;
  }, [props.mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const data = new FormData(event.currentTarget);
      let values: Record<string, unknown> = {};

      switch (props.mode) {
        case "event":
          values = {
            title: String(data.get("title") ?? "").trim(),
            start_at: isoOrNull(data.get("start_at")),
            end_at: isoOrNull(data.get("end_at")),
            location: String(data.get("location") ?? "").trim() || null,
            state_code: String(data.get("state_code") ?? "").trim() || null,
            event_type: eventType,
            convention_edition_id:
              eventType === "convention"
                ? (edition?.id ??
                  (changeEdition ? null : props.record?.convention_edition_id))
                : null,
            tags: tagList(data.get("tags")),
            tag: tagList(data.get("tags"))[0] ?? "Event",
            event_theme: String(data.get("event_theme") ?? "").trim() || null,
            appearance_mode:
              String(data.get("appearance_mode") ?? "").trim() || null,
            suiting_mode: String(data.get("suiting_mode") ?? "not_suiting"),
            description: String(data.get("description") ?? "").trim() || null,
            route_visible: data.get("route_visible") === "on",
          };
          break;

        case "readiness":
          values = {
            target_arrival_at: isoOrNull(data.get("target_arrival_at")),
            departure_at: isoOrNull(data.get("departure_at")),
            prep_deadline_at: isoOrNull(data.get("prep_deadline_at")),
            packing_deadline: isoOrNull(data.get("packing_deadline")),
            notes: String(data.get("notes") ?? "").trim() || null,
          };
          break;

        case "packing":
          values = {
            label: String(data.get("label") ?? "").trim(),
            category: String(data.get("category") ?? "general").trim(),
            quantity: Math.max(1, Number(data.get("quantity") ?? 1)),
            packed: data.get("packed") === "on",
            required: data.get("required") === "on",
            notes: String(data.get("notes") ?? "").trim() || null,
            sort_order: Number(data.get("sort_order") ?? 0),
            source: "manual",
          };
          break;

        case "task":
          values = {
            title: String(data.get("title") ?? "").trim(),
            task_type: String(data.get("task_type") ?? "prep").trim(),
            due_at: isoOrNull(data.get("due_at")),
            duration_minutes: Number(data.get("duration_minutes") ?? 0) || null,
            status: String(data.get("status") ?? "todo"),
            required: data.get("required") === "on",
            counts_toward_readiness:
              data.get("counts_toward_readiness") === "on",
            parent_task_id:
              String(data.get("parent_task_id") ?? "").trim() || null,
            notes: String(data.get("notes") ?? "").trim() || null,
            sort_order: Number(data.get("sort_order") ?? 0),
            source: "manual",
          };
          break;

        case "hotel":
          values = {
            hotel_name: String(data.get("hotel_name") ?? "").trim(),
            address: String(data.get("address") ?? "").trim() || null,
            confirmation_code:
              String(data.get("confirmation_code") ?? "").trim() || null,
            checkin_at: isoOrNull(data.get("checkin_at")),
            checkout_at: isoOrNull(data.get("checkout_at")),
            cost_cents: cents(data.get("cost")),
            currency: "USD",
          };
          break;

        case "travel":
          values = {
            kind: String(data.get("kind") ?? "other"),
            provider: String(data.get("provider") ?? "").trim() || null,
            confirmation_code:
              String(data.get("confirmation_code") ?? "").trim() || null,
            origin: String(data.get("origin") ?? "").trim() || null,
            destination: String(data.get("destination") ?? "").trim() || null,
            depart_at: isoOrNull(data.get("depart_at")),
            arrive_at: isoOrNull(data.get("arrive_at")),
            cost_cents: cents(data.get("cost")),
            currency: "USD",
            direction: String(data.get("direction") ?? "other"),
            car_mode: String(data.get("car_mode") ?? "").trim() || null,
            pickup_notes: String(data.get("pickup_notes") ?? "").trim() || null,
          };
          break;

        case "registration":
          values = {
            badge_name: String(data.get("badge_name") ?? "").trim(),
            status: String(data.get("status") ?? "needed"),
            cost_cents: cents(data.get("cost")),
            confirmation_code:
              String(data.get("confirmation_code") ?? "").trim() || null,
          };
          break;

        case "cost":
          values = {
            category: String(data.get("category") ?? "other").trim(),
            vendor: String(data.get("vendor") ?? "").trim() || null,
            description: String(data.get("description") ?? "").trim() || null,
            amount_cents: cents(data.get("amount")),
            currency: "USD",
            source: "manual",
            cost_status: String(data.get("cost_status") ?? "budgeted"),
          };
          break;
      }

      const res = await fetch(
        `/api/alpha8/con-preps/${props.conPrepId}/records`,
        {
          method:
            resource === "event" || resource === "prep" || !creating
              ? "PATCH"
              : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            resource,
            recordId: props.record?.id ?? null,
            values,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save changes.");

      await props.onSaved();
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!props.record?.id) return;
    if (!window.confirm("Remove this item? This cannot be undone.")) return;

    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/alpha8/con-preps/${props.conPrepId}/records`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            resource,
            recordId: props.record.id,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not remove item.");

      await props.onSaved();
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove item.");
    } finally {
      setBusy(false);
    }
  }

  const record = props.record ?? {};

  return (
    <WorkspaceSheet
      title={`${creating && !["event", "readiness"].includes(props.mode) ? "Add " : ""}${modeTitle[props.mode]}`}
      subtitle="Changes save directly to Convention Ops."
      onClose={props.onClose}
    >
      <form onSubmit={submit} className="grid gap-4">
        {props.mode === "event" ? (
          <>
            <Field
              label="Event name"
              name="title"
              required
              defaultValue={record.title}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Starts"
                name="start_at"
                type="datetime-local"
                required
                defaultValue={localDateTime(record.start_at)}
              />
              <Field
                label="Ends"
                name="end_at"
                type="datetime-local"
                defaultValue={localDateTime(record.end_at)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Location"
                name="location"
                defaultValue={record.location}
              />
              <Field
                label="State code"
                name="state_code"
                defaultValue={record.state_code}
                placeholder="CT"
              />
            </div>
            <label className="grid gap-2">
              Event type
              <select
                className="rounded-xl border border-white/10 bg-[#07101b] p-3"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                <option value="convention">Convention</option>
                <option value="public">Other Event</option>
                <option value="meetup">Meetup</option>
                <option value="hosting">Hosting</option>
              </select>
            </label>
            {eventType === "convention" ? (
              <>
                {record.convention_edition_id ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={changeEdition}
                      onChange={(e) => setChangeEdition(e.target.checked)}
                    />{" "}
                    Change linked Convention Edition
                  </label>
                ) : null}
                {!record.convention_edition_id || changeEdition ? (
                  <EditionPicker selected={edition} onSelect={setEdition} />
                ) : (
                  <p className="text-xs text-slate-400">
                    Existing directory reference is preserved. Fields here
                    describe your deployment; official convention facts are
                    read-only.
                  </p>
                )}
              </>
            ) : null}
            <TagInput
              name="tags"
              defaultTags={
                Array.isArray(record.tags) && record.tags.length
                  ? record.tags
                  : record.tag
              }
            />
            <Field
              label="Event theme"
              name="event_theme"
              defaultValue={record.event_theme}
            />
            <Select
              label="Suiting?"
              name="suiting_mode"
              defaultValue={record.suiting_mode ?? "not_suiting"}
            >
              <option value="not_suiting">Not Suiting</option>
              <option value="partialing">Partialing</option>
              <option value="fullsuiting">Fullsuiting</option>
            </Select>
            <Field
              label="Appearance details"
              name="appearance_mode"
              defaultValue={record.appearance_mode}
              placeholder="Red harness, Pup Blazer gear, panel host…"
            />
            <Area
              label="Description"
              name="description"
              defaultValue={record.description}
            />
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                name="route_visible"
                type="checkbox"
                defaultChecked={record.route_visible !== false}
              />
              Include this event in Dusk&apos;s route / Next Stop sequence
            </label>
          </>
        ) : null}

        {props.mode === "readiness" ? (
          <>
            <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.04] p-4 text-sm leading-6 text-slate-300">
              Status and readiness are automatic in Alpha v31. Readiness is 55%
              tasks, 35% budget, and 10% packing. Deployment state moves
              automatically from Planning → Packing → Traveling → Completed.
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Target arrival"
                name="target_arrival_at"
                type="datetime-local"
                defaultValue={localDateTime(record.target_arrival_at)}
              />
              <Field
                label="Departure"
                name="departure_at"
                type="datetime-local"
                defaultValue={localDateTime(record.departure_at)}
              />
              <Field
                label="Prep deadline"
                name="prep_deadline_at"
                type="datetime-local"
                defaultValue={localDateTime(record.prep_deadline_at)}
              />
              <Field
                label="Packing deadline"
                name="packing_deadline"
                type="datetime-local"
                defaultValue={localDateTime(record.packing_deadline)}
              />
            </div>
            <Area label="Prep notes" name="notes" defaultValue={record.notes} />
          </>
        ) : null}

        {props.mode === "packing" ? (
          <>
            <Field
              label="Item"
              name="label"
              required
              defaultValue={record.label}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Category"
                name="category"
                defaultValue={record.category ?? "general"}
              />
              <Field
                label="Quantity"
                name="quantity"
                type="number"
                defaultValue={record.quantity ?? 1}
              />
              <Field
                label="Sort order"
                name="sort_order"
                type="number"
                defaultValue={record.sort_order ?? 0}
              />
            </div>
            <div className="flex flex-wrap gap-5 text-sm text-slate-300">
              <label className="flex items-center gap-2">
                <input
                  name="packed"
                  type="checkbox"
                  defaultChecked={Boolean(record.packed)}
                />{" "}
                Packed
              </label>
              <label className="flex items-center gap-2">
                <input
                  name="required"
                  type="checkbox"
                  defaultChecked={Boolean(record.required)}
                />{" "}
                Required
              </label>
            </div>
            <Area label="Notes" name="notes" defaultValue={record.notes} />
          </>
        ) : null}

        {props.mode === "task" ? (
          <>
            <Field
              label="Task"
              name="title"
              required
              defaultValue={record.title}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Task type"
                name="task_type"
                defaultValue={record.task_type ?? "prep"}
              />
              <Select
                label="Status"
                name="status"
                defaultValue={record.status ?? "todo"}
              >
                <option value="todo">To do</option>
                <option value="scheduled">Scheduled</option>
                <option value="doing">Doing</option>
                <option value="done">Done</option>
                <option value="skipped">Skipped</option>
              </Select>
              <Field
                label="Due"
                name="due_at"
                type="datetime-local"
                defaultValue={localDateTime(record.due_at)}
              />
              <Field
                label="Duration (minutes)"
                name="duration_minutes"
                type="number"
                defaultValue={record.duration_minutes ?? ""}
              />
              <Field
                label="Sort order"
                name="sort_order"
                type="number"
                defaultValue={record.sort_order ?? 0}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  name="required"
                  type="checkbox"
                  defaultChecked={record.id ? Boolean(record.required) : true}
                />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  name="counts_toward_readiness"
                  type="checkbox"
                  defaultChecked={
                    record.id ? record.counts_toward_readiness !== false : true
                  }
                />
                Counts toward readiness
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Parent task
              </span>
              <select
                name="parent_task_id"
                defaultValue={record.parent_task_id ?? ""}
                className="rounded-xl border border-white/10 bg-[#07101b] px-3 py-3 text-white"
              >
                <option value="">None — standalone task</option>
                {(props.tasks ?? [])
                  .filter((task) => task.id !== record.id)
                  .map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
              </select>
              <span className="text-[10px] text-slate-600">
                Parent/container tasks do not count directly. Only terminal leaf
                tasks count toward the 55% task-readiness score.
              </span>
            </label>
            <Area label="Notes" name="notes" defaultValue={record.notes} />
          </>
        ) : null}

        {props.mode === "hotel" ? (
          <>
            <Field
              label="Hotel"
              name="hotel_name"
              required
              defaultValue={record.hotel_name}
            />
            <Field
              label="Address"
              name="address"
              defaultValue={record.address}
            />
            <Field
              label="Confirmation code"
              name="confirmation_code"
              defaultValue={record.confirmation_code}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Check in"
                name="checkin_at"
                type="datetime-local"
                defaultValue={localDateTime(record.checkin_at)}
              />
              <Field
                label="Check out"
                name="checkout_at"
                type="datetime-local"
                defaultValue={localDateTime(record.checkout_at)}
              />
            </div>
            <Field
              label="Hotel cost"
              name="cost"
              type="number"
              step="0.01"
              defaultValue={
                record.cost_cents ? Number(record.cost_cents) / 100 : ""
              }
            />
            <p className="text-xs text-slate-500">
              Hotel cost belongs to the hotel record. Use Budget & Costs to add
              or track budget line items.
            </p>
          </>
        ) : null}

        {props.mode === "travel" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Kind"
                name="kind"
                defaultValue={record.kind ?? "other"}
              >
                <option value="flight">Flight</option>
                <option value="train">Train</option>
                <option value="bus">Bus</option>
                <option value="car">Car</option>
                <option value="rideshare">Rideshare</option>
                <option value="other">Other</option>
              </Select>
              <Select
                label="Direction"
                name="direction"
                defaultValue={record.direction ?? "other"}
              >
                <option value="outbound">Outbound</option>
                <option value="return">Return</option>
                <option value="local">Local</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <Field
              label="Provider"
              name="provider"
              defaultValue={record.provider}
            />
            <Field
              label="Confirmation code"
              name="confirmation_code"
              defaultValue={record.confirmation_code}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Origin"
                name="origin"
                defaultValue={record.origin}
              />
              <Field
                label="Destination"
                name="destination"
                defaultValue={record.destination}
              />
              <Field
                label="Depart"
                name="depart_at"
                type="datetime-local"
                defaultValue={localDateTime(record.depart_at)}
              />
              <Field
                label="Arrive"
                name="arrive_at"
                type="datetime-local"
                defaultValue={localDateTime(record.arrive_at)}
              />
            </div>
            <Field
              label="Travel cost"
              name="cost"
              type="number"
              step="0.01"
              defaultValue={
                record.cost_cents ? Number(record.cost_cents) / 100 : ""
              }
            />
            <Field
              label="Car mode"
              name="car_mode"
              defaultValue={record.car_mode}
              placeholder="self_drive / carpool_driver / carpool_passenger"
            />
            <Area
              label="Pickup / travel notes"
              name="pickup_notes"
              defaultValue={record.pickup_notes}
            />
          </>
        ) : null}

        {props.mode === "registration" ? (
          <>
            <Field
              label="Badge name"
              name="badge_name"
              required
              defaultValue={record.badge_name}
            />
            <Select
              label="Status"
              name="status"
              defaultValue={record.status ?? "needed"}
            >
              <option value="needed">Needed</option>
              <option value="ordered">Ordered</option>
              <option value="paid">Paid</option>
              <option value="confirmed">Confirmed</option>
            </Select>
            <Field
              label="Badge cost"
              name="cost"
              type="number"
              step="0.01"
              defaultValue={
                record.cost_cents ? Number(record.cost_cents) / 100 : ""
              }
            />
            <Field
              label="Confirmation code"
              name="confirmation_code"
              defaultValue={record.confirmation_code}
            />
          </>
        ) : null}

        {props.mode === "cost" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Category"
                name="category"
                required
                defaultValue={record.category ?? "other"}
                placeholder="Hotel, badge, gas…"
              />
              <Select
                label="Status"
                name="cost_status"
                defaultValue={record.cost_status ?? "budgeted"}
              >
                <option value="unbudgeted">Unbudgeted</option>
                <option value="budgeted">Budgeted</option>
                <option value="paid">Paid</option>
              </Select>
            </div>
            <Field
              label="Description"
              name="description"
              defaultValue={record.description}
              placeholder="Four-night Hilton stay"
            />
            <Field label="Vendor" name="vendor" defaultValue={record.vendor} />
            <Field
              label="Amount"
              name="amount"
              required
              type="number"
              step="0.01"
              defaultValue={
                record.amount_cents ? Number(record.amount_cents) / 100 : ""
              }
            />
          </>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div>
            {props.record?.id &&
            !["event", "readiness"].includes(props.mode) ? (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-sm font-black text-red-200 disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
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
              {busy ? "Saving…" : creating ? "Add" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </WorkspaceSheet>
  );
}
