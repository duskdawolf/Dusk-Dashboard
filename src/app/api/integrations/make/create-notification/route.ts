import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { sendWebPush } from "@/lib/push";

function authorized(request: Request) {
  const expected = process.env.MAKE_WEBHOOK_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

const Payload = z.object({
  adminEmail: z.string().email(),
  severity: z.enum(["info","action","reminder","urgent"]).default("info"),
  category: z.enum([
    "events","con_prep","sticker_factory","orders","shipping","social","finance","system"
  ]).default("system"),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(4000),
  targetUrl: z.string().max(500).nullable().optional(),
  channels: z.array(z.enum(["web_push","telegram","email"])).default(["web_push","telegram"]),
});

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = Payload.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification payload." }, { status: 400 });
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  const user = userData.users.find(
    (item) => item.email?.toLowerCase() === input.adminEmail.toLowerCase()
  );

  if (!user) {
    return NextResponse.json({ error: "Admin user not found." }, { status: 404 });
  }

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
    return NextResponse.json({ error: error?.message ?? "Could not create notification." }, { status: 500 });
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
      })
      .eq("notification_id", notification.id)
      .eq("channel", "web_push");
  }

  return NextResponse.json({ ok: true, notification });
}
