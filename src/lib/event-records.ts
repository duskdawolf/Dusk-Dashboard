import type { EventItem, EventQuarter, EventType } from "@/types";

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  state_code: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  tag: string | null;
  event_type: EventType;
  quarter: EventQuarter;
  published: boolean;
  created_at?: string;
  updated_at?: string;
};

export function eventRowToItem(row: EventRow): EventItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at ?? undefined,
    location: row.location ?? undefined,
    stateCode: row.state_code ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    description: row.description ?? "",
    tag: row.tag ?? "Event",
    eventType: row.event_type,
    quarter: row.quarter,
  };
}

export function quarterFromIso(iso: string): EventQuarter {
  const month = new Date(iso).getUTCMonth() + 1;

  if (month <= 3) return "q1";
  if (month <= 6) return "q2";
  if (month <= 9) return "q3";
  return "q4";
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
