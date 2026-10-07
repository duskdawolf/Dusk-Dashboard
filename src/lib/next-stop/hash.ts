import { createHash } from "node:crypto";
import type { RouteContext, RouteEvent } from "./types";

function fingerprint(event: RouteEvent) {
  return {
    id: event.id,
    title: event.title,
    location: event.location,
    stateCode: event.stateCode,
    startAt: event.startAt,
    endAt: event.endAt,
    routeVisible: event.routeVisible,
    routeOrder: event.routeOrder,
    eventTheme: event.eventTheme,
    findMeNotes: event.findMeNotes,
    appearanceMode: event.appearanceMode,
    suitingMode:
      typeof event.raw.suiting_mode === "string"
        ? event.raw.suiting_mode
        : null,
  };
}

export function buildSourceHash(route: RouteContext) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        previous: route.previous.map(fingerprint),
        current: fingerprint(route.current),
        next: route.next.map(fingerprint),
        generator: "alpha-v30-openai-full-poster-1",
      }),
    )
    .digest("hex");
}
