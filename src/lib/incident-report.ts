import { createAdminSupabaseClient, supabaseAdminConfigured } from "@/lib/supabase/server";
import { getCaseStudies, getEvents } from "@/lib/repository";
import type { CaseStudy, EventItem } from "@/types";

export type IncidentMedia = {
  id: string;
  title: string;
  kind: "image" | "video";
  url: string;
  altText?: string;
  caption?: string;
};

export type IncidentPost = {
  id: string;
  title: string;
  caption: string;
  publishedAt?: string;
  platforms: {
    platform: string;
    url?: string;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    reach?: number;
    impressions?: number;
  }[];
};

export type IncidentReport = {
  event: EventItem;
  caseStudy?: CaseStudy;
  media: IncidentMedia[];
  posts: IncidentPost[];
};

export async function getIncidentReport(slug: string): Promise<IncidentReport | null> {
  const events = await getEvents();
  const event = events.find((item) => item.slug === slug);
  if (!event) return null;

  const studies = await getCaseStudies();
  const caseStudy = studies.find((item) => item.slug === slug);

  if (!supabaseAdminConfigured()) {
    return { event, caseStudy, media: [], posts: [] };
  }

  const supabase = createAdminSupabaseClient();

  const [{ data: media }, { data: posts }] = await Promise.all([
    supabase
      .from("media")
      .select("*")
      .eq("event_id", event.id)
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("posts")
      .select("*, post_platforms(*, post_metrics(*))")
      .eq("event_id", event.id)
      .eq("status", "published")
      .order("created_at", { ascending: false }),
  ]);

  return {
    event,
    caseStudy,
    media: (media ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      url: row.url,
      altText: row.alt_text ?? undefined,
      caption: row.caption ?? undefined,
    })),
    posts: (posts ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      caption: row.master_caption,
      publishedAt: row.scheduled_at ?? row.approved_at ?? row.created_at ?? undefined,
      platforms: (row.post_platforms ?? []).map((platform: any) => {
        const latestMetric = [...(platform.post_metrics ?? [])].sort(
          (a: any, b: any) =>
            new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime(),
        )[0];

        return {
          platform: platform.platform,
          url: platform.post_url ?? undefined,
          likes: latestMetric?.likes ?? undefined,
          comments: latestMetric?.comments ?? undefined,
          shares: latestMetric?.shares ?? undefined,
          saves: latestMetric?.saves ?? undefined,
          reach: latestMetric?.reach ?? undefined,
          impressions: latestMetric?.impressions ?? undefined,
        };
      }),
    })),
  };
}
