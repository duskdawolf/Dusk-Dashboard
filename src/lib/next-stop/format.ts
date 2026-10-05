import type { RouteEvent } from './types';

export function formatLocation(event: RouteEvent) {
  const parts = [event.city, event.region].filter(Boolean);
  return parts.length ? parts.join(', ') : event.venueName ?? 'Location TBA';
}

function safeDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function formatDateLine(event: RouteEvent) {
  const start = safeDate(event.startAt);
  const end = safeDate(event.endAt);
  if (!start) return 'Date TBA';

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
  });
  const startText = formatter.format(start);
  if (!end) return startText;
  const endText = formatter.format(end);
  return startText === endText ? startText : `${startText} – ${endText}`;
}
