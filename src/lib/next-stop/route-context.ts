import { createSupabaseAdmin } from './supabase-admin';
import { normalizeEvent } from './normalize-event';
import type { RawEvent, RouteContext, RouteEvent } from './types';

function dateValue(event: RouteEvent) {
  if (!event.startAt) return Number.MAX_SAFE_INTEGER;
  const value = new Date(event.startAt).valueOf();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function sortRoute(events: RouteEvent[]) {
  const allHaveRouteOrder = events.length > 0 && events.every((event) => event.routeOrder !== null);
  return [...events].sort((a, b) => {
    if (allHaveRouteOrder) return (a.routeOrder ?? 0) - (b.routeOrder ?? 0);
    const dateDiff = dateValue(a) - dateValue(b);
    if (dateDiff !== 0) return dateDiff;
    if (a.routeOrder !== null && b.routeOrder !== null) return a.routeOrder - b.routeOrder;
    return a.title.localeCompare(b.title);
  });
}

export async function getRouteContext(eventId: string): Promise<RouteContext> {
  const supabase = createSupabaseAdmin();
  const { data: currentRaw, error: currentError } = await supabase
    .from('events').select('*').eq('id', eventId).single();

  if (currentError || !currentRaw) throw new Error(`Event not found: ${eventId}`);

  let query = supabase.from('events').select('*').eq('route_visible', true);
  const currentOwner = typeof currentRaw.owner_user_id === 'string' ? currentRaw.owner_user_id : null;
  if (currentOwner) query = query.eq('owner_user_id', currentOwner);

  const { data: routeRows, error: routeError } = await query;
  if (routeError) throw routeError;

  const current = normalizeEvent(currentRaw as RawEvent);
  const normalized = sortRoute((routeRows ?? []).map((row) => normalizeEvent(row as RawEvent)));
  const currentIndex = normalized.findIndex((event) => event.id === eventId);
  const route = currentIndex >= 0 ? normalized : sortRoute([...normalized, current]);
  const index = route.findIndex((event) => event.id === eventId);

  return {
    previous: route.slice(Math.max(0, index - 2), index),
    current,
    next: route.slice(index + 1, index + 3),
  };
}
