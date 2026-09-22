import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { sendWebPush } from "@/lib/push";

const CreateSchema = z.object({
  severity: z.enum(["info","action","reminder","urgent"]).default("info"),
  category: z.enum([
    "events","con_prep","sticker_factory","orders","shipping","social","finance","system"
  ]).default("system"),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(4000),
  targetUrl: z.string().max(500).nullable().optional(),
  channels: z.array(z.enum(["web_push","telegram","email"])).default(["web_push"]),
});

const ReadSchema = z.object({
  id: z.string().uuid(),
  read: z.boolean(),
});

export async function GET() {
  const user = await getDashboardUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*, notification_deliveries(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notifications: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getDashboardUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = CreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification." }, { status: 400 });
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  const { data: notification, error } = await supabase
    .from("notifications")
    .insert({
      user_id: user.id,
      severity: input.severity,
      category: input.category,
      title: input.title,
      message: input.message,
      target_url: input.targetUrl ?? null,
    })
    .select("*")
    .single();

  if (error || !notification) {
    return NextResponse.json(
      { error: "Could not create notification.", detail: error?.message },
      { status: 500 }
    );
  }

  await supabase.from("notification_deliveries").insert(
    input.channels.map((channel) => ({
      notification_id: notification.id,
      channel,
      status: "pending",
    }))
  );

  if (input.channels.includes("web_push")) {
    const result = await sendWebPush(notification);

    await supabase
      .from("notification_deliveries")
      .update({
        status: result.skipped ? "skipped" : result.failed > 0 ? "failed" : "sent",
        attempt_count: 1,
        sent_at: result.sent > 0 ? new Date().toISOString() : null,
        error_message:
          result.failed > 0 ? `${result.failed} push subscription(s) failed.` : null,
      })
      .eq("notification_id", notification.id)
      .eq("channel", "web_push");
  }

  return NextResponse.json({ notification }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getDashboardUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = ReadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: parsed.data.read ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
