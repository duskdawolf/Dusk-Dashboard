"use client";

import { FormEvent, useState } from "react";

type EventOption = {
  id: string;
  title: string;
  start_at: string;
  location: string | null;
  event_type: string;
};

type Prep = {
  id: string;
  event_id: string;
  status: string;
  notes: string | null;
  departure_at?: string | null;
  prep_complete_by?: string | null;
  prep_deadline_at?: string | null;
  events?: EventOption;
  packing_items?: {
    id: string;
    category: string;
    label: string;
    quantity: number;
    packed: boolean;
  }[];
  prep_tasks?: {
    id: string;
    title: string;
    due_at: string | null;
    scheduled_start_at: string | null;
    scheduled_end_at: string | null;
    duration_minutes: number | null;
    status: string;
    task_type: string;
  }[];
  travel_segments?: {
    id: string;
    kind: string;
    direction: string | null;
    car_mode: string | null;
    pickup_notes: string | null;
    provider: string | null;
    origin: string | null;
    destination: string | null;
    depart_at: string | null;
    arrive_at: string | null;
    airport_arrival_target_at: string | null;
    leave_for_airport_at: string | null;
  }[];
  hotel_stays?: {
    id: string;
    hotel_name: string;
    checkin_at: string | null;
    checkout_at: string | null;
    cost_cents?: number | null;
  }[];
  con_registrations?: {
    id: string;
    badge_name: string;
    status: string;
    cost_cents: number | null;
    confirmation_code: string | null;
  }[];
  cost_entries?: {
    id: string;
    category: string;
    vendor: string | null;
    description: string | null;
    amount_cents: number;
    cost_status: string;
    quickbooks_txn_id: string | null;
  }[];
};

