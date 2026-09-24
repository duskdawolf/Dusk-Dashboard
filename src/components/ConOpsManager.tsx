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
};

type PackingItem = {
  id: string;
  parent_item_id?: string | null;
  category: string;
  label: string;
  quantity: number;
  packed: boolean;
};

type PrepTask = {
  id: string;
  parent_task_id?: string | null;
  title: string;
  status: string;
  due_at?: string | null;
};

type Prep = {
  id: string;
  status: string;
  readiness_score?: number | null;
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

function conventionLocation(con: Convention) {
  return [con.city, con.region, con.country].filter(Boolean).join(", ");
}

function readiness(prep: Prep) {
  const packing = (prep.packing_items ?? []).filter((item) => !item.parent_item_id);
  const tasks = (prep.prep_tasks ?? []).filter((task) => !task.parent_task_id);
  const total = packing.length + tasks.length;

  if (!total) return prep.readiness_score ?? 0;

  const done =
    packing.filter((item) => item.packed).length +
    tasks.filter((task) => ["done", "skipped"].includes(task.status)).length;

  return Math.round((done / total) * 100);
}

function childrenOf<T extends { id: string }>(
  rows: T[],
  parentKey: keyof T,
  parentId: string | null = null,
) {
  return rows.filter((row) => (row[parentKey] ?? null) === parentId);
}

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.detail ?? body.error ?? `Request failed (${response.status})`);
  }

  return body;
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
  const [selectedPrepId, setSelectedPrepId] = useState(initialPreps[0]?.id ?? "");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [status, setStatus] = useState(initialError);
  const [busy, setBusy] = useState(false);

  const selectedPrep =
    preps.find((prep) => prep.id === selectedPrepId) ?? preps[0] ?? null;

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return conventions.filter((con) => {
      if (!q) return true;
      return `${con.name} ${con.abbreviation ?? ""} ${conventionLocation(con)}`
        .toLowerCase()
        .includes(q);
    });
  }, [conventions, catalogQuery]);

  async function refresh() {
    try {
      const body = await jsonRequest("/api/admin/con-prep", { cache: "no-store" });
      setPreps(body.preps ?? []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not refresh Convention Ops.");
    }
  }

  async function deploy(con: Convention) {
    setBusy(true);
    setStatus(`Deploying ${con.name}...`);

    try {
      const payload: Record<string, unknown> = {
        mode: "catalog",
        catalogId: con.id,
      };

      if (!con.start_date || !con.end_date) {
        const startDate = window.prompt(
          `${con.name} does not have current dates in this Alpha snapshot. Enter start date (YYYY-MM-DD):`,
        );
        if (!startDate) return;

        payload.startDate = startDate;
        payload.endDate =
          window.prompt("End date (YYYY-MM-DD):", startDate) || startDate;
      }

      const body = await jsonRequest("/api/admin/conventions/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await refresh();
      setSelectedPrepId(body.prepId);
      setStatus(`${con.name} deployed. Tactical Deployment Plan created.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create deployment.");
    } finally {
      setBusy(false);
    }
  }

  async function manualDeploy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);

    try {
      const body = await jsonRequest("/api/admin/conventions/deploy", {
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

      formElement.reset();
      await refresh();
      setSelectedPrepId(body.prepId);
      setStatus("Manual deployment created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create deployment.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePacking(item: PackingItem) {
    try {
      await jsonRequest("/api/admin/con-prep/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, packed: !item.packed }),
      });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update packing item.");
    }
  }

  async function toggleTask(task: PrepTask) {
    try {
      await jsonRequest("/api/admin/con-prep/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          status: ["done", "skipped"].includes(task.status) ? "todo" : "done",
        }),
      });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update task.");
    }
  }

  async function addPackingItem(
    label: string,
    category = "General",
    parentItemId: string | null = null,
  ) {
    if (!selectedPrep || !label.trim()) return;

    try {
      await jsonRequest("/api/admin/con-prep/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: selectedPrep.id,
          parentItemId,
          category,
          label: label.trim(),
          quantity: 1,
        }),
      });
      setStatus(`Added packing item: ${label.trim()}`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not add packing item.");
    }
  }

  async function addTask(
    title: string,
    taskType = "prep",
    dueAt: string | null = null,
    parentTaskId: string | null = null,
  ) {
    if (!selectedPrep || !title.trim()) return;

    try {
      await jsonRequest("/api/admin/con-prep/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: selectedPrep.id,
          parentTaskId,
          title: title.trim(),
          taskType,
          dueAt,
        }),
      });
      setStatus(`Added task: ${title.trim()}`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not add task.");
    }
  }

  async function addRootPacking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const label = String(form.get("label") || "");
    const category = String(form.get("category") || "General");

    if (!label.trim()) return;

    try {
      await jsonRequest("/api/admin/con-prep/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: selectedPrep?.id,
          category,
          label,
          quantity: Number(form.get("quantity") || 1),
        }),
      });
      formElement.reset();
      setStatus(`Added packing item: ${label}`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not add packing item.");
    }
  }

  async function addRootTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") || "");
    const dueRaw = String(form.get("dueAt") || "");

    try {
      await jsonRequest("/api/admin/con-prep/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: selectedPrep?.id,
          title,
          taskType: String(form.get("taskType") || "prep"),
          dueAt: dueRaw ? new Date(dueRaw).toISOString() : null,
        }),
      });
      formElement.reset();
      setStatus(`Added task: ${title}`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not add task.");
    }
  }

  async function addLoadout(slug: string) {
    if (!selectedPrep) return;

    try {
      const body = await jsonRequest("/api/admin/con-prep/loadouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: selectedPrep.id,
          templateSlug: slug,
        }),
      });
      setStatus(`Loadout added${body.added ? ` · ${body.added} new items` : ""}.`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not add loadout.");
    }
  }

  async function addHotel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const money = String(form.get("cost") || "");

    try {
      await jsonRequest("/api/admin/con-prep/hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: selectedPrep?.id,
          hotelName: String(form.get("hotelName") || ""),
          address: String(form.get("address") || ""),
          confirmationCode: String(form.get("confirmationCode") || ""),
          costCents: money ? Math.round(Number(money) * 100) : null,
        }),
      });
      formElement.reset();
      setStatus("Hotel added.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save hotel.");
    }
  }

  async function addCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      await jsonRequest("/api/admin/con-prep/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: selectedPrep?.id,
          category: String(form.get("category") || "other"),
          vendor: String(form.get("vendor") || ""),
          description: String(form.get("description") || ""),
          amountCents: Math.round(Number(form.get("amount") || 0) * 100),
          costStatus: String(form.get("costStatus") || "planned"),
        }),
      });
      formElement.reset();
      setStatus("Cost added.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save cost.");
    }
  }

  async function saveRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const cost = String(form.get("cost") || "");

    try {
      await jsonRequest("/api/admin/con-prep/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: selectedPrep?.id,
          badgeName: String(form.get("badgeName") || "Con badge"),
          status: String(form.get("badgeStatus") || "needed"),
          costCents: cost ? Math.round(Number(cost) * 100) : null,
          confirmationCode: String(form.get("confirmationCode") || ""),
        }),
      });
      setStatus("Badge status updated.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save registration.");
    }
  }

  async function addTravel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const kind = String(form.get("kind") || "car");
    const departRaw = String(form.get("departAt") || "");
    const arriveRaw = String(form.get("arriveAt") || "");
    const transit = String(form.get("transitMinutes") || "");
    const cost = String(form.get("cost") || "");

    try {
      const body = await jsonRequest("/api/admin/con-prep/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conPrepId: selectedPrep?.id,
          kind,
          direction: String(form.get("direction") || "outbound"),
          carMode: kind === "car" ? String(form.get("carMode") || "self_drive") : null,
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

      formElement.reset();
      setStatus(
        body.travel?.leave_for_airport_at
          ? `Travel saved · leave for airport ${new Date(
              body.travel.leave_for_airport_at,
            ).toLocaleString()}`
          : "Travel saved.",
      );
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save travel.");
    }
  }

  async function syncWikiFur() {
    setBusy(true);
    setStatus("Syncing WikiFur convention catalog...");

    try {
      const body = await jsonRequest("/api/admin/conventions/sync", {
        method: "POST",
      });
      setStatus(
        `WikiFur catalog synced · ${body.upserted} refreshed · ${body.preservedOfficial} official overrides preserved.`,
      );
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "WikiFur sync failed.");
    } finally {
      setBusy(false);
    }
  }

  const suggestedTasks = [
    ["Charge fans + battery packs", "prep"],
    ["Review convention schedule and room locations", "prep"],
    ["Hotel checkout / room sweep", "hotel"],
    ["Final social / sticker / giveaway check", "production"],
  ] as const;

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">v26 Alpha · Convention Operations</div>
            <h2 className="text-4xl font-black tracking-[-.04em]">Convention Ops</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Pick a deployment, then work that con below. Chaos Copilot™ is scoped
              only to the selected deployment and starts fresh when you switch.
            </p>
          </div>

          <details className="relative">
            <summary className="button-primary cursor-pointer list-none">
              Add Deployment
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-[min(92vw,760px)] rounded-3xl border border-white/10 bg-[#09111d] p-5 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">Convention catalog</div>
                  <h3 className="text-xl font-black">Where are we going?</h3>
                </div>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={busy}
                  onClick={syncWikiFur}
                >
                  Sync WikiFur
                </button>
              </div>

              <input
                className="form-input mt-4"
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder="Search con, city, state, country..."
              />

              <div className="mt-3 max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {filteredCatalog.map((con) => (
                  <div
                    key={con.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3"
                  >
                    <div>
                      <strong>{con.name}</strong>
                      <div className="text-xs text-slate-500">
                        {conventionLocation(con)}
                        {con.attendance_rank ? ` · #${con.attendance_rank}` : ""}
                      </div>
                    </div>
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => deploy(con)}
                    >
                      I&apos;m Going
                    </button>
                  </div>
                ))}
              </div>

              <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <summary className="cursor-pointer text-sm font-black text-dusk-aqua">
                  Add Manually
                </summary>
                <form className="mt-4 space-y-3" onSubmit={manualDeploy}>
                  <input className="form-input" name="name" placeholder="Event name" required />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className="form-input" name="startDate" type="date" required />
                    <input className="form-input" name="endDate" type="date" required />
                  </div>
                  <input className="form-input" name="location" placeholder="Location" required />
                  <button className="button-primary" type="submit" disabled={busy}>
                    Create Manual Deployment
                  </button>
                </form>
              </details>
            </div>
          </details>
        </div>

        {status ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
            {status}
          </div>
        ) : null}
      </section>

      {preps.length ? (
        <section>
          <div className="eyebrow mb-2">Upcoming deployments</div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {preps.map((prep) => (
              <button
                key={prep.id}
                type="button"
                onClick={() => setSelectedPrepId(prep.id)}
                className={`min-w-[240px] rounded-2xl border p-4 text-left transition ${
                  selectedPrep?.id === prep.id
                    ? "border-dusk-aqua/40 bg-dusk-aqua/8 shadow-[0_0_0_1px_rgba(97,232,255,.08)]"
                    : "border-white/10 bg-white/[0.025] hover:border-white/20"
                }`}
              >
                <strong className="block text-lg">
                  {prep.events?.title ?? "Deployment"}
                </strong>
                <span className="mt-1 block text-xs text-slate-500">
                  {readiness(prep)}% ready
                </span>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full bg-dusk-aqua"
                    style={{ width: `${readiness(prep)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {selectedPrep ? (
        <>
          <section className="panel">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="eyebrow">Selected deployment</div>
                <h2 className="text-4xl font-black">
                  {selectedPrep.events?.title ?? "Convention"}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {selectedPrep.events?.location}
                </p>
              </div>

              <div className="text-right">
                <div className="text-4xl font-black text-dusk-aqua">
                  {readiness(selectedPrep)}%
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
          </section>

          <ChaosCopilot
            key={selectedPrep.id}
            contextType="deployment"
            conPrepId={selectedPrep.id}
            contextLabel={selectedPrep.events?.title ?? "this deployment"}
          />

          <section className="panel">
            <div className="eyebrow">Deployment workspace</div>
            <p className="mt-1 text-sm text-slate-500">
              Keep the high-level page compact; expand only the area you&apos;re working on.
            </p>

            <div className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">
              <details className="p-4" open>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <strong className="text-xl">Packing & Loadouts</strong>
                      <div className="text-xs text-slate-500">
                        {(selectedPrep.packing_items ?? []).filter((item) => item.packed).length}
                        /{selectedPrep.packing_items?.length ?? 0} checked
                      </div>
                    </div>

                    <select
                      className="form-input max-w-xs"
                      defaultValue=""
                      onClick={(event) => event.stopPropagation()}
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
                </summary>

                <div className="mt-4 space-y-2">
                  {childrenOf(
                    selectedPrep.packing_items ?? [],
                    "parent_item_id",
                  ).map((item) => {
                    const children = childrenOf(
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
                            <strong>{item.label}</strong>
                          </label>
                          <button
                            type="button"
                            className="text-xs font-black text-dusk-aqua"
                            onClick={(event) => {
                              event.preventDefault();
                              const label = window.prompt("Sub-item:");
                              if (label) addPackingItem(label, item.category, item.id);
                            }}
                          >
                            + sub-item
                          </button>
                        </summary>

                        {children.length ? (
                          <div className="mt-3 space-y-2 border-l border-white/10 pl-4">
                            {children.map((child) => (
                              <label key={child.id} className="flex items-center gap-3 text-sm">
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
                  })}
                </div>

                <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <summary className="cursor-pointer text-sm font-black text-dusk-aqua">
                    Add Manually
                  </summary>
                  <form
                    className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_90px_auto]"
                    onSubmit={addRootPacking}
                  >
                    <input className="form-input" name="category" placeholder="Category" defaultValue="General" />
                    <input className="form-input" name="label" placeholder="Packing item" required />
                    <input className="form-input" name="quantity" type="number" min="1" defaultValue="1" />
                    <button className="button-secondary" type="submit">Add</button>
                  </form>
                </details>
              </details>

              <details className="p-4" open>
                <summary className="cursor-pointer list-none">
                  <strong className="text-xl">Tasks & Subtasks</strong>
                </summary>

                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestedTasks.map(([title, type]) => (
                    <button
                      key={title}
                      className="button-secondary !px-3 !py-2 text-xs"
                      type="button"
                      onClick={() => addTask(title, type)}
                    >
                      + {title}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {childrenOf(
                    selectedPrep.prep_tasks ?? [],
                    "parent_task_id",
                  ).map((task) => {
                    const children = childrenOf(
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
                            type="button"
                            className="text-xs font-black text-dusk-aqua"
                            onClick={(event) => {
                              event.preventDefault();
                              const title = window.prompt("Subtask:");
                              if (title) addTask(title, "prep", null, task.id);
                            }}
                          >
                            + subtask
                          </button>
                        </summary>

                        {children.length ? (
                          <div className="mt-3 space-y-2 border-l border-white/10 pl-4">
                            {children.map((child) => (
                              <label key={child.id} className="flex items-start gap-3 text-sm">
                                <input
                                  className="mt-1"
                                  type="checkbox"
                                  checked={["done", "skipped"].includes(child.status)}
                                  onChange={() => toggleTask(child)}
                                />
                                <span>{child.title}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </details>
                    );
                  })}
                </div>

                <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <summary className="cursor-pointer text-sm font-black text-dusk-aqua">
                    Add Manually
                  </summary>
                  <form
                    className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1.2fr_auto]"
                    onSubmit={addRootTask}
                  >
                    <input className="form-input" name="title" placeholder="Task" required />
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
                </details>
              </details>

              <details className="p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-xl">Travel, Hotel & Badge</strong>
                    <span className="text-xs text-slate-500">
                      {selectedPrep.travel_segments?.length ?? 0} travel ·{" "}
                      {selectedPrep.hotel_stays?.length ?? 0} hotel
                    </span>
                  </div>
                </summary>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="eyebrow">Travel</div>
                    <p className="mt-1 text-sm text-slate-300">
                      {selectedPrep.travel_segments?.length
                        ? `${selectedPrep.travel_segments.length} segment(s) entered`
                        : "Not entered yet"}
                    </p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-black text-dusk-aqua">
                        Add Manually
                      </summary>
                      <form className="mt-3 space-y-2" onSubmit={addTravel}>
                        <select className="form-input" name="kind" defaultValue="car">
                          <option value="car">Car</option>
                          <option value="flight">Flight</option>
                        </select>
                        <select className="form-input" name="direction" defaultValue="outbound">
                          <option value="outbound">Outbound</option>
                          <option value="return">Return</option>
                          <option value="local">Local</option>
                        </select>
                        <input className="form-input" name="origin" placeholder="Origin" />
                        <input className="form-input" name="destination" placeholder="Destination" />
                        <input className="form-input" name="departAt" type="datetime-local" />
                        <input className="form-input" name="arriveAt" type="datetime-local" />
                        <input className="form-input" name="provider" placeholder="Airline / provider" />
                        <input className="form-input" name="confirmationCode" placeholder="Confirmation" />
                        <input className="form-input" name="transitMinutes" type="number" min="1" placeholder="Transit minutes" />
                        <input className="form-input" name="cost" type="number" min="0" step="0.01" placeholder="Cost $" />
                        <input className="form-input" name="pickupNotes" placeholder="Pickup / stop notes" />
                        <select className="form-input" name="carMode" defaultValue="self_drive">
                          <option value="self_drive">Drive myself</option>
                          <option value="carpool_driver">Carpool · I drive</option>
                          <option value="carpool_passenger">Carpool · passenger</option>
                        </select>
                        <button className="button-secondary" type="submit">Save Travel</button>
                      </form>
                    </details>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="eyebrow">Hotel</div>
                    <p className="mt-1 text-sm text-slate-300">
                      {selectedPrep.hotel_stays?.[0]?.hotel_name ?? "Not entered yet"}
                    </p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-black text-dusk-aqua">
                        Add Manually
                      </summary>
                      <form className="mt-3 space-y-2" onSubmit={addHotel}>
                        <input className="form-input" name="hotelName" placeholder="Hotel name" required />
                        <input className="form-input" name="address" placeholder="Address" />
                        <input className="form-input" name="confirmationCode" placeholder="Confirmation" />
                        <input className="form-input" name="cost" type="number" min="0" step="0.01" placeholder="Cost $" />
                        <button className="button-secondary" type="submit">Save Hotel</button>
                      </form>
                    </details>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="eyebrow">Badge</div>
                    <p className="mt-1 text-sm capitalize text-slate-300">
                      {selectedPrep.con_registrations?.[0]?.status ?? "Not entered yet"}
                    </p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-black text-dusk-aqua">
                        Add Manually
                      </summary>
                      <form className="mt-3 space-y-2" onSubmit={saveRegistration}>
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
                    </details>
                  </div>
                </div>
              </details>

              <details className="p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-xl">Budget</strong>
                    <span className="font-black text-dusk-gold">
                      $
                      {(
                        (selectedPrep.cost_entries ?? []).reduce(
                          (sum, item) => sum + (item.amount_cents ?? 0),
                          0,
                        ) / 100
                      ).toFixed(2)}
                    </span>
                  </div>
                </summary>

                <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <summary className="cursor-pointer text-sm font-black text-dusk-aqua">
                    Add Manually
                  </summary>
                  <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={addCost}>
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
                </details>
              </details>
            </div>
          </section>
        </>
      ) : (
        <section className="panel text-center">
          <h3 className="text-2xl font-black">No deployments yet.</h3>
          <p className="mt-2 text-sm text-slate-400">
            Use <strong>Add Deployment</strong> above and v26 will spin up the operation.
          </p>
        </section>
      )}
    </div>
  );
}
