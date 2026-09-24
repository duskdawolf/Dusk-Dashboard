"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ChaosCopilot } from "@/components/ChaosCopilot";

type Convention = {
  id: string;
  slug: string;
  name: string;
  abbreviation?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  attendance_rank?: number | null;
  latest_attendance?: number | null;
  latest_attendance_year?: number | null;
  verification_status?: string | null;
  source_url?: string | null;
};

type PackingItem = {
  id: string;
  parent_item_id?: string | null;
  category: string;
  label: string;
  quantity: number;
  packed: boolean;
  source?: string | null;
};

type PrepTask = {
  id: string;
  parent_task_id?: string | null;
  title: string;
  status: string;
  due_at?: string | null;
  source?: string | null;
};

type Prep = {
  id: string;
  status: string;
  readiness_score?: number | null;
  prep_deadline_at?: string | null;
  events?: {
    id: string;
    title: string;
    slug: string;
    start_at: string;
    end_at?: string | null;
    location?: string | null;
  } | null;
  packing_items?: PackingItem[];
  prep_tasks?: PrepTask[];
  travel_segments?: any[];
  hotel_stays?: any[];
  con_registrations?: any[];
  cost_entries?: any[];
};

type Loadout = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  category: string;
};

function location(con: Convention) {
  return [con.city, con.region, con.country].filter(Boolean).join(", ");
}

function pct(prep: Prep) {
  const pack = prep.packing_items ?? [];
  const tasks = prep.prep_tasks ?? [];

  const requiredPack = pack.filter((item) => !item.parent_item_id);
  const requiredTasks = tasks.filter((task) => !task.parent_task_id);

  const total = requiredPack.length + requiredTasks.length;
  if (!total) return prep.readiness_score ?? 0;

  const done =
    requiredPack.filter((item) => item.packed).length +
    requiredTasks.filter((task) => ["done", "skipped"].includes(task.status))
      .length;

  return Math.round((done / total) * 100);
}

function tree<T extends { id: string }>(
  rows: T[],
  parentKey: keyof T,
  parentId: string | null = null,
) {
  return rows.filter((row) => (row[parentKey] ?? null) === parentId);
}

