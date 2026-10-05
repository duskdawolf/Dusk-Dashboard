import { createHash } from 'node:crypto';
import type { RouteContext, RouteEvent } from './types';

function eventFingerprint(event: RouteEvent) {
  return {
    id: event.id,
    title: event.title,
    city: event.city,
    region: event.region,
    venueName: event.venueName,
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
  const value = JSON.stringify({
    previous: route.previous.map(eventFingerprint),
    current: eventFingerprint(route.current),
    next: route.next.map(eventFingerprint),
    generatorVersion: 'v26-alpha7-next-stop-1',
  });
  return createHash('sha256').update(value).digest('hex');
}
