import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  const user = await getDashboardUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = SubscriptionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: request.headers.get("user-agent"),
        active: true,
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getDashboardUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  const endpoint = String(body.endpoint ?? "");

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ active: false })
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
