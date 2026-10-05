import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

export const WORKSPACE_RESOURCES = [
  "packing",
  "task",
  "hotel",
  "travel",
  "registration",
  "cost",
  "prep",
  "event",
] as const;

export type WorkspaceResource = (typeof WORKSPACE_RESOURCES)[number];

const CONFIG = {
  packing: {
    table: "packing_items",
    allowed: [
      "category",
      "label",
      "quantity",
      "packed",
      "sort_order",
      "notes",
      "parent_item_id",
      "source",
      "required",
    ],
  },
  task: {
    table: "prep_tasks",
    allowed: [
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
    ],
  },
  hotel: {
    table: "hotel_stays",
    allowed: [
      "hotel_name",
      "address",
      "confirmation_code",
      "checkin_at",
      "checkout_at",
      "cost_cents",
      "currency",
    ],
  },
  travel: {
    table: "travel_segments",
    allowed: [
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
    ],
  },
  registration: {
    table: "con_registrations",
    allowed: ["badge_name", "status", "cost_cents", "confirmation_code"],
  },
  cost: {
    table: "cost_entries",
    allowed: [
      "category",
      "vendor",
      "description",
      "amount_cents",
      "currency",
      "incurred_at",
      "source",
      "external_key",
      "cost_status",
    ],
  },
  prep: {
    table: "con_preps",
    allowed: [
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
    ],
  },
  event: {
    table: "events",
    allowed: [
      "title",
      "start_at",
      "end_at",
      "location",
      "description",
      "tag",
      "event_type",
      "state_code",
      "published",
      "route_visible",
      "route_order",
      "event_theme",
      "find_me_notes",
      "appearance_mode",
    ],
  },
} satisfies Record<
  WorkspaceResource,
  { table: string; allowed: readonly string[] }
>;

function cleanValues(
  resource: WorkspaceResource,
  values: Record<string, unknown>,
) {
  const allowed = new Set(CONFIG[resource].allowed);
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => allowed.has(key) && value !== undefined,
    ),
  );
}

async function ownedPrep(conPrepId: string, userId: string) {
  const supabase = createAlpha7SupabaseAdmin();
  const { data, error } = await supabase
    .from("con_preps")
    .select("id,event_id,owner_user_id")
    .eq("id", conPrepId)
    .single();

  if (error) throw error;
  if (data.owner_user_id && data.owner_user_id !== userId) {
    throw new Error("FORBIDDEN");
  }

  return data;
}

export async function createWorkspaceRecord(args: {
  conPrepId: string;
  userId: string;
  resource: WorkspaceResource;
  values: Record<string, unknown>;
}) {
  if (args.resource === "prep" || args.resource === "event") {
    throw new Error("Use update for prep/event records.");
  }

  const prep = await ownedPrep(args.conPrepId, args.userId);
  const supabase = createAlpha7SupabaseAdmin();
  const values = cleanValues(args.resource, args.values);

  if (!Object.keys(values).length) {
    throw new Error("No permitted fields supplied.");
  }

  let row: Record<string, unknown> = {
    con_prep_id: args.conPrepId,
    ...values,
  };

  if (args.resource === "packing") {
    row = {
      category: "general",
      quantity: 1,
      packed: false,
      sort_order: 0,
      source: "manual",
      required: false,
      ...row,
    };
  }

  if (args.resource === "task") {
    row = {
      task_type: "prep",
      status: "todo",
      sort_order: 0,
      source: "manual",
      required: false,
      ...row,
    };
  }

  if (args.resource === "hotel") {
    row = { currency: "USD", ...row };
  }

  if (args.resource === "travel") {
    row = { kind: "other", currency: "USD", ...row };
  }

  if (args.resource === "registration") {
    row = { status: "needed", ...row };
  }

  if (args.resource === "cost") {
    row = {
      event_id: prep.event_id,
      owner_user_id: args.userId,
      currency: "USD",
      source: "manual",
      cost_status: "planned",
      ...row,
    };
  }

  const { data, error } = await supabase
    .from(CONFIG[args.resource].table)
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkspaceRecord(args: {
  conPrepId: string;
  userId: string;
  resource: WorkspaceResource;
  recordId?: string | null;
  values: Record<string, unknown>;
}) {
  const prep = await ownedPrep(args.conPrepId, args.userId);
  const supabase = createAlpha7SupabaseAdmin();
  const values = cleanValues(args.resource, args.values);

  if (!Object.keys(values).length) {
    throw new Error("No permitted fields supplied.");
  }

  if (args.resource === "prep") {
    const { data, error } = await supabase
      .from("con_preps")
      .update(values)
      .eq("id", args.conPrepId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  if (args.resource === "event") {
    const { data, error } = await supabase
      .from("events")
      .update(values)
      .eq("id", prep.event_id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  if (!args.recordId) throw new Error("recordId is required.");

  const { data, error } = await supabase
    .from(CONFIG[args.resource].table)
    .update(values)
    .eq("id", args.recordId)
    .eq("con_prep_id", args.conPrepId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWorkspaceRecord(args: {
  conPrepId: string;
  userId: string;
  resource: WorkspaceResource;
  recordId: string;
}) {
  if (args.resource === "prep" || args.resource === "event") {
    throw new Error("Event/deployment deletion is handled separately.");
  }

  await ownedPrep(args.conPrepId, args.userId);
  const supabase = createAlpha7SupabaseAdmin();

  const { error } = await supabase
    .from(CONFIG[args.resource].table)
    .delete()
    .eq("id", args.recordId)
    .eq("con_prep_id", args.conPrepId);

  if (error) throw error;
  return { deleted: true };
}
