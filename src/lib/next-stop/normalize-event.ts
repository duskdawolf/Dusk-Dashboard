import type { RawEvent, RouteEvent } from './types';

function firstString(raw: RawEvent, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(raw: RawEvent, keys: string[]): number | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

export function normalizeEvent(raw: RawEvent): RouteEvent {
  return {
    id: String(raw.id),
    ownerUserId: typeof raw.owner_user_id === 'string' ? raw.owner_user_id : null,
    title: firstString(raw, ['title', 'name', 'event_name']) ?? 'Untitled Event',
    city: firstString(raw, ['city']),
    region: firstString(raw, ['region', 'state']),
    venueName: firstString(raw, ['venue_name', 'venue']),
    startAt: firstString(raw, ['starts_at', 'start_at', 'start_date', 'date']),
    endAt: firstString(raw, ['ends_at', 'end_at', 'end_date']),
    routeVisible: raw.route_visible !== false,
    routeOrder: firstNumber(raw, ['route_order']),
    eventTheme: typeof raw.event_theme === 'string' ? raw.event_theme : null,
    findMeNotes: typeof raw.find_me_notes === 'string' ? raw.find_me_notes : null,
    appearanceMode: typeof raw.appearance_mode === 'string' ? raw.appearance_mode : null,
    raw,
  };
}
