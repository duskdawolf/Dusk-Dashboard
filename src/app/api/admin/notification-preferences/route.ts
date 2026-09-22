import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { NOTIFICATION_TOPICS } from "@/lib/notification-catalog";

const GlobalSchema = z.object({
  webPushEnabled: z.boolean(),
  telegramEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  quietHoursEnabled: z.boolean(),
  quietStart: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  quietEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  quietUrgentBypass: z.boolean(),
  badgeCountEnabled: z.boolean(),
  timezone: z.string().min(1).max(100),
});

const TopicSchema = z.object({
  eventKey: z.string().min(1).max(160),
  dashboardEnabled: z.boolean(),
  webPushEnabled: z.boolean(),
  telegramEnabled: z.boolean(),
  emailEnabled: z.boolean(),
});

const UpdateSchema = z.object({
  global: GlobalSchema.optional(),
  topic: TopicSchema.optional(),
  preset: z.enum(["recommended", "critical_only", "everything", "dashboard_only"]).optional(),
});

function topicPayload(
  userId: string,
  preset: "recommended" | "critical_only" | "everything" | "dashboard_only",
) {
  return NOTIFICATION_TOPICS.map((topic) => {
    let dashboard = topic.defaultDashboard;
    let push = topic.defaultPush;
    let telegram = topic.defaultTelegram;
    let email = topic.defaultEmail;

    if (preset === "critical_only") {
      dashboard = true;
      push = Boolean(topic.critical);
      telegram = Boolean(topic.critical);
      email = false;
    } else if (preset === "everything") {
      dashboard = true;
      push = true;
      telegram = true;
      email = false;
    } else if (preset === "dashboard_only") {
      dashboard = true;
      push = false;
      telegram = false;
      email = false;
    }

    return {
      user_id: userId,
      event_key: topic.key,
      dashboard_enabled: dashboard,
      web_push_enabled: push,
      telegram_enabled: telegram,
      email_enabled: email,
    };
  });
}

export async function GET() {
  const user = await getDashboardUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const [{ data: globalPrefs }, { data: topicPrefs }] = await Promise.all([
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("notification_topic_preferences")
      .select("*")
      .eq("user_id", user.id),
  ]);

  const byKey = new Map((topicPrefs ?? []).map((row) => [row.event_key, row]));

  const topics = NOTIFICATION_TOPICS.map((topic) => {
    const override = byKey.get(topic.key);
    return {
      ...topic,
      dashboardEnabled:
        override?.dashboard_enabled ?? topic.defaultDashboard,
      webPushEnabled:
        override?.web_push_enabled ?? topic.defaultPush,
      telegramEnabled:
        override?.telegram_enabled ?? topic.defaultTelegram,
      emailEnabled:
        override?.email_enabled ?? topic.defaultEmail,
    };
  });

  return NextResponse.json({
    global: {
      webPushEnabled: globalPrefs?.web_push_enabled ?? true,
      telegramEnabled: globalPrefs?.telegram_enabled ?? true,
      emailEnabled: globalPrefs?.email_enabled ?? false,
      quietHoursEnabled: globalPrefs?.quiet_hours_enabled ?? false,
      quietStart: globalPrefs?.quiet_start?.slice(0, 5) ?? "23:00",
      quietEnd: globalPrefs?.quiet_end?.slice(0, 5) ?? "07:00",
      quietUrgentBypass: globalPrefs?.quiet_urgent_bypass ?? true,
      badgeCountEnabled: globalPrefs?.badge_count_enabled ?? true,
      timezone: globalPrefs?.timezone ?? "America/New_York",
    },
    topics,
  });
}

export async function PATCH(request: Request) {
  const user = await getDashboardUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = UpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid preference update.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const input = parsed.data;

  if (input.global) {
    const global = input.global;
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          web_push_enabled: global.webPushEnabled,
          telegram_enabled: global.telegramEnabled,
          email_enabled: global.emailEnabled,
          quiet_hours_enabled: global.quietHoursEnabled,
          quiet_start: global.quietStart,
          quiet_end: global.quietEnd,
          quiet_urgent_bypass: global.quietUrgentBypass,
          badge_count_enabled: global.badgeCountEnabled,
          timezone: global.timezone,
        },
        { onConflict: "user_id" },
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (input.topic) {
    const topic = input.topic;
    const valid = NOTIFICATION_TOPICS.some((item) => item.key === topic.eventKey);

    if (!valid) {
      return NextResponse.json(
        { error: "Unknown notification topic." },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("notification_topic_preferences")
      .upsert(
        {
          user_id: user.id,
          event_key: topic.eventKey,
          dashboard_enabled: topic.dashboardEnabled,
          web_push_enabled: topic.webPushEnabled,
          telegram_enabled: topic.telegramEnabled,
          email_enabled: topic.emailEnabled,
        },
        { onConflict: "user_id,event_key" },
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (input.preset) {
    const { error } = await supabase
      .from("notification_topic_preferences")
      .upsert(topicPayload(user.id, input.preset), {
        onConflict: "user_id,event_key",
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