export function ConPrepManager({
  events,
  initialPreps,
}: {
  events: EventOption[];
  initialPreps: Prep[];
}) {
  const [preps, setPreps] = useState(initialPreps);
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [status, setStatus] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/con-prep", { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setPreps(body.preps ?? []);
    else setStatus(body.error ?? "Could not refresh con prep.");
  }

  async function createPrep() {
    if (!eventId) return;
    setStatus("Building prep kit...");

    const response = await fetch("/api/admin/con-prep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Could not create prep kit.");
      return;
    }

    setStatus("Prep kit created.");
    await refresh();
  }

  async function toggleItem(itemId: string, packed: boolean) {
    const response = await fetch("/api/admin/con-prep/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, packed }),
    });

    if (response.ok) await refresh();
  }

  async function schedulePrinting(
    prepId: string,
    form: HTMLFormElement
  ) {
    const data = new FormData(form);
    const quantity = Number(data.get("quantity") ?? 0);
    const deadlineIso = String(data.get("deadlineIso") ?? "") || undefined;

    setStatus("Finding printing windows...");

    const response = await fetch("/api/admin/con-prep/print-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conPrepId: prepId, quantity, deadlineIso }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.error ?? "Could not schedule printing.");
      return;
    }

    setStatus(
      `Scheduled ${quantity} stickers across ${body.schedule.blocks.length} printing block(s).`
    );
    await refresh();
  }

  async function addTravel(prepId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const dollars = String(data.get("cost") ?? "").trim();

    const response = await fetch("/api/admin/con-prep/travel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: prepId,
        kind: String(data.get("kind") ?? "car"),
        direction: String(data.get("direction") ?? "outbound"),
        carMode: String(data.get("carMode") ?? "") || null,
        pickupNotes: String(data.get("pickupNotes") ?? ""),
        provider: String(data.get("provider") ?? ""),
        confirmationCode: String(data.get("confirmationCode") ?? ""),
        origin: String(data.get("origin") ?? ""),
        destination: String(data.get("destination") ?? ""),
        departAt: String(data.get("departAt") ?? "") || null,
        arriveAt: String(data.get("arriveAt") ?? "") || null,
        transitMinutes: String(data.get("transitMinutes") ?? "")
          ? Number(data.get("transitMinutes"))
          : null,
        extraTravelBufferMinutes: Number(
          data.get("extraTravelBufferMinutes") ?? 0
        ),
        costCents: dollars ? Math.round(Number(dollars) * 100) : null,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Could not save travel.");
      return;
    }

    setStatus("Travel saved.");
    form.reset();
    await refresh();
  }

  async function addHotel(prepId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const dollars = String(data.get("cost") ?? "").trim();

    const response = await fetch("/api/admin/con-prep/hotel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: prepId,
        hotelName: String(data.get("hotelName") ?? ""),
        address: String(data.get("address") ?? ""),
        confirmationCode: String(data.get("confirmationCode") ?? ""),
        checkinAt: String(data.get("checkinAt") ?? "") || null,
        checkoutAt: String(data.get("checkoutAt") ?? "") || null,
        costCents: dollars ? Math.round(Number(dollars) * 100) : null,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Could not save hotel.");
      return;
    }

    setStatus("Hotel saved.");
    form.reset();
    await refresh();
  }

  async function autoSchedulePrep(prepId: string) {
    setStatus("Scheduling prep tasks around work...");

    const response = await fetch("/api/admin/con-prep/auto-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conPrepId: prepId }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.error ?? "Could not auto-schedule prep.");
      return;
    }

    setStatus(
      `Scheduled ${body.scheduled.length} prep task(s)` +
        (body.unscheduled.length
          ? `; ${body.unscheduled.length} still need attention.`
          : ".")
    );
    await refresh();
  }


  async function addCost(prepId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const amount = Number(data.get("amount") ?? 0);

    const response = await fetch("/api/admin/con-prep/costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: prepId,
        category: String(data.get("category") ?? ""),
        vendor: String(data.get("vendor") ?? ""),
        description: String(data.get("description") ?? ""),
        amountCents: Math.round(amount * 100),
        costStatus: String(data.get("costStatus") ?? "planned"),
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Could not save cost.");
      return;
    }

    setStatus("Cost saved.");
    form.reset();
    await refresh();
  }

  async function saveRegistration(prepId: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const amount = String(data.get("cost") ?? "").trim();

    const response = await fetch("/api/admin/con-prep/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conPrepId: prepId,
        badgeName: String(data.get("badgeName") ?? "Con badge"),
        status: String(data.get("status") ?? "needed"),
        costCents: amount ? Math.round(Number(amount) * 100) : null,
        confirmationCode: String(data.get("confirmationCode") ?? ""),
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Could not save registration.");
      return;
    }

    setStatus("Registration updated.");
    await refresh();
  }


  return (
    <div>
      <section className="panel">
        <div className="eyebrow">Convention operations</div>
        <h2 className="text-3xl font-black">Con Prep</h2>
        <p className="mt-3 max-w-4xl text-slate-400">
          Current scheduling defaults: work M–F 6:00 AM–2:30 PM and Sunday 11:30 AM–8:00 PM; sticker printing Tuesday and Wednesday 3–10 PM at 50 stickers/hour; airport arrival 90 minutes before departure plus a 15-minute travel safety buffer.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <select
            className="form-input max-w-md"
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>

          <button
            className="button-primary"
            type="button"
            onClick={createPrep}
          >
            Create default prep kit
          </button>
        </div>

        {status ? <p className="mt-3 text-sm text-slate-400">{status}</p> : null}
      </section>

      <div className="mt-6 space-y-5">
        {preps.map((prep) => (
          <article key={prep.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="eyebrow">{prep.status}</div>
                <h3 className="text-2xl font-black">
                  {prep.events?.title ?? "Convention Prep"}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {prep.events?.location ?? ""}
                </p>
                {prep.prep_complete_by ? (
                  <p className="mt-2 text-sm font-bold text-dusk-gold">
                    Prep complete by:{" "}
                    {new Date(prep.prep_complete_by).toLocaleString()}
                  </p>
                ) : null}
                {prep.departure_at ? (
                  <p className="mt-1 text-sm text-dusk-aqua">
                    Departure:{" "}
                    {new Date(prep.departure_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <span className="tag !mt-0">
                {(prep.packing_items ?? []).filter((item) => item.packed).length}/
                {(prep.packing_items ?? []).length} packed
              </span>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="font-black">Packing List</h4>
                <div className="mt-3 space-y-2">
                  {(prep.packing_items ?? []).map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-dusk-line bg-white/[0.02] p-3"
                    >
                      <span>
                        <span className="text-xs uppercase text-slate-500">
                          {item.category}
                        </span>
                        <strong className="block">{item.label}</strong>
                      </span>
                      <input
                        type="checkbox"
                        checked={item.packed}
                        onChange={(event) =>
                          toggleItem(item.id, event.target.checked)
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-black">Prep & Production Tasks</h4>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => autoSchedulePrep(prep.id)}
                  >
                    Auto-schedule around work
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {(prep.prep_tasks ?? []).map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-dusk-line bg-white/[0.02] p-3"
                    >
                      <div className="flex flex-wrap justify-between gap-3">
                        <strong>{task.title}</strong>
                        <span className="text-xs uppercase text-slate-500">
                          {task.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {task.scheduled_start_at && task.scheduled_end_at
                          ? `${new Date(task.scheduled_start_at).toLocaleString()} → ${new Date(task.scheduled_end_at).toLocaleTimeString()}`
                          : task.due_at
                            ? `Due ${new Date(task.due_at).toLocaleString()}`
                            : "Unscheduled"}
                      </p>
                    </div>
                  ))}
                </div>

                <form
                  className="mt-5 rounded-2xl border border-dusk-aqua/20 bg-dusk-aqua/5 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    schedulePrinting(prep.id, event.currentTarget);
                  }}
                >
                  <div className="eyebrow">Sticker production planner</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-label">
                      Sticker quantity
                      <input
                        className="form-input"
                        name="quantity"
                        type="number"
                        min="1"
                        defaultValue="100"
                        required
                      />
                    </label>
                    <label className="form-label">
                      Deadline override
                      <input
                        className="form-input"
                        name="deadlineIso"
                        placeholder="Leave blank = event start"
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    50 stickers ≈ 1 hour. A full 3–10 PM printing window can handle about 350 stickers.
                  </p>
                  <button className="button-primary mt-3" type="submit">
                    Auto-schedule printing
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <section className="card">
                <div className="eyebrow">Travel</div>
                <h4 className="text-xl font-black">Flights / transport</h4>

                {(prep.travel_segments ?? []).map((segment) => (
                  <div
                    key={segment.id}
                    className="mt-3 rounded-xl border border-dusk-line bg-white/[0.02] p-3"
                  >
                    <strong className="capitalize">
                      {segment.direction ? `${segment.direction} · ` : ""}
                      {segment.kind}
                      {segment.car_mode
                        ? ` · ${segment.car_mode.replaceAll("_", " ")}`
                        : ""}
                      {segment.provider ? ` · ${segment.provider}` : ""}
                    </strong>
                    <p className="mt-1 text-sm text-slate-400">
                      {segment.origin ?? "?"} → {segment.destination ?? "?"}
                    </p>
                    {segment.depart_at ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Depart: {new Date(segment.depart_at).toLocaleString()}
                      </p>
                    ) : null}
                    {segment.airport_arrival_target_at ? (
                      <p className="mt-1 text-xs text-dusk-aqua">
                        Airport target:{" "}
                        {new Date(
                          segment.airport_arrival_target_at
                        ).toLocaleString()}
                      </p>
                    ) : null}
                    {segment.leave_for_airport_at ? (
                      <p className="mt-1 text-xs text-dusk-gold">
                        Leave for airport:{" "}
                        {new Date(segment.leave_for_airport_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                ))}

                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addTravel(prep.id, event.currentTarget);
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-label">
                      Type
                      <select className="form-input" name="kind" defaultValue="car">
                        <option value="car">Car</option>
                        <option value="flight">Flight</option>
                      </select>
                    </label>
                    <label className="form-label">
                      Provider
                      <input className="form-input" name="provider" />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-label">
                      Direction
                      <select className="form-input" name="direction" defaultValue="outbound">
                        <option value="outbound">Outbound</option>
                        <option value="return">Return</option>
                        <option value="local">Local con travel</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="form-label">
                      Car mode
                      <select className="form-input" name="carMode" defaultValue="self_drive">
                        <option value="self_drive">Drive myself</option>
                        <option value="carpool_driver">Carpool — I pick up others</option>
                        <option value="carpool_passenger">Carpool — I get picked up</option>
                      </select>
                    </label>
                  </div>

                  <label className="form-label">
                    Pickup / carpool notes
                    <input
                      className="form-input"
                      name="pickupNotes"
                      placeholder="Who, where, pickup sequence, etc."
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-label">
                      Origin
                      <input className="form-input" name="origin" />
                    </label>
                    <label className="form-label">
                      Destination
                      <input className="form-input" name="destination" />
                    </label>
                  </div>

                  <label className="form-label">
                    Departure ISO
                    <input
                      className="form-input"
                      name="departAt"
                      placeholder="2026-12-03T18:30:00-05:00"
                    />
                  </label>

                  <label className="form-label">
                    Arrival ISO
                    <input
                      className="form-input"
                      name="arriveAt"
                      placeholder="2026-12-03T20:20:00-06:00"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-label">
                      Home → airport transit (min)
                      <input
                        className="form-input"
                        name="transitMinutes"
                        type="number"
                        min="1"
                      />
                    </label>
                    <label className="form-label">
                      Extra travel buffer (min)
                      <input
                        className="form-input"
                        name="extraTravelBufferMinutes"
                        type="number"
                        min="0"
                        defaultValue="15"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-label">
                      Confirmation
                      <input className="form-input" name="confirmationCode" />
                    </label>
                    <label className="form-label">
                      Cost ($)
                      <input
                        className="form-input"
                        name="cost"
                        type="number"
                        min="0"
                        step="0.01"
                      />
                    </label>
                  </div>

                  <p className="text-xs text-slate-500">
                    Flights automatically target airport arrival 90 minutes
                    before departure. Add transit time to calculate when to leave.
                  </p>

                  <button className="button-secondary" type="submit">
                    Add travel
                  </button>
                </form>
              </section>

              <section className="card">
                <div className="eyebrow">Hotel</div>
                <h4 className="text-xl font-black">Stay details</h4>

                {(prep.hotel_stays ?? []).map((hotel) => (
                  <div
                    key={hotel.id}
                    className="mt-3 rounded-xl border border-dusk-line bg-white/[0.02] p-3"
                  >
                    <strong>{hotel.hotel_name}</strong>
                    {hotel.checkin_at ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Check-in: {new Date(hotel.checkin_at).toLocaleString()}
                      </p>
                    ) : null}
                    {hotel.checkout_at ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Check-out: {new Date(hotel.checkout_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                ))}

                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addHotel(prep.id, event.currentTarget);
                  }}
                >
                  <label className="form-label">
                    Hotel
                    <input className="form-input" name="hotelName" required />
                  </label>
                  <label className="form-label">
                    Address
                    <input className="form-input" name="address" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-label">
                      Check-in ISO
                      <input className="form-input" name="checkinAt" />
                    </label>
                    <label className="form-label">
                      Check-out ISO
                      <input className="form-input" name="checkoutAt" />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-label">
                      Confirmation
                      <input className="form-input" name="confirmationCode" />
                    </label>
                    <label className="form-label">
                      Cost ($)
                      <input
                        className="form-input"
                        name="cost"
                        type="number"
                        min="0"
                        step="0.01"
                      />
                    </label>
                  </div>
                  <button className="button-secondary" type="submit">
                    Add hotel
                  </button>
                </form>
              </section>

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <section className="card">
                <div className="eyebrow">Registration</div>
                <h4 className="text-xl font-black">Con Badge</h4>

                {(prep.con_registrations ?? []).map((registration) => (
                  <div
                    key={registration.id}
                    className="mt-3 rounded-xl border border-dusk-line bg-white/[0.02] p-3"
                  >
                    <strong>{registration.badge_name}</strong>
                    <p className="mt-1 text-sm text-slate-400">
                      {registration.status}
                      {registration.cost_cents !== null
                        ? ` · $${(registration.cost_cents / 100).toFixed(2)}`
                        : ""}
                    </p>
                  </div>
                ))}

                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveRegistration(prep.id, event.currentTarget);
                  }}
                >
                  <label className="form-label">
                    Badge
                    <input
                      className="form-input"
                      name="badgeName"
                      defaultValue={
                        prep.con_registrations?.[0]?.badge_name ?? "Con badge"
                      }
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-label">
                      Status
                      <select
                        className="form-input"
                        name="status"
                        defaultValue={
                          prep.con_registrations?.[0]?.status ?? "needed"
                        }
                      >
                        <option value="needed">Needed</option>
                        <option value="ordered">Ordered</option>
                        <option value="paid">Paid</option>
                        <option value="confirmed">Confirmed</option>
                      </select>
                    </label>
                    <label className="form-label">
                      Cost ($)
                      <input
                        className="form-input"
                        name="cost"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={
                          prep.con_registrations?.[0]?.cost_cents
                            ? prep.con_registrations[0].cost_cents! / 100
                            : ""
                        }
                      />
                    </label>
                  </div>
                  <label className="form-label">
                    Confirmation
                    <input
                      className="form-input"
                      name="confirmationCode"
                      defaultValue={
                        prep.con_registrations?.[0]?.confirmation_code ?? ""
                      }
                    />
                  </label>
                  <button className="button-secondary" type="submit">
                    Save registration
                  </button>
                </form>
              </section>

              <section className="card">
                <div className="eyebrow">Convention finances</div>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <h4 className="text-xl font-black">Projected Cost</h4>
                  <strong className="text-3xl text-dusk-gold">
                    $
                    {(
                      (prep.cost_entries ?? []).reduce(
                        (sum, cost) => sum + cost.amount_cents,
                        0
                      ) / 100
                    ).toFixed(2)}
                  </strong>
                </div>

                <div className="mt-3 space-y-2">
                  {(prep.cost_entries ?? []).map((cost) => (
                    <div
                      key={cost.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-dusk-line bg-white/[0.02] p-3"
                    >
                      <div>
                        <strong>{cost.description ?? cost.category}</strong>
                        <p className="text-xs text-slate-500">
                          {cost.category} · {cost.cost_status}
                          {cost.quickbooks_txn_id ? " · QuickBooks synced" : ""}
                        </p>
                      </div>
                      <strong>${(cost.amount_cents / 100).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>

                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addCost(prep.id, event.currentTarget);
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-label">
                      Category
                      <input
                        className="form-input"
                        name="category"
                        placeholder="food, parking, registration..."
                        required
                      />
                    </label>
                    <label className="form-label">
                      Amount ($)
                      <input
                        className="form-input"
                        name="amount"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                      />
                    </label>
                  </div>
                  <label className="form-label">
                    Description
                    <input className="form-input" name="description" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="form-label">
                      Vendor
                      <input className="form-input" name="vendor" />
                    </label>
                    <label className="form-label">
                      Status
                      <select
                        className="form-input"
                        name="costStatus"
                        defaultValue="planned"
                      >
                        <option value="estimated">Estimated</option>
                        <option value="planned">Planned</option>
                        <option value="paid">Paid</option>
                        <option value="reimbursed">Reimbursed</option>
                      </select>
                    </label>
                  </div>
                  <button className="button-secondary" type="submit">
                    Add cost
                  </button>
                </form>
              </section>
            </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
