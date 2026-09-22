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
import type { CaseStudy, EventItem, Product, SocialLink } from "@/types";

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
  }));
}
