import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

function authorized(request: Request) {
  const expected = process.env.MAKE_WEBHOOK_SECRET;
  return Boolean(
    expected &&
      request.headers.get("authorization") === `Bearer ${expected}`
  );
}

const MetricsSchema = z.object({
  platformId: z.string().uuid(),
  capturedAt: z.string().datetime({ offset: true }).optional(),
  impressions: z.number().int().nonnegative().nullable().optional(),
  reach: z.number().int().nonnegative().nullable().optional(),
  likes: z.number().int().nonnegative().nullable().optional(),
  comments: z.number().int().nonnegative().nullable().optional(),
  shares: z.number().int().nonnegative().nullable().optional(),
  saves: z.number().int().nonnegative().nullable().optional(),
  clicks: z.number().int().nonnegative().nullable().optional(),
  videoViews: z.number().int().nonnegative().nullable().optional(),
  watchTimeSeconds: z.number().int().nonnegative().nullable().optional(),
  followersGained: z.number().int().nullable().optional(),
});

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = MetricsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid metrics payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase.from("post_metrics").insert({
    post_platform_id: input.platformId,
    captured_at: input.capturedAt ?? new Date().toISOString(),
    impressions: input.impressions ?? null,
    reach: input.reach ?? null,
    likes: input.likes ?? null,
    comments: input.comments ?? null,
    shares: input.shares ?? null,
    saves: input.saves ?? null,
    clicks: input.clicks ?? null,
    video_views: input.videoViews ?? null,
    watch_time_seconds: input.watchTimeSeconds ?? null,
    followers_gained: input.followersGained ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