export function ConOpsManager({
  initialPreps,
  conventions,
  loadouts,
  initialError,
}: {
  initialPreps: Prep[];
  conventions: Convention[];
  loadouts: Loadout[];
  userId: string;
  initialError: string;
}) {
  const [preps, setPreps] = useState(initialPreps);
  const [selectedPrepId, setSelectedPrepId] = useState(
    initialPreps[0]?.id ?? "",
  );
  const [catalogQuery, setCatalogQuery] = useState("");
  const [status, setStatus] = useState(initialError);
  const [busy, setBusy] = useState(false);

  const selectedPrep =
    preps.find((prep) => prep.id === selectedPrepId) ?? preps[0] ?? null;

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return conventions.filter((con) => {
      if (!q) return true;
      return `${con.name} ${con.abbreviation ?? ""} ${location(con)}`
        .toLowerCase()
        .includes(q);
    });
  }, [conventions, catalogQuery]);

  async function refresh() {
    const response = await fetch("/api/admin/con-prep", { cache: "no-store" });
    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Could not refresh Convention Ops.");
      return;
    }

    setPreps(body.preps ?? []);
  }

  async function deploy(con: Convention) {
    setBusy(true);
    setStatus(`Deploying ${con.name}...`);

    const body: Record<string, unknown> = {
      mode: "catalog",
      catalogId: con.id,
    };

    if (!con.start_date || !con.end_date) {
      const startDate = window.prompt(
        `${con.name} does not have a current WikiFur date in this Alpha snapshot. Enter start date (YYYY-MM-DD):`,
      );
      if (!startDate) {
        setBusy(false);
        setStatus("Deployment cancelled.");
        return;
      }

      const endDate =
        window.prompt("End date (YYYY-MM-DD):", startDate) || startDate;
      body.startDate = startDate;
      body.endDate = endDate;
    }

    const response = await fetch("/api/admin/conventions/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setBusy(false);

    if (!response.ok) {
      setStatus(result.error ?? "Could not create deployment.");
      return;
    }

    setStatus(`${con.name} deployed. Tactical Deployment Plan created.`);
    await refresh();
    setSelectedPrepId(result.prepId);
  }

  async function manualDeploy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);

    const response = await fetch("/api/admin/conventions/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "manual",
        name: String(form.get("name") || ""),
        startDate: String(form.get("startDate") || ""),
        endDate: String(form.get("endDate") || ""),
        location: String(form.get("location") || ""),
      }),
    });
    const body = await response.json();
    setBusy(false);

    if (!response.ok) {
      setStatus(body.error ?? "Could not create manual deployment.");
      return;
    }

    event.currentTarget.reset();
    setStatus("Manual deployment created.");
    await refresh();
    setSelectedPrepId(body.prepId);
  }

  async function togglePacking(item: PackingItem) {
    const response = await fetch("/api/admin/con-prep/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, packed: !item.packed }),
    });

    if (response.ok) await refresh();
  }

  async function toggleTask(task: PrepTask) {
    const next = ["done", "skipped"].includes(task.status) ? "todo" : "done";
    const response = await fetch("/api/admin/con-prep/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, status: next }),
    });

    if (response.ok) await refresh();
  }

  async function addChildPacking(
    prepId: string,
    parentItemId: string,
    category: string,
  ) {
    const label = window.prompt("Sub-item:");
    if (!label?.trim()) return;

    const response = await fetch("/api/admin/con-prep/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: prepId,
        parentItemId,
        category,
        label: label.trim(),
        quantity: 1,
      }),
    });

    if (response.ok) await refresh();
  }

  async function addChildTask(prepId: string, parentTaskId: string) {
    const title = window.prompt("Subtask:");
    if (!title?.trim()) return;

    const response = await fetch("/api/admin/con-prep/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: prepId,
        parentTaskId,
        title: title.trim(),
        taskType: "prep",
      }),
    });

    if (response.ok) await refresh();
  }

  async function addLoadout(slug: string) {
    if (!selectedPrep) return;

    const response = await fetch("/api/admin/con-prep/loadouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: selectedPrep.id,
        templateSlug: slug,
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      setStatus(body.error ?? "Could not add loadout.");
      return;
    }

    setStatus(`Loadout added${body.added ? ` · ${body.added} new items` : ""}.`);
    await refresh();
  }

  async function addRootPacking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPrep) return;
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/admin/con-prep/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: selectedPrep.id,
        category: String(form.get("category") || "General"),
        label: String(form.get("label") || ""),
        quantity: Number(form.get("quantity") || 1),
      }),
    });

    if (response.ok) {
      event.currentTarget.reset();
      await refresh();
    }
  }

  async function addRootTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPrep) return;
    const form = new FormData(event.currentTarget);

    const dueRaw = String(form.get("dueAt") || "");
    const dueAt = dueRaw ? new Date(dueRaw).toISOString() : null;

    const response = await fetch("/api/admin/con-prep/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: selectedPrep.id,
        title: String(form.get("title") || ""),
        taskType: String(form.get("taskType") || "prep"),
        dueAt,
      }),
    });

    if (response.ok) {
      event.currentTarget.reset();
      await refresh();
    }
  }

  async function addHotel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPrep) return;
    const form = new FormData(event.currentTarget);
    const money = String(form.get("cost") || "");

    const response = await fetch("/api/admin/con-prep/hotel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: selectedPrep.id,
        hotelName: String(form.get("hotelName") || ""),
        address: String(form.get("address") || ""),
        confirmationCode: String(form.get("confirmationCode") || ""),
        costCents: money ? Math.round(Number(money) * 100) : null,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatus(body.error ?? "Could not save hotel.");
      return;
    }

    event.currentTarget.reset();
    setStatus("Hotel added.");
    await refresh();
  }

  async function addCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPrep) return;
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/admin/con-prep/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: selectedPrep.id,
        category: String(form.get("category") || "other"),
        vendor: String(form.get("vendor") || ""),
        description: String(form.get("description") || ""),
        amountCents: Math.round(Number(form.get("amount") || 0) * 100),
        costStatus: String(form.get("costStatus") || "planned"),
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatus(body.error ?? "Could not save cost.");
      return;
    }

    event.currentTarget.reset();
    setStatus("Cost added.");
    await refresh();
  }

  async function saveRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPrep) return;
    const form = new FormData(event.currentTarget);
    const cost = String(form.get("cost") || "");

    const response = await fetch("/api/admin/con-prep/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: selectedPrep.id,
        badgeName: String(form.get("badgeName") || "Con badge"),
        status: String(form.get("badgeStatus") || "needed"),
        costCents: cost ? Math.round(Number(cost) * 100) : null,
        confirmationCode: String(form.get("confirmationCode") || ""),
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatus(body.error ?? "Could not save registration.");
      return;
    }

    setStatus("Badge status updated.");
    await refresh();
  }

  async function addTravel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPrep) return;
    const form = new FormData(event.currentTarget);

    const kind = String(form.get("kind") || "car");
    const departRaw = String(form.get("departAt") || "");
    const arriveRaw = String(form.get("arriveAt") || "");
    const transit = String(form.get("transitMinutes") || "");
    const cost = String(form.get("cost") || "");

    const response = await fetch("/api/admin/con-prep/travel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: selectedPrep.id,
        kind,
        direction: String(form.get("direction") || "outbound"),
        carMode:
          kind === "car"
            ? String(form.get("carMode") || "self_drive")
            : null,
        pickupNotes: String(form.get("pickupNotes") || ""),
        provider: String(form.get("provider") || ""),
        confirmationCode: String(form.get("confirmationCode") || ""),
        origin: String(form.get("origin") || ""),
        destination: String(form.get("destination") || ""),
        departAt: departRaw ? new Date(departRaw).toISOString() : null,
        arriveAt: arriveRaw ? new Date(arriveRaw).toISOString() : null,
        costCents: cost ? Math.round(Number(cost) * 100) : null,
        transitMinutes: transit ? Number(transit) : null,
        extraTravelBufferMinutes: 15,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.error ?? "Could not save travel.");
      return;
    }

    event.currentTarget.reset();
    setStatus(
      body.travel?.leave_for_airport_at
        ? `Travel saved · leave for airport ${new Date(
            body.travel.leave_for_airport_at,
          ).toLocaleString()}`
        : "Travel saved.",
    );
    await refresh();
  }

  async function syncWikiFur() {
    setBusy(true);
    setStatus("Syncing WikiFur convention catalog...");

    const response = await fetch("/api/admin/conventions/sync", {
      method: "POST",
    });
    const body = await response.json();
    setBusy(false);

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "WikiFur sync failed.");
      return;
    }

    setStatus(
      `WikiFur catalog synced · ${body.upserted} refreshed · ${body.preservedOfficial} official overrides preserved.`,
    );
    window.location.reload();
  }

  return (
    <div className="space-y-8">
      <section className="panel">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Alpha v26 · Convention Operations</div>
            <h2 className="text-4xl font-black tracking-[-.04em]">
              Spin Up the Operation
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              WikiFur attendance-ranked convention catalog → one-click deployment
              → Tactical Deployment Plan → packing, tasks, travel, costs, and
              Chaos Copilot™.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="button-secondary"
              type="button"
              disabled={busy}
              onClick={syncWikiFur}
            >
              Sync WikiFur
            </button>
            <button className="button-secondary" type="button" onClick={refresh}>
              Refresh Ops
            </button>
          </div>
        </div>

        {status ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
            {status}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <div className="panel">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="eyebrow">WikiFur source-of-truth catalog</div>
              <h3 className="text-2xl font-black">Convention Catalog</h3>
            </div>
            <input
              className="form-input max-w-sm"
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
              placeholder="Search con, city, state, country..."
            />
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Ordered by WikiFur&apos;s latest announced attendance. Official
            convention website/social overrides WikiFur when we have a verified
            conflict; WikiFur overrides other sources.
          </p>

          <div className="mt-5 max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {filteredCatalog.map((con) => (
              <div
                key={con.id}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-lg">{con.name}</strong>
                      {con.attendance_rank ? (
                        <span className="tag !mt-0">#{con.attendance_rank}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{location(con)}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {con.start_date
                        ? `${con.start_date} → ${con.end_date ?? con.start_date}`
                        : "Current dates not in Alpha snapshot"}
                      {con.latest_attendance
                        ? ` · ${con.latest_attendance.toLocaleString()} attendance (${con.latest_attendance_year})`
                        : ""}
                    </p>
                  </div>

                  <button
                    className="button-primary"
                    type="button"
                    disabled={busy}
                    onClick={() => deploy(con)}
                  >
                    I&apos;m Going
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="eyebrow">Manual fallback</div>
          <h3 className="text-2xl font-black">Custom Deployment</h3>
          <p className="mt-2 text-sm text-slate-400">
            For furmeets, one-offs, or a con not yet represented in the catalog.
          </p>

          <form className="mt-5 space-y-3" onSubmit={manualDeploy}>
            <label className="form-label">
              Name
              <input className="form-input" name="name" required />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="form-label">
                Start
                <input className="form-input" name="startDate" type="date" required />
              </label>
              <label className="form-label">
                End
                <input className="form-input" name="endDate" type="date" required />
              </label>
            </div>
            <label className="form-label">
              Location
              <input className="form-input" name="location" required />
            </label>
            <button className="button-primary" type="submit" disabled={busy}>
              Create Deployment
            </button>
          </form>

          <div className="mt-6">
            <div className="eyebrow">Upcoming deployments</div>
            <div className="mt-3 space-y-2">
              {preps.map((prep) => (
                <button
                  key={prep.id}
                  className={`w-full rounded-xl border p-3 text-left ${
                    selectedPrep?.id === prep.id
                      ? "border-dusk-aqua/30 bg-dusk-aqua/5"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
                  onClick={() => setSelectedPrepId(prep.id)}
                  type="button"
                >
                  <strong className="block">{prep.events?.title ?? "Deployment"}</strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    {pct(prep)}% ready
                    {prep.events?.location ? ` · ${prep.events.location}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {selectedPrep ? (
        <>
          <section className="panel">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="eyebrow">Tactical Deployment</div>
                <h2 className="text-4xl font-black">
                  {selectedPrep.events?.title ?? "Convention"}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {selectedPrep.events?.location}
                </p>
              </div>

              <div className="min-w-48 text-right">
                <div className="text-4xl font-black text-dusk-aqua">
                  {pct(selectedPrep)}%
                </div>
                <div className="text-xs uppercase tracking-widest text-slate-500">
                  deployment ready
                </div>
                {selectedPrep.events?.slug ? (
                  <Link
                    className="button-secondary mt-3 inline-block"
                    href={`/chaos/${selectedPrep.events.slug}`}
                  >
                    Tactical Deployment Plan
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full bg-dusk-aqua"
                style={{ width: `${pct(selectedPrep)}%` }}
              />
            </div>
          </section>

          <ChaosCopilot
            contextType="deployment"
            conPrepId={selectedPrep.id}
          />

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="panel">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">Packing / loadouts</div>
                  <h3 className="text-2xl font-black">Deployment Loadout</h3>
                </div>
                <select
                  className="form-input max-w-xs"
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) {
                      addLoadout(event.target.value);
                      event.target.value = "";
                    }
                  }}
                >
                  <option value="">+ Add reusable loadout</option>
                  {loadouts.map((loadout) => (
                    <option key={loadout.id} value={loadout.slug}>
                      {loadout.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 space-y-2">
                {tree(selectedPrep.packing_items ?? [], "parent_item_id").map(
                  (item) => {
                    const children = tree(
                      selectedPrep.packing_items ?? [],
                      "parent_item_id",
                      item.id,
                    );

                    return (
                      <details
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                        open={children.length > 0}
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={item.packed}
                              onChange={() => togglePacking(item)}
                              onClick={(event) => event.stopPropagation()}
                            />
                            <span>
                              <strong>{item.label}</strong>
                              {item.quantity > 1 ? (
                                <span className="ml-2 text-xs text-slate-500">
                                  ×{item.quantity}
                                </span>
                              ) : null}
                            </span>
                          </label>
                          <button
                            className="text-xs font-black text-dusk-aqua"
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              addChildPacking(
                                selectedPrep.id,
                                item.id,
                                item.category,
                              );
                            }}
                          >
                            + sub-item
                          </button>
                        </summary>

                        {children.length ? (
                          <div className="mt-3 space-y-2 border-l border-white/10 pl-4">
                            {children.map((child) => (
                              <label
                                key={child.id}
                                className="flex items-center gap-3 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={child.packed}
                                  onChange={() => togglePacking(child)}
                                />
                                <span>{child.label}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </details>
                    );
                  },
                )}
              </div>

              <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_90px_auto]" onSubmit={addRootPacking}>
                <input className="form-input" name="category" placeholder="Category" defaultValue="General" />
                <input className="form-input" name="label" placeholder="Add packing item..." required />
                <input className="form-input" name="quantity" type="number" min="1" defaultValue="1" />
                <button className="button-secondary" type="submit">Add</button>
              </form>
            </div>

            <div className="panel">
              <div className="eyebrow">Prep timeline</div>
              <h3 className="text-2xl font-black">Tasks & Subtasks</h3>

              <div className="mt-4 space-y-2">
                {tree(selectedPrep.prep_tasks ?? [], "parent_task_id").map(
                  (task) => {
                    const children = tree(
                      selectedPrep.prep_tasks ?? [],
                      "parent_task_id",
                      task.id,
                    );

                    return (
                      <details
                        key={task.id}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                        open={children.length > 0}
                      >
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                          <label className="flex items-start gap-3">
                            <input
                              className="mt-1"
                              type="checkbox"
                              checked={["done", "skipped"].includes(task.status)}
                              onChange={() => toggleTask(task)}
                              onClick={(event) => event.stopPropagation()}
                            />
                            <span>
                              <strong className="block">{task.title}</strong>
                              <span className="text-xs text-slate-500">
                                {task.due_at
                                  ? `Due ${new Date(task.due_at).toLocaleString()}`
                                  : "No deadline"}
                              </span>
                            </span>
                          </label>

                          <button
                            className="text-xs font-black text-dusk-aqua"
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              addChildTask(selectedPrep.id, task.id);
                            }}
                          >
                            + subtask
                          </button>
                        </summary>

                        {children.length ? (
                          <div className="mt-3 space-y-2 border-l border-white/10 pl-4">
                            {children.map((child) => (
                              <label
                                key={child.id}
                                className="flex items-start gap-3 text-sm"
                              >
                                <input
                                  className="mt-1"
                                  type="checkbox"
                                  checked={["done", "skipped"].includes(
                                    child.status,
                                  )}
                                  onChange={() => toggleTask(child)}
                                />
                                <span>
                                  {child.title}
                                  {child.due_at ? (
                                    <span className="ml-2 text-xs text-slate-600">
                                      {new Date(child.due_at).toLocaleDateString()}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </details>
                    );
                  },
                )}
              </div>

              <form className="mt-4 grid gap-2 sm:grid-cols-[2fr_1fr_1.2fr_auto]" onSubmit={addRootTask}>
                <input className="form-input" name="title" placeholder="Add prep task..." required />
                <select className="form-input" name="taskType" defaultValue="prep">
                  <option value="prep">Prep</option>
                  <option value="packing">Packing</option>
                  <option value="travel">Travel</option>
                  <option value="hotel">Hotel</option>
                  <option value="registration">Badge</option>
                  <option value="production">Production</option>
                  <option value="programming">Programming</option>
                </select>
                <input className="form-input" name="dueAt" type="datetime-local" />
                <button className="button-secondary" type="submit">Add</button>
              </form>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="panel">
              <div className="eyebrow">Travel</div>
              <h3 className="text-xl font-black">
                {selectedPrep.travel_segments?.length ?? 0} segment(s)
              </h3>
            </div>

            <div className="panel">
              <div className="eyebrow">Hotel</div>
              <h3 className="text-xl font-black">
                {selectedPrep.hotel_stays?.[0]?.hotel_name ?? "Not entered"}
              </h3>
            </div>

            <div className="panel">
              <div className="eyebrow">Badge</div>
              <h3 className="text-xl font-black capitalize">
                {selectedPrep.con_registrations?.[0]?.status ?? "Not entered"}
              </h3>
            </div>

            <div className="panel">
              <div className="eyebrow">Budget</div>
              <h3 className="text-xl font-black text-dusk-gold">
                $
                {(
                  (selectedPrep.cost_entries ?? []).reduce(
                    (sum, item) => sum + (item.amount_cents ?? 0),
                    0,
                  ) / 100
                ).toFixed(2)}
              </h3>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="panel">
              <div className="eyebrow">Travel engine</div>
              <h3 className="text-xl font-black">Add Travel</h3>
              <form className="mt-4 space-y-2" onSubmit={addTravel}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select className="form-input" name="kind" defaultValue="car">
                    <option value="car">Car</option>
                    <option value="flight">Flight</option>
                  </select>
                  <select className="form-input" name="direction" defaultValue="outbound">
                    <option value="outbound">Outbound</option>
                    <option value="return">Return</option>
                    <option value="local">Local</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <select className="form-input" name="carMode" defaultValue="self_drive">
                  <option value="self_drive">Drive myself</option>
                  <option value="carpool_driver">Carpool · I drive</option>
                  <option value="carpool_passenger">Carpool · passenger</option>
                </select>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="form-input" name="origin" placeholder="Origin" />
                  <input className="form-input" name="destination" placeholder="Destination" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="form-input" name="departAt" type="datetime-local" />
                  <input className="form-input" name="arriveAt" type="datetime-local" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="form-input" name="provider" placeholder="Airline / provider" />
                  <input className="form-input" name="confirmationCode" placeholder="Confirmation" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="form-input" name="transitMinutes" type="number" min="1" placeholder="Transit / drive minutes" />
                  <input className="form-input" name="cost" type="number" min="0" step="0.01" placeholder="Cost $" />
                </div>
                <input className="form-input" name="pickupNotes" placeholder="Pickup / stop notes" />
                <p className="text-xs text-slate-500">
                  Flights use the 90-minute airport target + 15-minute safety
                  buffer. Outbound departure re-anchors prep deadlines.
                </p>
                <button className="button-secondary" type="submit">Save Travel</button>
              </form>
            </div>

            <div className="panel">
              <div className="eyebrow">Lodging</div>
              <h3 className="text-xl font-black">Add Hotel</h3>
              <form className="mt-4 space-y-2" onSubmit={addHotel}>
                <input className="form-input" name="hotelName" placeholder="Hotel name" required />
                <input className="form-input" name="address" placeholder="Address" />
                <input className="form-input" name="confirmationCode" placeholder="Confirmation" />
                <input className="form-input" name="cost" type="number" min="0" step="0.01" placeholder="Cost $" />
                <button className="button-secondary" type="submit">Save Hotel</button>
              </form>
            </div>

            <div className="panel">
              <div className="eyebrow">Registration</div>
              <h3 className="text-xl font-black">Badge</h3>
              <form className="mt-4 space-y-2" onSubmit={saveRegistration}>
                <input className="form-input" name="badgeName" defaultValue="Con badge" />
                <select className="form-input" name="badgeStatus" defaultValue="needed">
                  <option value="needed">Needed</option>
                  <option value="ordered">Ordered</option>
                  <option value="paid">Paid</option>
                  <option value="confirmed">Confirmed</option>
                </select>
                <input className="form-input" name="cost" type="number" min="0" step="0.01" placeholder="Cost $" />
                <input className="form-input" name="confirmationCode" placeholder="Confirmation" />
                <button className="button-secondary" type="submit">Save Badge</button>
              </form>
            </div>

            <div className="panel">
              <div className="eyebrow">Budget</div>
              <h3 className="text-xl font-black">Add Cost</h3>
              <form className="mt-4 space-y-2" onSubmit={addCost}>
                <select className="form-input" name="category" defaultValue="other">
                  <option value="registration">Registration</option>
                  <option value="lodging">Lodging</option>
                  <option value="transportation">Transportation</option>
                  <option value="food">Food</option>
                  <option value="merch">Merch</option>
                  <option value="programming">Programming</option>
                  <option value="other">Other</option>
                </select>
                <input className="form-input" name="vendor" placeholder="Vendor" />
                <input className="form-input" name="description" placeholder="Description" />
                <input className="form-input" name="amount" type="number" min="0" step="0.01" placeholder="Amount $" required />
                <select className="form-input" name="costStatus" defaultValue="planned">
                  <option value="estimated">Estimated</option>
                  <option value="planned">Planned</option>
                  <option value="paid">Paid</option>
                  <option value="reimbursed">Reimbursed</option>
                </select>
                <button className="button-secondary" type="submit">Add Cost</button>
              </form>
            </div>
          </section>
        </>
      ) : (
        <section className="panel text-center">
          <h3 className="text-2xl font-black">No deployments yet.</h3>
          <p className="mt-2 text-sm text-slate-400">
            Hit <strong>I&apos;m Going</strong> on a convention above and v26 will
            spin up the operation.
          </p>
        </section>
      )}
    </div>
  );
}
