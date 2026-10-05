import type { RawEvent, RouteEvent } from "./types";

function text(raw: RawEvent, key: string) {
  const value = raw[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeEvent(raw: RawEvent): RouteEvent {
  return {
    id: String(raw.id),
    ownerUserId: text(raw, "owner_user_id"),
    title: text(raw, "title") ?? text(raw, "name") ?? "Untitled Event",
    location: text(raw, "location"),
    stateCode: text(raw, "state_code"),
    startAt:
      text(raw, "start_at") ??
      text(raw, "starts_at") ??
      text(raw, "start_date"),
    endAt:
      text(raw, "end_at") ??
      text(raw, "ends_at") ??
      text(raw, "end_date"),
    routeVisible: raw.route_visible !== false,
    routeOrder:
      typeof raw.route_order === "number" ? raw.route_order : null,
    eventTheme: text(raw, "event_theme"),
    findMeNotes: text(raw, "find_me_notes"),
    appearanceMode: text(raw, "appearance_mode"),
    raw,
  };
}
