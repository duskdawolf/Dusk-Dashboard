import { NextRequest, NextResponse } from "next/server";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

function authorized(request: NextRequest) {
  const secret = process.env.MAKE_WEBHOOK_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAlpha7SupabaseAdmin();
  const now = Date.now();
  const horizon = new Date(now + 26 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("deployment_sub_events")
    .select("*,events:event_id(title)")
    .eq("reminder_enabled", true)
    .neq("attendance_status", "not_going")
    .gte("starts_at", new Date(now - 10 * 60 * 1000).toISOString())
    .lte("starts_at", horizon);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let queued = 0;

  for (const row of rows ?? []) {
    const startMs = new Date(row.starts_at).valueOf();
    const reminderAt =
      startMs - Number(row.reminder_minutes_before ?? 30) * 60 * 1000;

    // Designed for a Make schedule every five minutes.
    if (reminderAt > now || reminderAt < now - 6 * 60 * 1000) continue;
    if (row.reminder_last_queued_at) continue;

    const dedupeKey =
      `deployment-sub-event:${row.id}:${row.starts_at}:${row.reminder_minutes_before}`;

    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("deployment_sub_events")
        .update({ reminder_last_queued_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }

    const eventTitle = (row.events as any)?.title ?? "Convention";
    const minutes = Number(row.reminder_minutes_before ?? 30);

    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: row.owner_user_id,
        severity: "reminder",
        category: "con_prep",
        title: `${row.title} starts in ${minutes} min`,
        message:
          `${eventTitle}${row.room ? ` · ${row.room}` : row.location ? ` · ${row.location}` : ""}`,
        target_url: `/dashboard/con-prep?prep=${row.con_prep_id}`,
        event_id: row.event_id,
        scheduled_for: new Date().toISOString(),
        event_key: "con_prep.sub_event_reminder",
        dedupe_key: dedupeKey,
        action_label: "Open Convention Ops",
        payload: {
          sub_event_id: row.id,
          starts_at: row.starts_at,
          reminder_minutes_before: minutes,
        },
      })
      .select("id")
      .single();

    if (notificationError) throw notificationError;

    const { error: deliveryError } = await supabase
      .from("notification_deliveries")
      .insert({
        notification_id: notification.id,
        channel: "web_push",
        status: "pending",
      });

    if (deliveryError) throw deliveryError;

    await supabase
      .from("deployment_sub_events")
      .update({ reminder_last_queued_at: new Date().toISOString() })
      .eq("id", row.id);

    queued += 1;
  }

  return NextResponse.json({ ok: true, queued });
}
