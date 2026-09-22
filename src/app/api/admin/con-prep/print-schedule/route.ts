import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  DEFAULT_STICKERS_PER_HOUR,
  scheduleProductionIntoWindows,
  type AvailabilityWindow,
} from "@/lib/scheduling";

const Payload = z.object({
  conPrepId: z.string().uuid(),
  quantity: z.number().int().positive().max(100000),
  deadlineIso: z.string().datetime({ offset: true }).optional(),
});

export async function POST(request: Request) {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = Payload.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid print scheduling request.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();

  const { data: prep, error: prepError } = await supabase
    .from("con_preps")
    .select("id, event_id, prep_deadline_at, events(id,title,start_at)")
    .eq("id", parsed.data.conPrepId)
    .single();

  if (prepError || !prep) {
    return NextResponse.json(
      { error: "Con prep not found.", detail: prepError?.message },
      { status: 404 }
    );
  }

  const { data: windows, error: windowError } = await supabase
    .from("availability_windows")
    .select("*")
    .eq("window_type", "printing")
    .eq("active", true);

  if (windowError) {
    return NextResponse.json(
      { error: "Could not load printing windows.", detail: windowError.message },
      { status: 500 }
    );
  }

  const { data: settingsRow } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "scheduling")
    .maybeSingle();

  const settings = (settingsRow?.value ?? {}) as Record<string, unknown>;
  const timezone =
    (typeof settings.home_timezone === "string" && settings.home_timezone) ||
    process.env.DUSK_HOME_TIMEZONE ||
    "America/New_York";

  const stickersPerHour =
    typeof settings.stickers_per_hour === "number"
      ? settings.stickers_per_hour
      : DEFAULT_STICKERS_PER_HOUR;

  const eventRecord = Array.isArray(prep.events)
    ? prep.events[0]
    : prep.events;

  const deadlineIso = parsed.data.deadlineIso || prep.prep_deadline_at || eventRecord?.start_at;

  if (!deadlineIso) {
    return NextResponse.json(
      { error: "No event start time or print deadline is available." },
      { status: 400 }
    );
  }

  const schedule = scheduleProductionIntoWindows({
    quantity: parsed.data.quantity,
    deadlineIso,
    windows: (windows ?? []) as AvailabilityWindow[],
    timezone,
    stickersPerHour,
  });

  if (!schedule.complete) {
    return NextResponse.json(
      {
        error: "Not enough printing-window capacity before the deadline.",
        schedule,
      },
      { status: 409 }
    );
  }

  // Replace previously auto-generated sticker-production blocks for this prep.
  await supabase
    .from("prep_tasks")
    .delete()
    .eq("con_prep_id", prep.id)
    .eq("task_type", "production")
    .like("title", "Print % stickers%");

  const tasks = schedule.blocks.map((block, index) => ({
    con_prep_id: prep.id,
    title:
      schedule.blocks.length === 1
        ? `Print ${parsed.data.quantity} stickers`
        : `Print ${parsed.data.quantity} stickers — block ${index + 1}/${schedule.blocks.length}`,
    task_type: "production",
    status: "scheduled",
    duration_minutes: block.minutes,
    due_at: block.endAt,
    scheduled_start_at: block.startAt,
    scheduled_end_at: block.endAt,
    notes: `Auto-scheduled at ${stickersPerHour} stickers/hour using Dusk's recurring printing windows.`,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("prep_tasks")
    .insert(tasks)
    .select("*");

  if (insertError) {
    return NextResponse.json(
      { error: "Could not save print schedule.", detail: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    quantity: parsed.data.quantity,
    stickersPerHour,
    timezone,
    schedule,
    tasks: inserted ?? [],
  });
}
