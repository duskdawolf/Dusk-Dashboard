import Link from "next/link";
import { DeploymentImage } from "@/components/convention-directory/DeploymentImage";
import type { ChaosArchiveItem } from "@/types";

function dateLabel(startAt: string, endAt?: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const start = new Date(startAt);
  if (!endAt) return formatter.format(start);
  const end = new Date(endAt);
  return formatter.format(start) === formatter.format(end)
    ? formatter.format(start)
    : `${formatter.format(start)} – ${formatter.format(end)}`;
}

function eventStatus(item: ChaosArchiveItem) {
  const end = new Date(item.event.endAt ?? item.event.startAt).getTime();
  if (end < Date.now()) {
    return item.incidentFiled
      ? "INCIDENT REPORT FILED"
      : "INCIDENT REPORT OPEN";
  }
  return "TACTICAL DEPLOYMENT PLAN";
}

function documentType(item: ChaosArchiveItem) {
  const end = new Date(item.event.endAt ?? item.event.startAt).getTime();
  return end < Date.now() ? "Incident Report" : "Tactical Deployment Plan";
}

export function ChaosArchiveCard({ item }: { item: ChaosArchiveItem }) {
  const { event, caseStudy } = item;

  return (
    <Link
      href={`/chaos/${event.slug}`}
      className="group overflow-hidden rounded-3xl border border-dusk-line bg-dusk-panel shadow-dusk transition hover:-translate-y-1 hover:border-dusk-aqua/35"
    >
      <div className="relative aspect-video overflow-hidden bg-[#091321]">
        <DeploymentImage
          images={
            event.eventType === "convention"
              ? event.imageCandidates
              : [item.coverImage, ...(event.imageCandidates ?? [])].filter(
                  (s): s is string => Boolean(s),
                )
          }
          alt={event.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07101b] to-transparent p-5 pt-16">
          <span className="rounded-full border border-dusk-aqua/25 bg-[#07101b]/80 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-dusk-aqua backdrop-blur">
            {eventStatus(item)}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="eyebrow">{event.tag}</div>
        <h2 className="mt-1 text-2xl font-black">{event.title}</h2>
        <p className="mt-2 text-sm font-bold text-slate-300">
          {dateLabel(event.startAt, event.endAt)}
        </p>
        {event.location ? (
          <p className="mt-1 text-sm text-slate-500">{event.location}</p>
        ) : null}

        <p className="mt-4 line-clamp-3 text-sm text-slate-400">
          {caseStudy?.outcome ||
            event.description ||
            "Operational record established."}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="tag !mt-0">{event.eventType}</span>
            <span className="tag !mt-0">
              {item.mediaCount} evidence file{item.mediaCount === 1 ? "" : "s"}
            </span>
          </div>
          <span className="text-sm font-black text-dusk-aqua">
            OPEN {documentType(item).toUpperCase()} →
          </span>
        </div>
      </div>
    </Link>
  );
}
