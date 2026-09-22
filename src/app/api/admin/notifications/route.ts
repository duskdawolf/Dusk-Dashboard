import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { createDuskNotification } from "@/lib/notifications";
import { topicForKey } from "@/lib/notification-catalog";

const CreateSchema = z.object({
  topicKey: z.string().min(1).max(160).default("system.generic"),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(4000),
  targetUrl: z.string().max(500).nullable().optional(),
  actionLabel: z.string().max(80).nullable().optional(),
  dedupeKey: z.string().max(300).nullable().optional(),
});

const UpdateSchema = z.union([
  z.object({
    id: z.string().uuid(),
    read: z.boolean(),
  }),
  z.object({
    markAllRead: z.literal(true),
  }),
]);

export async function GET(request: Request) {
  const user = await getDashboardUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const countOnly = url.searchParams.get("unreadCount") === "1";
  const supabase = createAdminSupabaseClient();

  if (countOnly) {
    const [{ count, error }, { data: prefs }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("dashboard_visible", true)
        .is("read_at", null),
      supabase
        .from("notification_preferences")
        .select("badge_count_enabled")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      unreadCount: prefs?.badge_count_enabled === false ? 0 : count ?? 0,
      badgeEnabled: prefs?.badge_count_enabled ?? true,
    });
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*, notification_deliveries(*)")
    .eq("user_id", user.id)
    .eq("dashboard_visible", true)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notifications: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getDashboardUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = CreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid notification.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const topic = topicForKey(input.topicKey);

  if (!topic) {
    return NextResponse.json(
      { error: "Unknown notification topic." },
      { status: 400 },
    );
  }

  try {
    const result = await createDuskNotification({
      userId: user.id,
      topicKey: input.topicKey,
      title: input.title,
      message: input.message,
      targetUrl: input.targetUrl ?? null,
      actionLabel: input.actionLabel ?? null,
      dedupeKey: input.dedupeKey ?? null,
      dedupeMinutes: 5,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not create notification.",
        detail: error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getDashboardUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = UpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();

  if ("markAllRead" in parsed.data) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("dashboard_visible", true)
      .is("read_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("notifications")
    .update({
      read_at: parsed.data.read ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
