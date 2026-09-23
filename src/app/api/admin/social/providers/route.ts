import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { getSocialProviderStatuses } from "@/lib/social/providers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const TestSchema = z.object({
  platform: z.literal("telegram"),
});

async function telegramTestMessage() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    return {
      ok: false,
      error: "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be configured.",
    };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text:
          "🐾 Dusk Industries Social Ops provider test\n\nTelegram v25.2 connection is operational.",
        ...(process.env.TELEGRAM_MESSAGE_THREAD_ID
          ? {
              message_thread_id: Number(
                process.env.TELEGRAM_MESSAGE_THREAD_ID,
              ),
            }
          : {}),
      }),
      cache: "no-store",
    },
  );

  const body = await response.json();

  if (!response.ok || !body?.ok) {
    return {
      ok: false,
      error:
        body?.description ||
        `Telegram returned HTTP ${response.status}.`,
    };
  }

  return {
    ok: true,
    messageId: body.result?.message_id ?? null,
  };
}

export async function GET() {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const providers = await getSocialProviderStatuses(user.id);

  return NextResponse.json({
    providers,
    livePlatforms: ["telegram", "twitter", "instagram"],
    version: "25.2",
  });
}

export async function POST(request: Request) {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = TestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Unsupported provider test." },
      { status: 400 },
    );
  }

  const result = await telegramTestMessage();

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Telegram test failed." },
      { status: 502 },
    );
  }

  // Record a provider health timestamp on any Telegram rows that exist. This is
  // intentionally lightweight; provider credentials remain in Vercel, not DB.
  const supabase = createAdminSupabaseClient();
  await supabase
    .from("post_platforms")
    .update({ last_provider_check: new Date().toISOString() })
    .eq("platform", "telegram");

  return NextResponse.json(result);
}
