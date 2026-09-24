"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChaosCopilot } from "@/components/ChaosCopilot";

type PackingItem = {
  id: string;
  parent_item_id?: string | null;
  category: string;
  label: string;
  quantity: number;
  packed: boolean;
  source?: string | null;
  required?: boolean;
};

type PrepTask = {
  id: string;
  parent_task_id?: string | null;
  title: string;
  task_type: string;
  status: string;
  due_at?: string | null;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  duration_minutes?: number | null;
  source?: string | null;
  required?: boolean;
};

type Prep = {
  id: string;
  status: string;
  readiness_score?: number | null;
  prep_deadline_at?: string | null;
  ai_summary?: string | null;
  events?: {
    id: string;
    slug: string;
    title: string;
    start_at: string;
    end_at?: string | null;
    location?: string | null;
  } | null;
  convention_catalog?: {
    name?: string | null;
    verification_status?: string | null;
    source_url?: string | null;
    website_url?: string | null;
    venue_name?: string | null;
  } | null;
  packing_items?: PackingItem[];
  prep_tasks?: PrepTask[];
  travel_segments?: Array<{
    id: string;
    kind: string;
    direction?: string | null;
    car_mode?: string | null;
    provider?: string | null;
    origin?: string | null;
    destination?: string | null;
    depart_at?: string | null;
    arrive_at?: string | null;
    airport_arrival_target_at?: string | null;
    leave_for_airport_at?: string | null;
  }>;
  hotel_stays?: Array<{
    id: string;
    hotel_name: string;
    address?: string | null;
    checkin_at?: string | null;
    checkout_at?: string | null;
    cost_cents?: number | null;
  }>;
  con_registrations?: Array<{
    id: string;
    badge_name: string;
    status: string;
    cost_cents?: number | null;
  }>;
  cost_entries?: Array<{
    id: string;
    category: string;
    description?: string | null;
    vendor?: string | null;
    amount_cents: number;
    cost_status: string;
  }>;
};

type LoadoutTemplate = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  category: string;
};

function documentType(startAt?: string | null) {
  if (!startAt) return "Deployment";
  return new Date(startAt).getTime() > Date.now()
    ? "Tactical Deployment Plan"
    : "Incident Report";
}

