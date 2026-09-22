import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/notifications";

function authorized(request: Request) {
  const expected = process.env.MAKE_WEBHOOK_SECRET;
  return Boolean(
    expected &&
      request.headers.get("authorization") === `Bearer ${expected}`
  );
}

const ReceiptSchema = z.object({
  platformId: z.string().uuid(),
  status: z.enum(["published", "failed"]),
  platformPostId: z.string().max(1000).nullable().optional(),
  postUrl: z.string().max(3000).nullable().optional(),
  makeJobId: z.string().max(1000).nullable().optional(),
  errorMessage: z.string().max(4000).nullable().optional(),
  publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
});

async function reconcilePost(postId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: platforms } = await supabase
    .from("post_platforms")
    .select("status")
    .eq("post_id", postId);

  const statuses = (platforms ?? []).map((row) => row.status);
  if (!statuses.length) return;

  const allPublished = statuses.every((status) => status === "published");
  const anyFailed = statuses.some((status) => status === "failed");
  const anyPending = statuses.some((status) =>
    ["draft", "approved", "scheduled", "publishing"].includes(status)
  );

  if (allPublished) {
    await supabase
      .from("posts")
      .update({ status: "published", automation_status: "published" })
      .eq("id", postId);
  } else if (anyFailed && !anyPending) {
    await supabase
      .from("posts")
      .update({ status: "failed", automation_status: "needs_attention" })
      .eq("id", postId);
  } else if (anyFailed) {
    await supabase
      .from("posts")
      .update({ automation_status: "partial_failure" })
      .eq("id", postId);
  } else {
    await supabase
      .from("posts")
      .update({ automation_status: "publishing" })
      .eq("id", postId);
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
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
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const jobs = (data ?? []).map((row: any) => {
    const post = row.posts;
    const media = [...(post?.post_media ?? [])]
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((join: any) => join.media)
      .filter(Boolean);

    return {
      platformId: row.id,
      postId: row.post_id,
      platform: row.platform,
      caption: row.platform_caption_override || post?.master_caption || "",
      scheduledAt: row.scheduled_at,
      attemptCount: row.attempt_count ?? 0,
      title: post?.title,
      event: post?.events ?? null,
      media,
    };
  });

  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = ReceiptSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid publishing receipt.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  const { data: current, error: currentError } = await supabase
    .from("post_platforms")
    .select("id,post_id,attempt_count")
    .eq("id", input.platformId)
    .single();

  if (currentError || !current) {
    return NextResponse.json(
      { error: currentError?.message ?? "Platform job not found." },
      { status: 404 }
    );
  }

  const { error } = await supabase
    .from("post_platforms")
    .update({
      status: input.status,
      platform_post_id: input.platformPostId ?? null,
      post_url: input.postUrl ?? null,
      make_job_id: input.makeJobId ?? null,
      last_error:
        input.status === "failed"
          ? input.errorMessage ?? "Unknown publishing error."
          : null,
      attempt_count: (current.attempt_count ?? 0) + 1,
      published_at:
        input.status === "published"
          ? input.publishedAt ?? new Date().toISOString()
          : null,
    })
    .eq("id", input.platformId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await reconcilePost(current.post_id);

  const { data: post } = await supabase
    .from("posts")
    .select("id,title,event_id,events(id,slug,title)")
    .eq("id", current.post_id)
    .maybeSingle();

  const platformName = input.platformPostId ? "Social platform" : "Provider";

  if (input.status === "published") {
    await notifyAdmins({
      topicKey: "social.published",
      title: `${post?.title ?? "Social post"} published`,
      message: `${platformName} accepted the post successfully.`,
      targetUrl: "/dashboard/posts",
      actionLabel: "Open Social Ops",
      postId: current.post_id,
      eventId: post?.event_id ?? null,
      dedupeKey: `social.published:${input.platformId}:${input.platformPostId ?? input.postUrl ?? "published"}`,
      dedupeMinutes: 1440,
      payload: {
        platformPostId: input.platformPostId ?? null,
        postUrl: input.postUrl ?? null,
      },
    });
  } else {
    await notifyAdmins({
      topicKey: "social.publish_failed",
      title: `${post?.title ?? "Social post"} failed to publish`,
      message: input.errorMessage ?? "The publishing provider returned an unknown error.",
      targetUrl: "/dashboard/posts",
      actionLabel: "Inspect failure",
      postId: current.post_id,
      eventId: post?.event_id ?? null,
      dedupeKey: `social.publish_failed:${input.platformId}:${Math.floor(Date.now() / 300000)}`,
      dedupeMinutes: 5,
      payload: {
        makeJobId: input.makeJobId ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
