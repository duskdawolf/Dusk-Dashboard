import { createClient } from "@supabase/supabase-js";
import {
  caseStudies as seedCaseStudies,
  events as seedEvents,
  products as seedProducts,
  socialLinks as seedSocialLinks,
} from "@/data/seed";
import { eventRowToItem, type EventRow } from "@/lib/event-records";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  supabasePublicConfigured,
} from "@/lib/supabase/config";
import type { CaseStudy, ChaosArchiveItem, EventItem, Product, SocialLink } from "@/types";

function publicClient() {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getEvents(): Promise<EventItem[]> {
  if (!supabasePublicConfigured()) return seedEvents;

  const supabase = publicClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("published", true)
    .order("start_at", { ascending: true });

  if (error || !data || data.length === 0) return seedEvents;

  return (data as EventRow[]).map(eventRowToItem);
}

export async function getSocialLinks(): Promise<SocialLink[]> {
  if (!supabasePublicConfigured()) return seedSocialLinks;

  const supabase = publicClient();
  const { data, error } = await supabase
    .from("social_links")
    .select("*")
    .eq("active", true)
    .order("sort_order");

  if (error || !data || data.length === 0) return seedSocialLinks;

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    handle: row.handle,
    url: row.url,
  }));
}

export async function getProducts(): Promise<Product[]> {
  if (!supabasePublicConfigured()) return seedProducts;

  const supabase = publicClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order");

  if (error || !data || data.length === 0) return seedProducts;

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    image: row.image_url,
    description: row.description ?? "",
    priceLabel: row.price_label ?? "Coming soon",
    active: row.active,
  }));
}

export async function getCaseStudies(): Promise<CaseStudy[]> {
  if (!supabasePublicConfigured()) return seedCaseStudies;

  const supabase = publicClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (error || !data || data.length === 0) return seedCaseStudies;

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    image: row.image_url,
    status: row.status,
    challenge: row.challenge,
    solution: row.solution,
    outcome: row.outcome,
    eventId: row.event_id ?? undefined,
  }));
}


export async function getChaosArchive(): Promise<ChaosArchiveItem[]> {
  const [events, studies] = await Promise.all([getEvents(), getCaseStudies()]);
  const studyByEventId = new Map(
    studies
      .filter((study) => study.eventId)
      .map((study) => [study.eventId!, study] as const)
  );
  const studyBySlug = new Map(studies.map((study) => [study.slug, study] as const));

  if (!supabasePublicConfigured()) {
    return events
      .map((event) => {
        const caseStudy = studyByEventId.get(event.id) ?? studyBySlug.get(event.slug);
        return {
          event,
          caseStudy,
          coverImage: caseStudy?.image,
          mediaCount: 0,
          incidentFiled: Boolean(caseStudy),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.event.startAt).getTime() - new Date(a.event.startAt).getTime()
      );
  }

  const supabase = publicClient();
  const { data: media } = await supabase
    .from("media")
    .select("event_id,url,kind,sort_order,created_at")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const mediaByEvent = new Map<
    string,
    { url: string; kind: string; sort_order: number; created_at: string }[]
  >();

  for (const row of media ?? []) {
    if (!row.event_id) continue;
    const rows = mediaByEvent.get(row.event_id) ?? [];
    rows.push(row);
    mediaByEvent.set(row.event_id, rows);
  }

  return events
    .map((event) => {
      const caseStudy = studyByEventId.get(event.id) ?? studyBySlug.get(event.slug);
      const eventMedia = mediaByEvent.get(event.id) ?? [];
      const firstImage = eventMedia.find((item) => item.kind === "image");

      return {
        event,
        caseStudy,
        coverImage: caseStudy?.image || firstImage?.url,
        mediaCount: eventMedia.length,
        incidentFiled: Boolean(caseStudy),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.event.startAt).getTime() - new Date(a.event.startAt).getTime()
    );
}
