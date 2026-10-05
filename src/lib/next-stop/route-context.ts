import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import { normalizeEvent } from "./normalize-event";
import type { RawEvent, RouteContext, RouteEvent } from "./types";

function dateValue(event: RouteEvent) {
  if (!event.startAt) return Number.MAX_SAFE_INTEGER;
  const n = new Date(event.startAt).valueOf();
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
}

function sorted(events: RouteEvent[]) {
  const useOrder =
    events.length > 0 && events.every((event) => event.routeOrder !== null);

  return [...events].sort((a, b) => {
    if (useOrder) return (a.routeOrder ?? 0) - (b.routeOrder ?? 0);
    const dates = dateValue(a) - dateValue(b);
    if (dates !== 0) return dates;
    return a.title.localeCompare(b.title);
  });
}

export async function getRouteContext(eventId: string): Promise<RouteContext> {
  const supabase = createAlpha7SupabaseAdmin();
  const { data: currentRow, error: currentError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (currentError || !currentRow) throw currentError ?? new Error("Event not found");
  const current = normalizeEvent(currentRow as RawEvent);

  let query = supabase.from("events").select("*").eq("route_visible", true);
  if (current.ownerUserId) {
    query = query.or(
      `owner_user_id.eq.${current.ownerUserId},owner_user_id.is.null`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const visible = sorted(
    (data ?? []).map((row) => normalizeEvent(row as RawEvent)),
  );
  const route = visible.some((e) => e.id === eventId)
    ? visible
    : sorted([...visible, current]);

  const index = route.findIndex((event) => event.id === eventId);
  return {
    previous: route.slice(Math.max(0, index - 2), index),
    current,
    next: route.slice(index + 1, index + 3),
  };
}
