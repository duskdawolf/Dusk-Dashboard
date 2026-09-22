import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  scheduleTaskOutsideWork,
  type WorkBlock,
} from "@/lib/scheduling";

const Payload = z.object({
  conPrepId: z.string().uuid(),
});

export async function POST(request: Request) {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = Payload.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid prep id." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const [
    { data: tasks, error: taskError },
    { data: workBlocks, error: workError },
    { data: overrides, error: overrideError },
    { data: settingsRow },
  ] = await Promise.all([
      supabase
        .from("prep_tasks")
        .select("*")
        .eq("con_prep_id", parsed.data.conPrepId)
        .neq("task_type", "production")
        .neq("status", "done"),
      supabase
        .from("weekly_work_blocks")
        .select("*")
        .eq("active", true),
      supabase
        .from("schedule_overrides")
        .select("*")
        .in("block_type", ["work", "unavailable"]),
      supabase
        .from("site_settings")
        .select("value")
        .eq("key", "scheduling")
        .maybeSingle(),
    ]);

  if (taskError || workError || overrideError) {
    return NextResponse.json(
      {
        error: "Could not load scheduling inputs.",
        detail:
          taskError?.message ??
          workError?.message ??
          overrideError?.message,
      },
      { status: 500 }
    );
  }

  const settings = (settingsRow?.value ?? {}) as Record<string, unknown>;
  const timezone =
    (typeof settings.home_timezone === "string" && settings.home_timezone) ||
    process.env.DUSK_HOME_TIMEZONE ||
    "America/New_York";

  const scheduled = [];
  const unscheduled = [];

  // Schedule from earliest due task to latest so deadlines do not get crowded out.
  const orderedTasks = [...(tasks ?? [])].sort((a, b) => {
    const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });

  for (const task of orderedTasks) {
    if (!task.due_at || !task.duration_minutes) {
      unscheduled.push({ id: task.id, reason: "Missing due_at or duration_minutes" });
      continue;
    }

    let result = scheduleTaskOutsideWork({
      durationMinutes: task.duration_minutes,
      deadlineIso: task.due_at,
      workBlocks: (workBlocks ?? []) as WorkBlock[],
      timezone,
      maxLookbackDays: 14,
    });

    // If the chosen window overlaps a one-off block (inventory, appointment, etc.),
    // move the effective deadline to the start of that override and try again.
    for (const override of overrides ?? []) {
      if (!result.block) break;

      const blockStart = new Date(result.block.startAt).getTime();
      const blockEnd = new Date(result.block.endAt).getTime();
      const overrideStart = new Date(override.starts_at).getTime();
      const overrideEnd = new Date(override.ends_at).getTime();

      const overlaps =
        blockStart < overrideEnd && blockEnd > overrideStart;

      if (overlaps) {
        result = scheduleTaskOutsideWork({
          durationMinutes: task.duration_minutes,
          deadlineIso: override.starts_at,
          workBlocks: (workBlocks ?? []) as WorkBlock[],
          timezone,
          maxLookbackDays: 14,
        });
      }
    }

    if (!result.complete || !result.block) {
      unscheduled.push({ id: task.id, reason: "No qualifying window found" });
      continue;
    }

    const { error } = await supabase
      .from("prep_tasks")
      .update({
        scheduled_start_at: result.block.startAt,
        scheduled_end_at: result.block.endAt,
        status: "scheduled",
      })
      .eq("id", task.id);

    if (error) {
      unscheduled.push({ id: task.id, reason: error.message });
    } else {
      scheduled.push({
        id: task.id,
        title: task.title,
        startAt: result.block.startAt,
        endAt: result.block.endAt,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    timezone,
    scheduled,
    unscheduled,
  });
}
