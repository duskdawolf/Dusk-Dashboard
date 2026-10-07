import Image from "next/image";
import Link from "next/link";
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

export function DeploymentArchiveCard({
  item,
  mode,
}: {
  item: ChaosArchiveItem;
  mode: "future" | "past";
}) {
  const { event, caseStudy } = item;

  return (
    <Link
      href={`/deployments/${event.slug}`}
      className="group overflow-hidden rounded-3xl border border-dusk-line bg-dusk-panel shadow-dusk transition hover:-translate-y-1 hover:border-dusk-aqua/35"
    >
      <div className="relative aspect-video overflow-hidden bg-[#091321]">
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt={event.title}
            fill
            unoptimized={item.coverImage.startsWith("http")}
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(97,232,255,.12),transparent_62%)]">
            <div className="text-center">
              <div className="text-5xl">🐾</div>
              <div className="mt-2 text-xs font-black uppercase tracking-[.2em] text-slate-600">
                {mode === "future" ? "deployment pending" : "evidence pending"}
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07101b] to-transparent p-5 pt-16">
          <span className="rounded-full border border-dusk-aqua/25 bg-[#07101b]/80 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-dusk-aqua backdrop-blur">
            {mode === "future"
              ? "TACTICAL DEPLOYMENT PLAN"
              : "CASE STUDY"}
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
          {mode === "past"
            ? caseStudy?.outcome ||
              event.description ||
              "Historical deployment record established."
            : event.description ||
              "Forward deployment record established."}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="tag !mt-0">{event.eventType}</span>
            {mode === "past" ? (
              <span className="tag !mt-0">
                {item.mediaCount} evidence file
                {item.mediaCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          <span className="text-sm font-black text-dusk-aqua">
            {mode === "future"
              ? "OPEN DEPLOYMENT PLAN →"
              : "OPEN CASE STUDY →"}
          </span>
        </div>
      </div>
    </Link>
  );
}