function money(cents?: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function browserLocalToIso(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function leafItems<T extends { id: string }>(
  items: T[],
  parentKey: keyof T,
) {
  return items.filter(
    (item) =>
      !items.some(
        (candidate) => candidate[parentKey] === item.id,
      ),
  );
}

function PackingTree({
  items,
  toggle,
  addChild,
}: {
  items: PackingItem[];
  toggle: (item: PackingItem, checked: boolean) => Promise<void>;
  addChild: (parent: PackingItem) => void;
}) {
  const roots = items.filter((item) => !item.parent_item_id);

  function node(item: PackingItem, depth = 0): React.ReactNode {
    const children = items.filter(
      (candidate) => candidate.parent_item_id === item.id,
    );

    return (
      <div key={item.id} style={{ marginLeft: depth * 16 }}>
        <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={item.packed}
              onChange={(event) => toggle(item, event.target.checked)}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                {item.category}
                {item.source?.startsWith("chaos") ? " · ✨ Chaos" : ""}
              </div>
              <strong className={item.packed ? "text-slate-500 line-through" : ""}>
                {item.label}
                {item.quantity > 1 ? ` ×${item.quantity}` : ""}
              </strong>
            </div>
            <button
              className="text-xs font-black text-dusk-aqua"
              type="button"
              onClick={() => addChild(item)}
            >
              + subitem
            </button>
          </div>
        </div>
        {children.length ? (
          <div className="mt-2 space-y-2 border-l border-white/10 pl-2">
            {children.map((child) => node(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  return <div className="space-y-2">{roots.map((item) => node(item))}</div>;
}

function TaskTree({
  tasks,
  update,
  addChild,
}: {
  tasks: PrepTask[];
  update: (task: PrepTask, status: string) => Promise<void>;
  addChild: (task: PrepTask) => void;
}) {
  const roots = tasks.filter((task) => !task.parent_task_id);

  function node(task: PrepTask, depth = 0): React.ReactNode {
    const children = tasks.filter(
      (candidate) => candidate.parent_task_id === task.id,
    );

    return (
      <div key={task.id} style={{ marginLeft: depth * 16 }}>
        <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                {task.task_type}
                {task.source?.startsWith("chaos") ? " · ✨ Chaos" : ""}
              </div>
              <strong
                className={
                  ["done", "skipped"].includes(task.status)
                    ? "text-slate-500 line-through"
                    : ""
                }
              >
                {task.title}
              </strong>
              <p className="mt-1 text-xs text-slate-500">
                {task.scheduled_start_at
                  ? new Date(task.scheduled_start_at).toLocaleString()
                  : task.due_at
                    ? `Due ${new Date(task.due_at).toLocaleString()}`
                    : "Unscheduled"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs"
                value={task.status}
                onChange={(event) => update(task, event.target.value)}
              >
                <option value="todo">To do</option>
                <option value="scheduled">Scheduled</option>
                <option value="doing">Doing</option>
                <option value="done">Done</option>
                <option value="skipped">Skipped</option>
              </select>
              <button
                className="text-xs font-black text-dusk-aqua"
                type="button"
                onClick={() => addChild(task)}
              >
                + subtask
              </button>
            </div>
          </div>
        </div>
        {children.length ? (
          <div className="mt-2 space-y-2 border-l border-white/10 pl-2">
            {children.map((child) => node(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  return <div className="space-y-2">{roots.map((task) => node(task))}</div>;
}

export function ConventionDeployment({
  initialPrep,
  loadoutTemplates,
}: {
  initialPrep: Prep;
  loadoutTemplates: LoadoutTemplate[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [addingPackingParent, setAddingPackingParent] =
    useState<PackingItem | null>(null);
  const [addingTaskParent, setAddingTaskParent] =
    useState<PrepTask | null>(null);

  const prep = initialPrep;
  const packing = prep.packing_items ?? [];
  const tasks = prep.prep_tasks ?? [];
  const leafPacking = leafItems(packing, "parent_item_id");
  const leafTasks = leafItems(tasks, "parent_task_id");
  const packed = leafPacking.filter((item) => item.packed).length;
  const taskDone = leafTasks.filter((task) =>
    ["done", "skipped"].includes(task.status),
  ).length;

  const costs = prep.cost_entries ?? [];
  const plannedTotal = useMemo(
    () => costs.reduce((sum, item) => sum + (item.amount_cents ?? 0), 0),
    [costs],
  );

  async function mutate(
    endpoint: string,
    options: RequestInit,
    success: string,
  ) {
    setStatus("Working...");
    const response = await fetch(endpoint, options);
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Operation failed.");
      return false;
    }

    setStatus(success);
    router.refresh();
    return true;
  }

  async function togglePacking(item: PackingItem, packedValue: boolean) {
    await mutate(
      "/api/admin/con-prep/items",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, packed: packedValue }),
      },
      "Packing updated.",
    );
  }

  async function updateTask(task: PrepTask, nextStatus: string) {
    await mutate(
      "/api/admin/con-prep/tasks",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, status: nextStatus }),
      },
      "Task updated.",
    );
  }

  async function addPacking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const ok = await mutate(
      "/api/admin/con-prep/items",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: prep.id,
          parentItemId: addingPackingParent?.id ?? null,
          category: String(data.get("category") ?? "General"),
          label: String(data.get("label") ?? ""),
          quantity: Number(data.get("quantity") ?? 1),
        }),
      },
      "Packing item added.",
    );

    if (ok) {
      form.reset();
      setAddingPackingParent(null);
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const ok = await mutate(
      "/api/admin/con-prep/tasks",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: prep.id,
          parentTaskId: addingTaskParent?.id ?? null,
          title: String(data.get("title") ?? ""),
          taskType: String(data.get("taskType") ?? "prep"),
          dueAt: browserLocalToIso(data.get("dueAt")),
        }),
      },
      "Task added.",
    );

    if (ok) {
      form.reset();
      setAddingTaskParent(null);
    }
  }

  async function applyLoadout(slug: string) {
    await mutate(
      "/api/admin/con-prep/loadouts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: prep.id,
          templateSlug: slug,
        }),
      },
      "Loadout merged into packing list.",
    );
  }

  async function autoSchedule() {
    await mutate(
      "/api/admin/con-prep/auto-schedule",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conPrepId: prep.id }),
      },
      "Prep tasks auto-scheduled around work.",
    );
  }

  async function schedulePrinting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const quantity = Number(data.get("quantity") ?? 0);

    await mutate(
      "/api/admin/con-prep/print-schedule",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: prep.id,
          quantity,
        }),
      },
      `Sticker production scheduled for ${quantity} stickers.`,
    );
  }

  async function addTravel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    await mutate(
      "/api/admin/con-prep/travel",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: prep.id,
          kind: String(data.get("kind") ?? "car"),
          direction: String(data.get("direction") ?? "outbound"),
          carMode: String(data.get("carMode") ?? "") || null,
          provider: String(data.get("provider") ?? ""),
          origin: String(data.get("origin") ?? ""),
          destination: String(data.get("destination") ?? ""),
          departAt: browserLocalToIso(data.get("departAt")),
          arriveAt: browserLocalToIso(data.get("arriveAt")),
          transitMinutes: String(data.get("transitMinutes") ?? "")
            ? Number(data.get("transitMinutes"))
            : null,
          extraTravelBufferMinutes: 15,
          costCents: String(data.get("cost") ?? "")
            ? Math.round(Number(data.get("cost")) * 100)
            : null,
        }),
      },
      "Travel segment added.",
    );
  }

  async function addHotel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    await mutate(
      "/api/admin/con-prep/hotel",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: prep.id,
          hotelName: String(data.get("hotelName") ?? ""),
          address: String(data.get("address") ?? ""),
          checkinAt: browserLocalToIso(data.get("checkinAt")),
          checkoutAt: browserLocalToIso(data.get("checkoutAt")),
          costCents: String(data.get("cost") ?? "")
            ? Math.round(Number(data.get("cost")) * 100)
            : null,
        }),
      },
      "Hotel added.",
    );
  }

  async function saveRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    await mutate(
      "/api/admin/con-prep/registration",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: prep.id,
          badgeName: String(data.get("badgeName") ?? "Convention badge"),
          status: String(data.get("status") ?? "needed"),
          costCents: String(data.get("cost") ?? "")
            ? Math.round(Number(data.get("cost")) * 100)
            : null,
          confirmationCode: String(data.get("confirmationCode") ?? ""),
        }),
      },
      "Registration updated.",
    );
  }

  async function addCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const ok = await mutate(
      "/api/admin/con-prep/costs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: prep.id,
          category: String(data.get("category") ?? "other"),
          vendor: String(data.get("vendor") ?? ""),
          description: String(data.get("description") ?? ""),
          amountCents: Math.round(Number(data.get("amount") ?? 0) * 100),
          costStatus: String(data.get("costStatus") ?? "planned"),
        }),
      },
      "Cost added.",
    );

    if (ok) form.reset();
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-dusk-aqua/25 bg-[radial-gradient(circle_at_top_right,rgba(97,232,255,.11),transparent_42%),#091321] p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="eyebrow">
              {documentType(prep.events?.start_at)}
            </div>
            <h1 className="mt-2 text-4xl font-black tracking-[-.05em] sm:text-5xl">
              {prep.events?.title ?? "Convention Deployment"}
            </h1>
            <p className="mt-2 text-slate-400">
              {prep.events?.location ?? "Location pending"}
            </p>
            {prep.convention_catalog?.verification_status ? (
              <p className="mt-2 text-xs text-slate-500">
                Catalog authority:{" "}
                {prep.convention_catalog.verification_status === "official"
                  ? "official convention source"
                  : prep.convention_catalog.verification_status === "wikifur"
                    ? "WikiFur"
                    : "manual"}
              </p>
            ) : null}
          </div>

          <div className="min-w-40 text-right">
            <div className="text-5xl font-black text-dusk-aqua">
              {prep.readiness_score ?? 0}%
            </div>
            <div className="text-xs font-black uppercase tracking-widest text-slate-600">
              deployment ready
            </div>
          </div>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-dusk-aqua"
            style={{
              width: `${Math.max(
                2,
                Math.min(100, prep.readiness_score ?? 0),
              )}%`,
            }}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {prep.events?.slug ? (
            <Link
              className="button-secondary"
              href={`/chaos/${prep.events.slug}`}
            >
              Open {documentType(prep.events.start_at)}
            </Link>
          ) : null}
          <span className="tag !mt-0">
            {packed}/{leafPacking.length} packed
          </span>
          <span className="tag !mt-0">
            {taskDone}/{leafTasks.length} tasks
          </span>
          <span className="tag !mt-0">
            {money(plannedTotal)} planned
          </span>
        </div>

        {status ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
            {status}
          </div>
        ) : null}
      </section>

      <ChaosCopilot
        contextType="deployment"
        conPrepId={prep.id}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="eyebrow">Expandable checklist</div>
              <h2 className="text-2xl font-black">Packing & Loadouts</h2>
            </div>
            <span className="tag !mt-0">
              {packed}/{leafPacking.length}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {loadoutTemplates.map((template) => (
              <button
                key={template.id}
                className="button-secondary"
                type="button"
                onClick={() => applyLoadout(template.slug)}
                title={template.description ?? undefined}
              >
                + {template.name}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <PackingTree
              items={packing}
              toggle={togglePacking}
              addChild={(item) => setAddingPackingParent(item)}
            />
          </div>

          <form
            className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] p-4"
            onSubmit={addPacking}
          >
            <div className="eyebrow">
              {addingPackingParent
                ? `Subitem of ${addingPackingParent.label}`
                : "Add packing item"}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_90px]">
              <input
                className="form-input"
                name="category"
                placeholder="Category"
                defaultValue="General"
              />
              <input
                className="form-input"
                name="label"
                placeholder="Item"
                required
              />
              <input
                className="form-input"
                name="quantity"
                type="number"
                min="1"
                defaultValue="1"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button className="button-primary" type="submit">
                Add
              </button>
              {addingPackingParent ? (
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setAddingPackingParent(null)}
                >
                  Cancel nesting
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="eyebrow">Prep timeline</div>
              <h2 className="text-2xl font-black">Tasks & Subtasks</h2>
            </div>
            <button
              className="button-secondary"
              type="button"
              onClick={autoSchedule}
            >
              Auto-schedule
            </button>
          </div>

          <div className="mt-5">
            <TaskTree
              tasks={tasks}
              update={updateTask}
              addChild={(task) => setAddingTaskParent(task)}
            />
          </div>

          <form
            className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] p-4"
            onSubmit={addTask}
          >
            <div className="eyebrow">
              {addingTaskParent
                ? `Subtask of ${addingTaskParent.title}`
                : "Add task"}
            </div>
            <div className="mt-3 grid gap-3">
              <input
                className="form-input"
                name="title"
                placeholder="Task"
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="form-input"
                  name="taskType"
                  placeholder="Type"
                  defaultValue="prep"
                />
                <input
                  className="form-input"
                  name="dueAt"
                  type="datetime-local"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="button-primary" type="submit">
                Add
              </button>
              {addingTaskParent ? (
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setAddingTaskParent(null)}
                >
                  Cancel nesting
                </button>
              ) : null}
            </div>
          </form>

          <form
            className="mt-5 rounded-2xl border border-dusk-aqua/20 bg-dusk-aqua/5 p-4"
            onSubmit={schedulePrinting}
          >
            <div className="eyebrow">Sticker production</div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                className="form-input"
                name="quantity"
                type="number"
                min="1"
                defaultValue="100"
              />
              <button className="button-primary" type="submit">
                Schedule printing
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Uses your operator preferences: 50/hour, Tuesday/Wednesday
              3–10 PM, work constraints, and safety buffers.
            </p>
          </form>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel">
          <div className="eyebrow">Travel engine</div>
          <h2 className="text-2xl font-black">Travel</h2>

          <div className="mt-4 space-y-3">
            {(prep.travel_segments ?? []).map((segment) => (
              <div
                key={segment.id}
                className="rounded-xl border border-white/8 bg-white/[0.02] p-3"
              >
                <strong className="capitalize">
                  {segment.direction ?? "trip"} · {segment.kind}
                </strong>
                <p className="mt-1 text-sm text-slate-400">
                  {segment.origin || "?"} → {segment.destination || "?"}
                </p>
                {segment.depart_at ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Depart {new Date(segment.depart_at).toLocaleString()}
                  </p>
                ) : null}
                {segment.leave_for_airport_at ? (
                  <p className="mt-1 text-xs font-bold text-dusk-gold">
                    Leave for airport{" "}
                    {new Date(segment.leave_for_airport_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <form className="mt-5 space-y-3" onSubmit={addTravel}>
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="form-input" name="kind" defaultValue="car">
                <option value="car">Car</option>
                <option value="flight">Flight</option>
              </select>
              <select
                className="form-input"
                name="direction"
                defaultValue="outbound"
              >
                <option value="outbound">Outbound</option>
                <option value="return">Return</option>
                <option value="local">Local</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="form-input" name="origin" placeholder="Origin" />
              <input
                className="form-input"
                name="destination"
                placeholder="Destination"
              />
            </div>
            <input
              className="form-input"
              name="provider"
              placeholder="Airline / driver / provider"
            />
            <select className="form-input" name="carMode" defaultValue="self_drive">
              <option value="self_drive">Drive myself</option>
              <option value="carpool_driver">Carpool — I drive</option>
              <option value="carpool_passenger">Carpool — passenger</option>
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-label">
                Depart
                <input className="form-input" name="departAt" type="datetime-local" />
              </label>
              <label className="form-label">
                Arrive
                <input className="form-input" name="arriveAt" type="datetime-local" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="form-input"
                name="transitMinutes"
                type="number"
                min="0"
                placeholder="Home → airport min"
              />
              <input
                className="form-input"
                name="cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="Cost $"
              />
            </div>
            <button className="button-secondary" type="submit">
              Add travel
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="eyebrow">Hotel Ops</div>
          <h2 className="text-2xl font-black">Lodging</h2>

          <div className="mt-4 space-y-3">
            {(prep.hotel_stays ?? []).map((hotel) => (
              <div
                key={hotel.id}
                className="rounded-xl border border-white/8 bg-white/[0.02] p-3"
              >
                <strong>{hotel.hotel_name}</strong>
                <p className="mt-1 text-xs text-slate-500">
                  {hotel.checkin_at
                    ? `Check-in ${new Date(hotel.checkin_at).toLocaleString()}`
                    : "Check-in TBD"}
                  {" · "}
                  {hotel.checkout_at
                    ? `Checkout ${new Date(hotel.checkout_at).toLocaleString()}`
                    : "Checkout TBD"}
                </p>
                <p className="mt-1 text-sm text-dusk-gold">
                  {money(hotel.cost_cents)}
                </p>
              </div>
            ))}
          </div>

          <form className="mt-5 space-y-3" onSubmit={addHotel}>
            <input
              className="form-input"
              name="hotelName"
              placeholder="Hotel"
              defaultValue={prep.convention_catalog?.venue_name ?? ""}
              required
            />
            <input
              className="form-input"
              name="address"
              placeholder="Address"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-label">
                Check-in
                <input className="form-input" name="checkinAt" type="datetime-local" />
              </label>
              <label className="form-label">
                Checkout
                <input className="form-input" name="checkoutAt" type="datetime-local" />
              </label>
            </div>
            <input
              className="form-input"
              name="cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="Cost $"
            />
            <button className="button-secondary" type="submit">
              Add hotel
            </button>
          </form>
        </section>
      </div>

      <section className="panel">
        <div className="eyebrow">Registration Ops</div>
        <h2 className="text-2xl font-black">Badge / Registration</h2>

        <div className="mt-4 space-y-2">
          {(prep.con_registrations ?? []).map((registration) => (
            <div
              key={registration.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3"
            >
              <div>
                <strong>{registration.badge_name}</strong>
                <div className="text-xs uppercase text-slate-500">
                  {registration.status}
                </div>
              </div>
              <strong>{money(registration.cost_cents)}</strong>
            </div>
          ))}
        </div>

        <form
          className="mt-5 grid gap-3 md:grid-cols-2"
          onSubmit={saveRegistration}
        >
          <input
            className="form-input"
            name="badgeName"
            placeholder="Badge / registration name"
            defaultValue={
              prep.con_registrations?.[0]?.badge_name ?? "Convention badge"
            }
            required
          />
          <select
            className="form-input"
            name="status"
            defaultValue={prep.con_registrations?.[0]?.status ?? "needed"}
          >
            <option value="needed">Needed</option>
            <option value="ordered">Ordered</option>
            <option value="paid">Paid</option>
            <option value="confirmed">Confirmed</option>
          </select>
          <input
            className="form-input"
            name="confirmationCode"
            placeholder="Confirmation code"
          />
          <input
            className="form-input"
            name="cost"
            type="number"
            min="0"
            step="0.01"
            placeholder="Cost $"
          />
          <button className="button-secondary md:col-span-2" type="submit">
            Save registration
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="eyebrow">Financial readiness</div>
        <h2 className="text-2xl font-black">Deployment Costs</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="text-xs uppercase text-slate-600">Planned</div>
            <strong className="text-2xl">{money(plannedTotal)}</strong>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="text-xs uppercase text-slate-600">Hotel</div>
            <strong className="text-2xl">
              {money(
                (prep.hotel_stays ?? []).reduce(
                  (sum, item) => sum + (item.cost_cents ?? 0),
                  0,
                ),
              )}
            </strong>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="text-xs uppercase text-slate-600">Registration</div>
            <strong className="text-2xl">
              {money(
                (prep.con_registrations ?? []).reduce(
                  (sum, item) => sum + (item.cost_cents ?? 0),
                  0,
                ),
              )}
            </strong>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {costs.map((cost) => (
            <div
              key={cost.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3"
            >
              <div>
                <strong>{cost.description || cost.category}</strong>
                <div className="text-xs text-slate-500">
                  {cost.vendor || "Manual"} · {cost.cost_status}
                </div>
              </div>
              <strong>{money(cost.amount_cents)}</strong>
            </div>
          ))}
        </div>

        <form
          className="mt-5 grid gap-3 md:grid-cols-2"
          onSubmit={addCost}
        >
          <input
            className="form-input"
            name="category"
            placeholder="Category"
            defaultValue="other"
            required
          />
          <input className="form-input" name="vendor" placeholder="Vendor" />
          <input
            className="form-input md:col-span-2"
            name="description"
            placeholder="Description"
          />
          <input
            className="form-input"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount $"
            required
          />
          <select className="form-input" name="costStatus" defaultValue="planned">
            <option value="estimated">Estimated</option>
            <option value="planned">Planned</option>
            <option value="paid">Paid</option>
            <option value="reimbursed">Reimbursed</option>
          </select>
          <button className="button-secondary md:col-span-2" type="submit">
            Add cost
          </button>
        </form>
      </section>
    </div>
  );
}
