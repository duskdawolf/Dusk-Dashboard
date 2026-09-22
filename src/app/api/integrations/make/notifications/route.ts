import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

function authorized(request: Request) {
  const expected = process.env.MAKE_WEBHOOK_SECRET;
  return Boolean(
    expected &&
      request.headers.get("authorization") === `Bearer ${expected}`,
  );
}

const ReceiptSchema = z.object({
  deliveryId: z.string().uuid(),
  status: z.enum(["sent", "failed", "skipped"]),
  providerMessageId: z.string().max(500).nullable().optional(),
  errorMessage: z.string().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const channel = url.searchParams.get("channel") ?? "telegram";

  if (!["telegram", "email"].includes(channel)) {
    return NextResponse.json(
      { error: "Unsupported queued delivery channel." },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("id, channel, status, attempt_count, next_attempt_at, notifications(*)")
    .eq("channel", channel)
    .eq("status", "pending")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ channel, deliveries: data ?? [] });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = ReceiptSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid delivery receipt.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  const { data: current } = await supabase
    .from("notification_deliveries")
    .select("attempt_count")
    .eq("id", input.deliveryId)
    .maybeSingle();

  const failed = input.status === "failed";
  const nextAttempt =
    failed && (current?.attempt_count ?? 0) < 2
      ? new Date(Date.now() + 15 * 60_000).toISOString()
      : null;

  const finalStatus =
    failed && nextAttempt ? "pending" : input.status;

  const { error } = await supabase
    .from("notification_deliveries")
    .update({
      status: finalStatus,
      provider_message_id: input.providerMessageId ?? null,
      error_message: input.errorMessage ?? null,
      sent_at: input.status === "sent" ? new Date().toISOString() : null,
      attempt_count: (current?.attempt_count ?? 0) + 1,
      next_attempt_at: nextAttempt,
    })
    .eq("id", input.deliveryId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    retryScheduled: Boolean(nextAttempt),
  });
}
