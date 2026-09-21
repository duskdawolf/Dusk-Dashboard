import { caseStudies as seedCaseStudies, events as seedEvents, products as seedProducts, socialLinks as seedSocialLinks } from "@/data/seed";
import { createServerSupabaseClient, supabaseConfigured } from "@/lib/supabase/server";
import type { CaseStudy, EventItem, Product, SocialLink } from "@/types";

export async function getEvents(): Promise<EventItem[]> {
  if (!supabaseConfigured()) return seedEvents;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("published", true)
    .order("start_at", { ascending: true });

  if (error || !data) return seedEvents;

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at ?? undefined,
    location: row.location ?? undefined,
    description: row.description ?? "",
    tag: row.tag ?? "Event",
    quarter: row.quarter,
    mapX: row.map_x ?? undefined,
    mapY: row.map_y ?? undefined,
  }));
}

export async function getSocialLinks(): Promise<SocialLink[]> {
  if (!supabaseConfigured()) return seedSocialLinks;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("social_links").select("*").eq("active", true).order("sort_order");
  if (error || !data) return seedSocialLinks;
  return data.map((row) => ({ id: row.id, name: row.name, handle: row.handle, url: row.url }));
}

export async function getProducts(): Promise<Product[]> {
  if (!supabaseConfigured()) return seedProducts;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("products").select("*").eq("active", true).order("sort_order");
  if (error || !data) return seedProducts;
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
  if (!supabaseConfigured()) return seedCaseStudies;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("case_studies").select("*").eq("published", true).order("published_at", { ascending: false });
  if (error || !data) return seedCaseStudies;
  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    image: row.image_url,
    status: row.status,
    challenge: row.challenge,
    solution: row.solution,
    outcome: row.outcome,
  }));
}
