import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/notifications";
import { loadSocialPublishJob } from "@/lib/social/jobs";
import { publishSocialJob } from "@/lib/social/providers";
import { reconcileSocialPost } from "@/lib/social/reconcile";

function authorized(request: Request) {
  const expected = process.env.MAKE_WEBHOOK_SECRET;

  return Boolean(
    expected &&
      request.headers.get("authorization") === `Bearer ${expected}`,
  );
}

function retryDelaySeconds(
  attemptCount: number,
  providerSuggested?: number | null,
) {
  if (providerSuggested && providerSuggested > 0) {
    return Math.min(providerSuggested, 60 * 60);
  }

  const schedule = [5 * 60, 15 * 60, 30 * 60];
  return schedule[Math.min(attemptCount, schedule.length - 1)];
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data: due, error } = await supabase
    .from("post_platforms")
    .select("id,post_id,platform,attempt_count,scheduled_at")
    .in("platform", ["telegram", "twitter"])
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json(
      { error: "Could not load due Social Ops jobs.", detail: error.message },
      { status: 500 },
    );
  }

  const results: Record<string, unknown>[] = [];

  for (const row of due ?? []) {
    // Claim the job. This conditional update keeps overlapping Make runs from
    // publishing the same scheduled row twice.
    const { data: claimed, error: claimError } = await supabase
      .from("post_platforms")
      .update({
        status: "publishing",
        last_error: null,
        last_provider_check: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      results.push({
        platformId: row.id,
        skipped: true,
        reason: claimError?.message ?? "Already claimed by another dispatcher.",
      });
      continue;
    }

    await reconcileSocialPost(row.post_id);

    const job = await loadSocialPublishJob(row.id);

    if (job) {
      await notifyAdmins({
        topicKey: "social.publishing",
        title: `${job.title} is publishing to ${job.platform === "twitter" ? "X" : "Telegram"}`,
        message: `The live ${job.platform === "twitter" ? "X" : "Telegram"} provider claimed this scheduled job.`,
        targetUrl: "/dashboard/posts",
        actionLabel: "Open Social Ops",
        postId: row.post_id,
        eventId: job.event?.id ?? null,
        dedupeKey: `social.publishing:${row.id}:${(row.attempt_count ?? 0) + 1}`,
        dedupeMinutes: 10,
        payload: { platform: job.platform },
      }).catch(() => undefined);
    }

    if (!job) {
      await supabase
        .from("post_platforms")
        .update({
          status: "failed",
          last_error: "Could not reload the Social Ops publishing job.",
          attempt_count: (row.attempt_count ?? 0) + 1,
          last_provider_check: new Date().toISOString(),
        })
        .eq("id", row.id);

      await reconcileSocialPost(row.post_id);

      results.push({
        platformId: row.id,
        ok: false,
        error: "Could not reload job.",
      });
      continue;
    }

    const result = await publishSocialJob(job);
    const nextAttemptCount = (row.attempt_count ?? 0) + 1;

    if (result.ok) {
      await supabase
        .from("post_platforms")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          platform_post_id: result.providerPostId ?? null,
          post_url: result.postUrl ?? null,
          provider_account: result.providerAccount ?? null,
          published_caption: result.publishedCaption ?? job.caption,
          published_media: result.publishedMedia ?? job.media,
          provider_response: result.providerResponse ?? {},
          last_error: null,
          attempt_count: nextAttemptCount,
          last_provider_check: new Date().toISOString(),
        })
        .eq("id", row.id);

      await reconcileSocialPost(row.post_id);

      await notifyAdmins({
        topicKey: "social.published",
        title: `${job.title} published to ${job.platform === "twitter" ? "X" : "Telegram"}`,
        message: result.postUrl
          ? `${job.platform === "twitter" ? "X" : "Telegram"} accepted the post successfully. Tap to inspect Social Ops or open the live post.`
          : `${job.platform === "twitter" ? "X" : "Telegram"} accepted the post successfully.`,
        targetUrl: "/dashboard/posts",
        actionLabel: "Open Social Ops",
        postId: row.post_id,
        eventId: job.event?.id ?? null,
        dedupeKey: `social.published:${row.id}:${result.providerPostId ?? job.platform}`,
        dedupeMinutes: 1440,
        payload: {
          platform: job.platform,
          platformPostId: result.providerPostId ?? null,
          postUrl: result.postUrl ?? null,
        },
      });

      results.push({
        platformId: row.id,
        ok: true,
        platform: job.platform,
        postUrl: result.postUrl ?? null,
        providerPostId: result.providerPostId ?? null,
      });
      continue;
    }

    const shouldRetry =
      result.retryable && nextAttemptCount < 3;

    if (shouldRetry) {
      const delaySeconds = retryDelaySeconds(
        row.attempt_count ?? 0,
        result.retryAfterSeconds,
      );
      const nextAttemptAt = new Date(
        Date.now() + delaySeconds * 1000,
      ).toISOString();

      await supabase
        .from("post_platforms")
        .update({
          status: "scheduled",
          scheduled_at: nextAttemptAt,
          last_error: result.error ?? `${job.platform === "twitter" ? "X" : "Telegram"} publishing failed.`,
          attempt_count: nextAttemptCount,
          provider_response: result.providerResponse ?? {},
          last_provider_check: new Date().toISOString(),
        })
        .eq("id", row.id);

      await reconcileSocialPost(row.post_id);

      results.push({
        platformId: row.id,
        ok: false,
        retryScheduled: true,
        nextAttemptAt,
        error: result.error ?? null,
      });
      continue;
    }

    await supabase
      .from("post_platforms")
      .update({
        status: "failed",
        last_error: result.error ?? `${job.platform === "twitter" ? "X" : "Telegram"} publishing failed.`,
        attempt_count: nextAttemptCount,
        provider_response: result.providerResponse ?? {},
        last_provider_check: new Date().toISOString(),
      })
      .eq("id", row.id);

    await reconcileSocialPost(row.post_id);

    await notifyAdmins({
      topicKey: "social.publish_failed",
      title: `${job.title} failed to publish to ${job.platform === "twitter" ? "X" : "Telegram"}`,
      message:
        result.error ??
        `${job.platform === "twitter" ? "X" : "Telegram"} returned an unknown publishing failure.`,
      targetUrl: "/dashboard/posts",
      actionLabel: "Inspect failure",
      postId: row.post_id,
      eventId: job.event?.id ?? null,
      dedupeKey: `social.publish_failed:${row.id}:${nextAttemptCount}`,
      dedupeMinutes: 5,
      payload: {
        platform: job.platform,
        attempts: nextAttemptCount,
      },
    });

    results.push({
      platformId: row.id,
      ok: false,
      retryScheduled: false,
      error: result.error ?? null,
    });
  }

  return NextResponse.json({
    ok: true,
    evaluatedAt: new Date().toISOString(),
    dispatched: results.length,
    results,
  });
}
