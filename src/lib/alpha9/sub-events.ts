import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

const ALLOWED = new Set([
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
]);

function clean(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => ALLOWED.has(key) && value !== undefined,
    ),
  );
}

async function prepContext(conPrepId: string, userId: string) {
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

async function markNextStopStale(eventId: string) {
  const supabase = createAlpha7SupabaseAdmin();
  const { error } = await supabase
    .from("events")
    .update({
      next_stop_asset_status: "stale",
      next_stop_copy: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) throw error;
}

export async function createSubEvent(args: {
  conPrepId: string;
  userId: string;
  values: Record<string, unknown>;
}) {
  const prep = await prepContext(args.conPrepId, args.userId);
  const values = clean(args.values);

  if (!values.title || !values.starts_at) {
    throw new Error("Sub-event title and start time are required.");
  }

  const supabase = createAlpha7SupabaseAdmin();
  const { data, error } = await supabase
    .from("deployment_sub_events")
    .insert({
      con_prep_id: args.conPrepId,
      event_id: prep.event_id,
      owner_user_id: args.userId,
      source: "manual",
      ...values,
    })
    .select("*")
    .single();

  if (error) throw error;
  await markNextStopStale(prep.event_id);
  return data;
}

export async function updateSubEvent(args: {
  conPrepId: string;
  userId: string;
  id: string;
  values: Record<string, unknown>;
}) {
  const prep = await prepContext(args.conPrepId, args.userId);
  const values = clean(args.values);

  const resetReminder =
    Object.prototype.hasOwnProperty.call(values, "starts_at") ||
    Object.prototype.hasOwnProperty.call(values, "reminder_enabled") ||
    Object.prototype.hasOwnProperty.call(values, "reminder_minutes_before");

  const supabase = createAlpha7SupabaseAdmin();
  const { data, error } = await supabase
    .from("deployment_sub_events")
    .update({
      ...values,
      ...(resetReminder ? { reminder_last_queued_at: null } : {}),
    })
    .eq("id", args.id)
    .eq("con_prep_id", args.conPrepId)
    .select("*")
    .single();

  if (error) throw error;
  await markNextStopStale(prep.event_id);
  return data;
}

export async function deleteSubEvent(args: {
  conPrepId: string;
  userId: string;
  id: string;
}) {
  const prep = await prepContext(args.conPrepId, args.userId);
  const supabase = createAlpha7SupabaseAdmin();
  const { error } = await supabase
    .from("deployment_sub_events")
    .delete()
    .eq("id", args.id)
    .eq("con_prep_id", args.conPrepId);

  if (error) throw error;
  await markNextStopStale(prep.event_id);
}
