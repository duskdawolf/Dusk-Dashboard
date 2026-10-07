import { createAlpha7SupabaseAdmin } from "./supabase-admin";

export const ALPHA7_ACTION_TYPES = [
  "upsert_hotel",
  "upsert_travel",
  "upsert_registration",
  "upsert_cost",
  "upsert_packing_item",
  "upsert_prep_task",
  "upsert_sub_event",
  "update_event",
  "update_con_prep",
] as const;

export type Alpha7ActionType = (typeof ALPHA7_ACTION_TYPES)[number];

type ActionPayload = {
  record_id?: string | null;
  changes?: Record<string, unknown>;
};

const ALLOWED: Record<Alpha7ActionType, Set<string>> = {
  upsert_hotel: new Set([
    "hotel_name",
    "address",
    "confirmation_code",
    "checkin_at",
    "checkout_at",
    "cost_cents",
    "currency",
  ]),
  upsert_travel: new Set([
    "kind",
    "provider",
    "confirmation_code",
    "origin",
    "destination",
    "depart_at",
    "arrive_at",
    "cost_cents",
    "currency",
    "airport_arrival_target_at",
    "leave_for_airport_at",
    "transit_minutes",
    "extra_travel_buffer_minutes",
    "direction",
    "car_mode",
    "pickup_notes",
  ]),
  upsert_registration: new Set([
    "badge_name",
    "status",
    "cost_cents",
    "confirmation_code",
  ]),
  upsert_cost: new Set([
    "category",
    "vendor",
    "description",
    "amount_cents",
    "currency",
    "incurred_at",
    "source",
    "external_key",
    "cost_status",
  ]),
  upsert_packing_item: new Set([
    "category",
    "label",
    "quantity",
    "packed",
    "sort_order",
    "notes",
    "parent_item_id",
    "source",
    "required",
  ]),
  upsert_sub_event: new Set([
    "title",
    "starts_at",
    "ends_at",
    "location",
    "room",
    "description",
    "attendance_status",
    "suiting_mode",
    "show_in_find_dusk",
    "feature_on_next_stop",
    "next_stop_priority",
    "reminder_enabled",
    "reminder_minutes_before",
    "source",
    "source_url",
    "source_metadata",
  ]),
  upsert_prep_task: new Set([
    "title",
    "task_type",
    "due_at",
    "duration_minutes",
    "status",
    "notes",
    "scheduled_start_at",
    "scheduled_end_at",
    "relative_days_before_departure",
    "parent_task_id",
    "sort_order",
    "source",
    "required",
    "counts_toward_readiness",
  ]),
  update_event: new Set([
    "title",
    "start_at",
    "end_at",
    "location",
    "description",
    "tag",
    "tags",
    "event_type",
    "state_code",
    "latitude",
    "longitude",
    "published",
    "route_visible",
    "route_order",
    "event_theme",
    "find_me_notes",
    "appearance_mode",
    "suiting_mode",
  ]),
  update_con_prep: new Set([
    "target_arrival_at",
    "leave_for_airport_at",
    "packing_deadline",
    "notes",
    "prep_deadline_at",
    "departure_at",
    "prep_complete_by",
  ]),
};

function sanitizeChanges(
  actionType: Alpha7ActionType,
  input: Record<string, unknown>,
) {
  const allowed = ALLOWED[actionType];
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) => allowed.has(key) && value !== undefined,
    ),
  );
}

function assertHasChanges(changes: Record<string, unknown>) {
  if (!Object.keys(changes).length) {
    throw new Error("No permitted record fields were supplied.");
  }
}

