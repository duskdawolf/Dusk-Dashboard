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
  };
}

export function buildSourceHash(route: RouteContext) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        previous: route.previous.map(fingerprint),
        current: fingerprint(route.current),
        next: route.next.map(fingerprint),
        generator: "v26-alpha7-complete-1",
      }),
    )
    .digest("hex");
}
