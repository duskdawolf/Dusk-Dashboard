import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/notifications";
import { reconcileSocialPost } from "@/lib/social/reconcile";

function authorized(request: Request) {
  const expected = process.env.MAKE_WEBHOOK_SECRET;
  return Boolean(
    expected &&
      request.headers.get("authorization") === `Bearer ${expected}`,
  );
}

const ReceiptSchema = z.object({
  platformId: z.string().uuid(),
  status: z.enum(["published", "failed"]),
  platformPostId: z.string().max(1000).nullable().optional(),
  postUrl: z.string().max(3000).nullable().optional(),
  providerAccount: z.string().max(1000).nullable().optional(),
  publishedCaption: z.string().max(10000).nullable().optional(),
  publishedMedia: z.array(z.record(z.string(), z.unknown())).optional(),
  providerResponse: z.record(z.string(), z.unknown()).optional(),
  makeJobId: z.string().max(1000).nullable().optional(),
  errorMessage: z.string().max(4000).nullable().optional(),
  publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const includeTelegram =
    url.searchParams.get("includeTelegram") === "1";

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("post_platforms")
    .select(`
      id,
      post_id,
      platform,
      platform_caption_override,
      status,
      scheduled_at,
      attempt_count,
      posts!inner (
        id,
        event_id,
        title,
        master_caption,
        status,
        scheduled_at,
        automation_status,
        events (
          id,
          slug,
          title,
          location,
          start_at
        ),
        post_media (
          sort_order,
          media (
            id,
            title,
            kind,
            url,
            mime_type,
            alt_text,
            caption
          )
        )
      )
    `)
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  // v25.0 Telegram is handled by /social-dispatch to avoid duplicate sends.
  // The generic jobs endpoint remains available for future X/Instagram adapters.
  if (!includeTelegram) {
    query = query.neq("platform", "telegram");
  }

  const { data, error } = await query
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const jobs = (data ?? []).map((row: any) => {
    const post = row.posts;
    const media = [...(post?.post_media ?? [])]
      .sort(
        (a: any, b: any) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0),
      )
      .map((join: any) => join.media)
      .filter(Boolean);

    return {
      platformId: row.id,
      postId: row.post_id,
      platform: row.platform,
      caption:
        row.platform_caption_override ||
        post?.master_caption ||
        "",
      scheduledAt: row.scheduled_at,
      attemptCount: row.attempt_count ?? 0,
      title: post?.title,
      event: post?.events ?? null,
      media,
    };
  });

  return NextResponse.json({
    jobs,
    note: includeTelegram
      ? "Telegram included explicitly."
      : "Telegram excluded because v25.0 live Telegram is dispatched by /api/integrations/make/social-dispatch.",
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = ReceiptSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid publishing receipt.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  const { data: current, error: currentError } = await supabase
    .from("post_platforms")
    .select("id,post_id,platform,attempt_count")
    .eq("id", input.platformId)
    .single();

  if (currentError || !current) {
    return NextResponse.json(
      {
        error:
          currentError?.message ?? "Platform job not found.",
      },
      { status: 404 },
    );
  }

  const { error } = await supabase
    .from("post_platforms")
    .update({
      status: input.status,
      platform_post_id: input.platformPostId ?? null,
      post_url: input.postUrl ?? null,
      provider_account: input.providerAccount ?? null,
      published_caption: input.publishedCaption ?? null,
      published_media: input.publishedMedia ?? [],
      provider_response: input.providerResponse ?? {},
      make_job_id: input.makeJobId ?? null,
      last_error:
        input.status === "failed"
          ? input.errorMessage ??
            "Unknown publishing error."
          : null,
      attempt_count: (current.attempt_count ?? 0) + 1,
      published_at:
        input.status === "published"
          ? input.publishedAt ?? new Date().toISOString()
          : null,
      last_provider_check: new Date().toISOString(),
    })
    .eq("id", input.platformId);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  await reconcileSocialPost(current.post_id);

  const { data: post } = await supabase
    .from("posts")
    .select("id,title,event_id")
    .eq("id", current.post_id)
    .maybeSingle();

  if (input.status === "published") {
    await notifyAdmins({
      topicKey: "social.published",
      title: `${post?.title ?? "Social post"} published`,
      message: `${current.platform} accepted the post successfully.`,
      targetUrl: "/dashboard/posts",
      actionLabel: "Open Social Ops",
      postId: current.post_id,
      eventId: post?.event_id ?? null,
      dedupeKey: `social.published:${input.platformId}:${input.platformPostId ?? input.postUrl ?? "published"}`,
      dedupeMinutes: 1440,
      payload: {
        platform: current.platform,
        platformPostId: input.platformPostId ?? null,
        postUrl: input.postUrl ?? null,
      },
    });
  } else {
    await notifyAdmins({
      topicKey: "social.publish_failed",
      title: `${post?.title ?? "Social post"} failed to publish`,
      message:
        input.errorMessage ??
        "The publishing provider returned an unknown error.",
      targetUrl: "/dashboard/posts",
      actionLabel: "Inspect failure",
      postId: current.post_id,
      eventId: post?.event_id ?? null,
      dedupeKey: `social.publish_failed:${input.platformId}:${Math.floor(
        Date.now() / 300000,
      )}`,
      dedupeMinutes: 5,
      payload: {
        platform: current.platform,
        makeJobId: input.makeJobId ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
