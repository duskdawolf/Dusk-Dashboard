import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { SocialReviewSubmission } from "@/lib/social/review-types";

const MIN_PLATFORM_SAMPLES = 8;

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function localHour(iso: string, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date(iso));
    const raw = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    return raw === 24 ? 0 : raw;
  } catch {
    return new Date(iso).getUTCHours();
  }
}

function latestMetric(metrics: any[] | null | undefined) {
  return [...(metrics ?? [])].sort(
    (a, b) =>
      new Date(b.captured_at ?? 0).getTime() -
      new Date(a.captured_at ?? 0).getTime(),
  )[0];
}

function engagement(metric: any) {
  return (
    num(metric?.likes) +
    num(metric?.comments) +
    num(metric?.shares) +
    num(metric?.saves) +
    num(metric?.clicks)
  );
}

export async function buildSocialReviewContext(args: {
  userId: string;
  submission: SocialReviewSubmission;
}) {
  const supabase = createAdminSupabaseClient();
  const platformNames = args.submission.platforms.map((item) => item.platform);

  const [
    { data: preferences },
    eventResult,
    mediaResult,
    historyResult,
  ] = await Promise.all([
    supabase
      .from("operator_preferences")
      .select("timezone")
      .eq("user_id", args.userId)
      .maybeSingle(),
    args.submission.eventId
      ? supabase
          .from("events")
          .select("id,title,slug,start_at,end_at,location,event_type")
          .eq("id", args.submission.eventId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    args.submission.mediaIds.length
      ? supabase
          .from("media")
          .select("id,title,kind,mime_type,alt_text,event_id,sort_order")
          .in("id", args.submission.mediaIds)
      : Promise.resolve({ data: [], error: null } as any),
    platformNames.length
      ? supabase
          .from("post_platforms")
          .select(`
            id,platform,published_at,scheduled_at,published_caption,
            posts!inner(id,owner_user_id,title,event_id,master_caption,status,created_at),
            post_metrics(captured_at,impressions,reach,likes,comments,shares,saves,clicks,video_views)
          `)
          .eq("status", "published")
          .in("platform", platformNames)
          .order("published_at", { ascending: false })
          .limit(120)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (eventResult.error) throw new Error(eventResult.error.message);
  if (mediaResult.error) throw new Error(mediaResult.error.message);
  if (historyResult.error) throw new Error(historyResult.error.message);

  const timeZone = preferences?.timezone || "America/New_York";
  const orderedMedia = args.submission.mediaIds
    .map((id) => (mediaResult.data ?? []).find((item: any) => item.id === id))
    .filter(Boolean)
    .map((item: any) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      mimeType: item.mime_type,
      altText: item.alt_text,
    }));

  const performanceByPlatform: Record<string, any> = {};

  for (const platform of platformNames) {
    const rows = (historyResult.data ?? []).filter(
      (row: any) =>
        row.platform === platform &&
        (!row.posts?.owner_user_id || row.posts.owner_user_id === args.userId),
    );

    const samples = rows
      .map((row: any) => {
        const metric = latestMetric(row.post_metrics);
        const reach = num(metric?.reach || metric?.impressions);
        if (!metric || !reach) return null;

        const publishedAt =
          row.published_at || row.scheduled_at || row.posts?.created_at;

        return {
          reach,
          engagements: engagement(metric),
          hour: publishedAt ? localHour(publishedAt, timeZone) : null,
          caption: String(
            row.published_caption || row.posts?.master_caption || "",
          ).slice(0, 320),
          publishedAt,
        };
      })
      .filter(Boolean) as Array<{
      reach: number;
      engagements: number;
      hour: number | null;
      caption: string;
      publishedAt: string | null;
    }>;

    const hourBuckets = new Map<number, { reaches: number[]; engagements: number[] }>();

    for (const sample of samples) {
      if (sample.hour == null) continue;
      const bucket = hourBuckets.get(sample.hour) ?? {
        reaches: [],
        engagements: [],
      };
      bucket.reaches.push(sample.reach);
      bucket.engagements.push(sample.engagements);
      hourBuckets.set(sample.hour, bucket);
    }

    const bestHours = [...hourBuckets.entries()]
      .map(([hour, values]) => ({
        hour,
        samples: values.reaches.length,
        medianReach: Math.round(median(values.reaches)),
        medianEngagements: Math.round(median(values.engagements)),
      }))
      .filter((item) => item.samples >= 2)
      .sort((a, b) => b.medianReach - a.medianReach)
      .slice(0, 4);

    const topExamples = [...samples]
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 3)
      .map((sample) => ({
        reach: sample.reach,
        engagements: sample.engagements,
        publishedAt: sample.publishedAt,
        caption: sample.caption,
      }));

    performanceByPlatform[platform] = {
      samples: samples.length,
      medianReach: Math.round(median(samples.map((sample) => sample.reach))),
      medianEngagements: Math.round(
        median(samples.map((sample) => sample.engagements)),
      ),
      bestObservedHours: bestHours,
      topExamples,
    };
  }

  const internalSamples = Object.values(performanceByPlatform).reduce(
    (sum: number, value: any) => sum + num(value.samples),
    0,
  );

  const sparsePlatforms = platformNames.filter(
    (platform) =>
      num(performanceByPlatform[platform]?.samples) < MIN_PLATFORM_SAMPLES,
  );

  return {
    currentTime: new Date().toISOString(),
    submission: {
      ...args.submission,
      media: orderedMedia,
    },
    event: eventResult.data
      ? {
          id: eventResult.data.id,
          title: eventResult.data.title,
          slug: eventResult.data.slug,
          startAt: eventResult.data.start_at,
          endAt: eventResult.data.end_at,
          location: eventResult.data.location,
          eventType: eventResult.data.event_type,
        }
      : null,
    timeZone,
    performance: {
      internalSamples,
      sparsePlatforms,
      needsExternalFallback:
        sparsePlatforms.length > 0 || internalSamples < 12,
      byPlatform: performanceByPlatform,
      note:
        "Historical metrics are Dusk-specific. Best observed hours require at least two measured posts in that hour bucket.",
    },
    platformConstraints: {
      telegram: { maxText: 4096, mediaCaptionMax: 1024, maxMedia: 10 },
      twitter: {
        maxText: Number(process.env.X_MAX_POST_CHARS || 280),
        maxImages: 4,
      },
      instagram: { maxCaption: 2200, mediaRequired: true, maxMedia: 10 },
      bluesky: { maxTextGraphemes: 300, maxImages: 4, videoEnabledInDusk: false },
    },
  };
}
