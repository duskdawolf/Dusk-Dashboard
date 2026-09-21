import type { EventItem } from "@/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function EventCard({ event }: { event: EventItem }) {
  return (
    <article className="card">
      <div className="eyebrow">{formatDate(event.startAt)}</div>
      <h3 className="text-xl font-black">{event.title}</h3>
      <p className="mt-2 text-slate-400">{event.description}</p>
      {event.location ? <p className="mt-2 text-sm text-slate-500">{event.location}</p> : null}
      <span className="tag">{event.tag}</span>
    </article>
  );
}
