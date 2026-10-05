import { randomUUID } from "node:crypto";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

export function eventIsPast(event: {
  start_at: string;
  end_at?: string | null;
}) {
  const boundary = new Date(event.end_at || event.start_at).valueOf();
  return Number.isFinite(boundary) && boundary < Date.now();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export function quarterFor(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error("Invalid event date.");
  }
  return `q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export function uniqueSlug(title: string, date: string) {
  const year = new Date(date).getUTCFullYear();
  return `${slugify(title) || "event"}-${year}-${randomUUID().slice(0, 6)}`;
}

export async function requireOwnedEvent(eventId: string, userId: string) {
  const supabase = createAlpha7SupabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error) throw error;
  if (data.owner_user_id && data.owner_user_id !== userId) {
    throw new Error("FORBIDDEN");
  }
  return data;
}

export async function ensureCaseStudy(args: {
  event: any;
  userId: string;
}) {
  const supabase = createAlpha7SupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("case_studies")
    .select("*")
    .eq("event_id", args.event.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const slug = `${slugify(args.event.title) || "case-study"}-${new Date(
    args.event.start_at,
  ).getUTCFullYear()}-${randomUUID().slice(0, 6)}`;

  const { data, error } = await supabase
    .from("case_studies")
    .insert({
      event_id: args.event.id,
      slug,
      title: args.event.title,
      image_url: "",
      status: "Draft",
      challenge: "",
      solution: "",
      outcome: "",
      published: false,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function ensureConPrep(args: {
  event: any;
  userId: string;
}) {
  const supabase = createAlpha7SupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("con_preps")
    .select("*")
    .eq("event_id", args.event.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("con_preps")
    .insert({
      event_id: args.event.id,
      status: "planning",
      owner_user_id: args.userId,
      readiness_score: 0,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
