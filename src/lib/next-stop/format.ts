import type { RouteEvent } from "./types";

export function formatLocation(event: RouteEvent) {
  if (event.location) return event.location;
  if (event.stateCode) return event.stateCode;
  return "Location TBA";
}

function parse(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function formatDateLine(event: RouteEvent) {
  const start = parse(event.startAt);
  const end = parse(event.endAt);
  if (!start) return "Date TBA";

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });

  const a = formatter.format(start);
  if (!end) return a;
  const b = formatter.format(end);
  return a === b ? a : `${a} – ${b}`;
}
