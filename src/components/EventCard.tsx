import Link from "next/link";
import type { EventItem } from "@/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function isFuture(event: EventItem) {
  return new Date(event.endAt ?? event.startAt).getTime() >= Date.now();
}

export function EventCard({ event }: { event: EventItem }) {
  const future = isFuture(event);
  const documentType = future ? "Tactical Deployment Plan" : "Incident Report";

  return (
    <Link
      href={`/chaos/${event.slug}`}
      className="card group block transition hover:-translate-y-1 hover:border-dusk-aqua/35"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="eyebrow">{formatDate(event.startAt)}</div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
            future
              ? "border-dusk-aqua/25 bg-dusk-aqua/10 text-dusk-aqua"
              : "border-dusk-pink/25 bg-dusk-pink/10 text-dusk-pink"
          }`}
        >
          {documentType}
        </span>
      </div>

      <h3 className="mt-2 text-xl font-black">{event.title}</h3>
      <p className="mt-2 text-slate-400">{event.description}</p>
      {event.location ? (
        <p className="mt-2 text-sm text-slate-500">{event.location}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="tag !mt-0">{event.tag}</span>
        <span className="text-xs font-black text-dusk-aqua">
          OPEN {documentType.toUpperCase()} →
        </span>
      </div>
    </Link>
  );
}
