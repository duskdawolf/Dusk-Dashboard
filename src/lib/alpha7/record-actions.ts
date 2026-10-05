import { createAlpha7SupabaseAdmin } from "./supabase-admin";

export const ALPHA7_ACTION_TYPES = [
  "upsert_hotel",
  "upsert_travel",
  "upsert_registration",
  "upsert_cost",
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
  update_event: new Set([
    "title",
    "start_at",
    "end_at",
    "location",
    "description",
    "tag",
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
  ]),
  update_con_prep: new Set([
    "status",
    "target_arrival_at",
    "leave_for_airport_at",
    "packing_deadline",
    "notes",
    "prep_deadline_at",
    "departure_at",
    "prep_complete_by",
    "readiness_score",
    "ai_summary",
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
    if (!args.conPrepId) throw new Error("This action has no deployment context.");
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

  if (args.actionType === "upsert_hotel") {
    if (recordId) {
      const { data, error } = await supabase
        .from("hotel_stays")
        .update(changes)
        .eq("id", recordId)
        .eq("con_prep_id", args.conPrepId)
        .select("*")
        .single();
      if (error) throw error;
      return { table: "hotel_stays", row: data };
    }
    const { data, error } = await supabase
      .from("hotel_stays")
      .insert({ con_prep_id: args.conPrepId, ...changes })
      .select("*")
      .single();
    if (error) throw error;
    return { table: "hotel_stays", row: data };
  }

  if (args.actionType === "upsert_travel") {
    if (recordId) {
      const { data, error } = await supabase
        .from("travel_segments")
        .update(changes)
        .eq("id", recordId)
        .eq("con_prep_id", args.conPrepId)
        .select("*")
        .single();
      if (error) throw error;
      return { table: "travel_segments", row: data };
    }
    const { data, error } = await supabase
      .from("travel_segments")
      .insert({ con_prep_id: args.conPrepId, ...changes })
      .select("*")
      .single();
    if (error) throw error;
    return { table: "travel_segments", row: data };
  }

  if (args.actionType === "upsert_registration") {
    if (recordId) {
      const { data, error } = await supabase
        .from("con_registrations")
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq("id", recordId)
        .eq("con_prep_id", args.conPrepId)
        .select("*")
        .single();
      if (error) throw error;
      return { table: "con_registrations", row: data };
    }
    const { data, error } = await supabase
      .from("con_registrations")
      .insert({ con_prep_id: args.conPrepId, ...changes })
      .select("*")
      .single();
    if (error) throw error;
    return { table: "con_registrations", row: data };
  }

  // Costs may be edited if a record id is known; otherwise create a new line.
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
        ...changes,
        source: "manual",
      })
      .select("*")
      .single();
    if (error) throw error;
    return { table: "cost_entries", row: data };
  }

  throw new Error(`Unsupported action: ${args.actionType}`);
}
