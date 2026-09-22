import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

function authorized(request: Request) {
  const expected = process.env.MAKE_WEBHOOK_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

const ReceiptSchema = z.object({
  deliveryId: z.string().uuid(),
  status: z.enum(["sent","failed","skipped"]),
  providerMessageId: z.string().max(500).nullable().optional(),
  errorMessage: z.string().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("id, channel, status, attempt_count, notifications(*)")
    .eq("channel", "telegram")
    .eq("status", "pending")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deliveries: data ?? [] });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = ReceiptSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid delivery receipt." }, { status: 400 });
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase
    .from("notification_deliveries")
    .update({
      status: input.status,
      provider_message_id: input.providerMessageId ?? null,
      error_message: input.errorMessage ?? null,
      sent_at: input.status === "sent" ? new Date().toISOString() : null,
      attempt_count: 1,
    })
    .eq("id", input.deliveryId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
