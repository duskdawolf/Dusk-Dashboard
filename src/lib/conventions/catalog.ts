import { WIKIFUR_CONVENTIONS } from "@/data/wikifur-conventions";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const WIKIFUR_ATTENDANCE_URL =
  "https://en.wikifur.com/wiki/List_of_in-person_furry_conventions_by_attendance";
export const WIKIFUR_UPCOMING_URL =
  "https://en.wikifur.com/wiki/Template:Upcoming_events";

function splitLocation(location: string) {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    city: parts[0] ?? location,
    region: parts.length > 1 ? parts.slice(1).join(", ") : null,
  };
}

export async function syncWikiFurConventionCatalog() {
  const supabase = createAdminSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("convention_catalog")
    .select("slug,verification_status,source_priority,metadata");

  if (existingError) throw new Error(existingError.message);

  const bySlug = new Map(
    (existing ?? []).map((row) => [row.slug, row]),
  );

  let preservedOfficial = 0;
  const payloads = [];

  for (const item of WIKIFUR_CONVENTIONS) {
    const current = bySlug.get(item.slug);

    // Official convention website/social data always wins over WikiFur.
    if (
      current?.verification_status === "official" ||
      (current?.source_priority ?? 99) < 20
    ) {
      preservedOfficial += 1;
      continue;
    }

    const { city, region } = splitLocation(item.location);

    payloads.push({
      slug: item.slug,
      series_slug: item.slug,
      name: item.name,
      abbreviation: null,
      edition_year: item.startDate
        ? Number(item.startDate.slice(0, 4))
        : item.latestYear,
      start_date: item.startDate,
      end_date: item.endDate,
      starts_at: null,
      ends_at: null,
      timezone: "UTC",
      date_precision: "date_only",
      city,
      region,
      country: item.country,
      venue_name: null,
      venue_address: null,
      website_url: null,
      registration_url: null,
      hotel_url: null,
      main_hotel_name: null,
      main_hotel_address: null,
      age_policy: null,
      attendance_rank: item.rank,
      wikifur_rank: item.rank,
      wikifur_url: WIKIFUR_ATTENDANCE_URL,
      wikifur_location_text: item.location,
      latest_attendance: item.attendance,
      latest_attendance_year: item.latestYear,
      verification_status: "wikifur",
      data_authority: "wikifur",
      source_priority: 20,
      source_url: WIKIFUR_ATTENDANCE_URL,
      verified_at: new Date().toISOString(),
      active: true,
      metadata: {
        source: "wikifur",
        wikifur_rank: item.rank,
        wikifur_latest_attendance: item.attendance,
        wikifur_latest_attendance_year: item.latestYear,
        upcoming_date_source: item.startDate
          ? WIKIFUR_UPCOMING_URL
          : null,
      },
    });
  }

  if (payloads.length) {
    const { error } = await supabase
      .from("convention_catalog")
      .upsert(payloads, { onConflict: "slug" });

    if (error) throw new Error(error.message);
  }

  return {
    upserted: payloads.length,
    preservedOfficial,
    source: WIKIFUR_ATTENDANCE_URL,
    sourcePriority: [
      "official convention website/social",
      "WikiFur",
      "other/manual sources",
    ],
  };
}

export async function ensureConventionCatalog() {
  const supabase = createAdminSupabaseClient();

  const { count, error } = await supabase
    .from("convention_catalog")
    .select("*", { count: "exact", head: true });

  if (error) throw new Error(error.message);

  if ((count ?? 0) < WIKIFUR_CONVENTIONS.length) {
    return syncWikiFurConventionCatalog();
  }

  return null;
}

export function eventQuarter(dateIso: string) {
  const month = new Date(`${dateIso}T12:00:00Z`).getUTCMonth() + 1;
  if (month <= 3) return "q1";
  if (month <= 6) return "q2";
  if (month <= 9) return "q3";
  return "q4";
}

export function catalogLocation(entry: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}) {
  return [entry.city, entry.region, entry.country]
    .filter(Boolean)
    .join(", ");
}
