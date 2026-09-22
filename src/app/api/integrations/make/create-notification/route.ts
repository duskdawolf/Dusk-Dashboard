import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { createDuskNotification } from "@/lib/notifications";
import { topicForKey } from "@/lib/notification-catalog";

function authorized(request: Request) {
  const expected = process.env.MAKE_WEBHOOK_SECRET;
  return Boolean(
    expected &&
      request.headers.get("authorization") === `Bearer ${expected}`,
  );
}

const Payload = z.object({
  adminEmail: z.string().email(),
  topicKey: z.string().min(1).max(160).default("system.generic"),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(4000),
  targetUrl: z.string().max(500).nullable().optional(),
  actionLabel: z.string().max(80).nullable().optional(),
  dedupeKey: z.string().max(300).nullable().optional(),
  dedupeMinutes: z.number().int().min(1).max(10080).optional(),
  eventId: z.string().uuid().nullable().optional(),
  postId: z.string().uuid().nullable().optional(),
  orderId: z.string().uuid().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = Payload.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid notification payload.", details: parsed.error.flatten() },
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

  const supabase = createAdminSupabaseClient();
  const { data: userData, error: userError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  const user = userData.users.find(
    (item) =>
      item.email?.toLowerCase() === input.adminEmail.toLowerCase(),
  );

  if (!user) {
    return NextResponse.json(
      { error: "Admin user not found." },
      { status: 404 },
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
      dedupeMinutes: input.dedupeMinutes,
      eventId: input.eventId ?? null,
      postId: input.postId ?? null,
      orderId: input.orderId ?? null,
      payload: input.payload ?? {},
    });

    return NextResponse.json({ ok: true, ...result });
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