export async function executeAlpha7RecordAction(args: {
  actionType: Alpha7ActionType;
  payload: ActionPayload;
  conPrepId: string | null;
  eventId: string | null;
  userId: string;
}) {
  const supabase = createAlpha7SupabaseAdmin();
  const changes = sanitizeChanges(
    args.actionType,
    (args.payload.changes ?? {}) as Record<string, unknown>,
  );
  assertHasChanges(changes);

  const recordId =
    typeof args.payload.record_id === "string"
      ? args.payload.record_id
      : null;

  if (args.actionType === "update_event") {
    if (!args.eventId) throw new Error("This action has no event context.");
    const { data, error } = await supabase
      .from("events")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", args.eventId)
      .select("*")
      .single();
    if (error) throw error;
    return { table: "events", row: data };
  }

  if (args.actionType === "update_con_prep") {
    if (!args.conPrepId) {
      throw new Error("This action has no deployment context.");
    }
    const { data, error } = await supabase
      .from("con_preps")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", args.conPrepId)
      .select("*")
      .single();
    if (error) throw error;
    return { table: "con_preps", row: data };
  }

  if (!args.conPrepId) {
    throw new Error("This record action has no deployment context.");
  }

  const specs: Partial<
    Record<
      Alpha7ActionType,
      { table: string; defaults?: Record<string, unknown> }
    >
  > = {
    upsert_hotel: {
      table: "hotel_stays",
      defaults: { currency: "USD" },
    },
    upsert_travel: {
      table: "travel_segments",
      defaults: { kind: "other", currency: "USD" },
    },
    upsert_registration: {
      table: "con_registrations",
      defaults: { status: "needed" },
    },
    upsert_packing_item: {
      table: "packing_items",
      defaults: {
        category: "general",
        quantity: 1,
        packed: false,
        sort_order: 0,
        source: "manual",
        required: false,
      },
    },
    upsert_prep_task: {
      table: "prep_tasks",
      defaults: {
        task_type: "prep",
        status: "todo",
        sort_order: 0,
        source: "manual",
        required: false,
      },
    },
  };

  if (args.actionType === "upsert_sub_event") {
    if (
      Object.prototype.hasOwnProperty.call(changes, "starts_at") &&
      !changes.starts_at
    ) {
      throw new Error(
        "Schedule items require an exact start date/time. The proposed start time was empty.",
      );
    }

    if (!recordId && !changes.starts_at) {
      throw new Error(
        "Chaos cannot add this schedule item yet because no exact start date/time was extracted. Add the time manually or provide a schedule screenshot that clearly shows it.",
      );
    }

    if (!recordId && !changes.title) {
      throw new Error("Schedule items require a title.");
    }

    if (recordId) {
      const { data, error } = await supabase
        .from("deployment_sub_events")
        .update(changes)
        .eq("id", recordId)
        .eq("con_prep_id", args.conPrepId)
        .select("*")
        .single();
      if (error) throw error;
      return { table: "deployment_sub_events", row: data };
    }

    const { data, error } = await supabase
      .from("deployment_sub_events")
      .insert({
        con_prep_id: args.conPrepId,
        event_id: args.eventId,
        owner_user_id: args.userId,
        attendance_status: "going",
        suiting_mode: "inherit",
        show_in_find_dusk: false,
        feature_on_next_stop: false,
        reminder_enabled: true,
        reminder_minutes_before: 30,
        source: "chaos",
        ...changes,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { table: "deployment_sub_events", row: data };
  }

  if (args.actionType === "upsert_cost") {
    if (recordId) {
      const { data, error } = await supabase
        .from("cost_entries")
        .update(changes)
        .eq("id", recordId)
        .eq("con_prep_id", args.conPrepId)
        .select("*")
        .single();
      if (error) throw error;
      return { table: "cost_entries", row: data };
    }

    const { data, error } = await supabase
      .from("cost_entries")
      .insert({
        con_prep_id: args.conPrepId,
        event_id: args.eventId,
        owner_user_id: args.userId,
        currency: "USD",
        cost_status: "budgeted",
        ...changes,
        source: "manual",
      })
      .select("*")
      .single();
    if (error) throw error;
    return { table: "cost_entries", row: data };
  }

  const spec = specs[args.actionType];
  if (!spec) throw new Error(`Unsupported action: ${args.actionType}`);

  if (recordId) {
    const { data, error } = await supabase
      .from(spec.table)
      .update(changes)
      .eq("id", recordId)
      .eq("con_prep_id", args.conPrepId)
      .select("*")
      .single();
    if (error) throw error;
    return { table: spec.table, row: data };
  }

  const { data, error } = await supabase
    .from(spec.table)
    .insert({
      ...(spec.defaults ?? {}),
      con_prep_id: args.conPrepId,
      ...changes,
    })
    .select("*")
    .single();

  if (error) throw error;
  return { table: spec.table, row: data };
}
