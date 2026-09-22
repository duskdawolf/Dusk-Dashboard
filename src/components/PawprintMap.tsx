"use client";

import { useMemo, useState } from "react";
import { geoAlbersUsa, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesTopology from "us-atlas/states-10m.json";
import type { EventItem, EventQuarter, EventType } from "@/types";

type YearFilter = number | "all";
type QuarterFilter = EventQuarter | "all";
type ProjectedPoint = [number, number];

const WIDTH = 960;
const HEIGHT = 560;
const INSET_WIDTH = 500;
const INSET_HEIGHT = 310;

const northeastBounds = {
  minLon: -80.6,
  maxLon: -66.2,
  minLat: 38.2,
  maxLat: 46.2,
};

const eventColors: Record<EventType, string> = {
  convention: "#ff4f9b",
  meetup: "#61e8ff",
  hosting: "#ffd46f",
  public: "#a88dff",
};

const eventLabels: Record<EventType, string> = {
  convention: "Convention",
  meetup: "Meetup",
  hosting: "Hosting / Programming",
  public: "Public Event",
};

function isNortheast(event: EventItem) {
  if (event.latitude == null || event.longitude == null) return false;
  return (
    event.longitude >= northeastBounds.minLon &&
    event.longitude <= northeastBounds.maxLon &&
    event.latitude >= northeastBounds.minLat &&
    event.latitude <= northeastBounds.maxLat
  );
}

function eventYear(event: EventItem) {
  return new Date(event.startAt).getFullYear();
}

function formatEventDate(event: EventItem) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(event.startAt));
}

function statusFor(event: EventItem) {
  const now = Date.now();
  const end = new Date(event.endAt ?? event.startAt).getTime();
  return end < now ? "completed" : "upcoming";
}

function buildLinePath(
  projection: ReturnType<typeof geoAlbersUsa>,
  events: EventItem[],
  northeastCluster: ProjectedPoint | null,
) {
  const ordered = [...events]
    .filter((event) => event.latitude != null && event.longitude != null)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const points: ProjectedPoint[] = [];
  let previousWasNortheast = false;

  for (const event of ordered) {
    const eventIsNortheast = isNortheast(event);
    if (eventIsNortheast && northeastCluster) {
      if (!previousWasNortheast) points.push(northeastCluster);
      previousWasNortheast = true;
      continue;
    }

    previousWasNortheast = false;
    const projected = projection([event.longitude!, event.latitude!]);
    if (projected) points.push(projected as ProjectedPoint);
  }

  if (points.length < 2) return "";
  return geoPath().projection(null)({ type: "LineString", coordinates: points } as never) ?? "";
}

function chaosIndex(events: EventItem[]) {
  const states = new Set(events.map((event) => event.stateCode).filter(Boolean)).size;
  const hosted = events.filter((event) => event.eventType === "hosting").length;
  return Math.min(99, 8 + events.length * 6 + states * 4 + hosted * 4);
}

function PawMarker({
  x,
  y,
  color,
  upcoming,
  label,
  onSelect,
  scale = 1,
}: {
  x: number;
  y: number;
  color: string;
  upcoming: boolean;
  label: string;
  onSelect: () => void;
  scale?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      className="cursor-pointer outline-none"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
    >
      {upcoming ? (
        <circle r="18" fill="none" stroke={color} strokeWidth="2" opacity=".5">
          <animate attributeName="r" values="13;23;13" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values=".6;0;.6" dur="1.8s" repeatCount="indefinite" />
        </circle>
      ) : null}
      <circle cx="0" cy="4" r="7.5" fill={color} stroke="#07101b" strokeWidth="2" />
      <circle cx="-8" cy="-5" r="3.8" fill={color} stroke="#07101b" strokeWidth="1.5" />
      <circle cx="-3" cy="-10" r="3.8" fill={color} stroke="#07101b" strokeWidth="1.5" />
      <circle cx="3" cy="-10" r="3.8" fill={color} stroke="#07101b" strokeWidth="1.5" />
      <circle cx="8" cy="-5" r="3.8" fill={color} stroke="#07101b" strokeWidth="1.5" />
    </g>
  );
}

export function PawprintMap({ events }: { events: EventItem[] }) {
  const years = useMemo(
    () => Array.from(new Set(events.map(eventYear))).sort((a, b) => a - b),
    [events],
  );
  const defaultYear = years.at(-1) ?? new Date().getFullYear();

  const [year, setYear] = useState<YearFilter>(defaultYear);
  const [quarter, setQuarter] = useState<QuarterFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stateFeatures = useMemo(() => {
    const topology = statesTopology as unknown as { objects: { states: unknown; nation: unknown } };
    return {
      states: (feature(statesTopology as never, topology.objects.states as never) as unknown as { features: never[] }).features,
      nation: feature(statesTopology as never, topology.objects.nation as never) as never,
    };
  }, []);

  const nationalProjection = useMemo(() => {
    return geoAlbersUsa().fitExtent(
      [[24, 24], [WIDTH - 24, HEIGHT - 24]],
      stateFeatures.nation,
    );
  }, [stateFeatures.nation]);

  const insetProjection = useMemo(() => {
    const boundsFeature = {
      type: "Polygon",
      coordinates: [[
        [northeastBounds.minLon, northeastBounds.minLat],
        [northeastBounds.maxLon, northeastBounds.minLat],
        [northeastBounds.maxLon, northeastBounds.maxLat],
        [northeastBounds.minLon, northeastBounds.maxLat],
        [northeastBounds.minLon, northeastBounds.minLat],
      ]],
    } as never;

    return geoMercator().fitExtent(
      [[18, 18], [INSET_WIDTH - 18, INSET_HEIGHT - 18]],
      boundsFeature,
    );
  }, []);

  const nationalPath = useMemo(() => geoPath(nationalProjection), [nationalProjection]);
  const insetPath = useMemo(() => geoPath(insetProjection), [insetProjection]);

  const filtered = useMemo(() => {
    return events.filter((event) => {
      const matchesYear = year === "all" || eventYear(event) === year;
      const matchesQuarter = quarter === "all" || event.quarter === quarter;
      return matchesYear && matchesQuarter;
    });
  }, [events, quarter, year]);

  const mapped = filtered.filter((event) => event.latitude != null && event.longitude != null);
  const northeastEvents = mapped.filter(isNortheast);
  const nonNortheastEvents = mapped.filter((event) => !isNortheast(event));

  const northeastCentroid = useMemo<ProjectedPoint | null>(() => {
    if (!northeastEvents.length) return null;
    const lon = northeastEvents.reduce((sum, event) => sum + event.longitude!, 0) / northeastEvents.length;
    const lat = northeastEvents.reduce((sum, event) => sum + event.latitude!, 0) / northeastEvents.length;
    const projected = nationalProjection([lon, lat]);
    return projected ? (projected as ProjectedPoint) : null;
  }, [northeastEvents, nationalProjection]);

  const routePath = useMemo(
    () => buildLinePath(nationalProjection, filtered, northeastCentroid),
    [filtered, nationalProjection, northeastCentroid],
  );

  const selected = filtered.find((event) => event.id === selectedId) ?? null;
  const score = chaosIndex(filtered);

  return (
    <div className="space-y-5">
      <div className="panel !p-4 sm:!p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {years.map((value) => (
              <button
                key={value}
                onClick={() => setYear(value)}
                className={`rounded-full border px-3 py-2 text-xs font-black ${year === value ? "border-dusk-pink/50 bg-dusk-pink/15" : "border-dusk-line bg-white/5"}`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "q1", "q2", "q3", "q4"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setQuarter(value)}
                className={`rounded-full border px-3 py-2 text-xs font-black uppercase ${quarter === value ? "border-dusk-aqua/50 bg-dusk-aqua/10" : "border-dusk-line bg-white/5"}`}
              >
                {value === "all" ? "All quarters" : value}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#08111f]">
            <div className="border-b border-white/5 px-4 py-3 text-xs font-black uppercase tracking-[.16em] text-slate-500">National Operations</div>
            <div className="relative aspect-[16/10] w-full">
              <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="absolute inset-0 h-full w-full">
                <g fill="#12223a" stroke="#2d4a6b" strokeWidth="1.1">
                  {stateFeatures.states.map((state, index) => (
                    <path key={index} d={nationalPath(state) ?? ""} />
                  ))}
                </g>

                {routePath ? (
                  <path d={routePath} fill="none" stroke="#ff4f9b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="9 9" className="map-route-line" />
                ) : null}

                {nonNortheastEvents.map((event) => {
                  const projected = nationalProjection([event.longitude!, event.latitude!]);
                  if (!projected) return null;
                  return (
                    <PawMarker
                      key={event.id}
                      x={projected[0]}
                      y={projected[1]}
                      color={eventColors[event.eventType]}
                      upcoming={statusFor(event) === "upcoming"}
                      label={event.title}
                      onSelect={() => setSelectedId(event.id)}
                      scale={1.15}
                    />
                  );
                })}

                {northeastCentroid && northeastEvents.length ? (
                  <g
                    transform={`translate(${northeastCentroid[0]} ${northeastCentroid[1]})`}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer"
                    aria-label={`Northeast operations cluster: ${northeastEvents.length} events`}
                    onClick={() => setSelectedId(northeastEvents[0]?.id ?? null)}
                  >
                    <circle r="23" fill="#ff4f9b" stroke="#07101b" strokeWidth="3" />
                    <text textAnchor="middle" dominantBaseline="central" fill="#07101b" fontSize="14" fontWeight="900">NE×{northeastEvents.length}</text>
                  </g>
                ) : null}
              </svg>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <div className="eyebrow">{year === "all" ? "All-Time" : year} Geographic Chaos Index</div>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-black text-dusk-pink">{score}%</span>
                <span className="pb-1 text-sm text-slate-500">enterprise concern level</span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-dusk-aqua via-dusk-pink to-dusk-gold transition-all" style={{ width: `${score}%` }} />
              </div>
            </div>

            <div className="card">
              <div className="eyebrow">Legend</div>
              <div className="grid gap-2 text-sm">
                {(Object.keys(eventColors) as EventType[]).map((type) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="size-3 rounded-full" style={{ background: eventColors[type] }} />
                    <span>{eventLabels[type]}</span>
                  </div>
                ))}
                <div className="mt-2 border-t border-white/5 pt-3 text-slate-500">Pulsing = upcoming • solid = completed</div>
              </div>
            </div>

            <div className="card min-h-48">
              <div className="eyebrow">Selected Deployment</div>
              {selected ? (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-black">{selected.title}</h3>
                    <span className="size-3 shrink-0 rounded-full" style={{ background: eventColors[selected.eventType] }} />
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-300">{formatEventDate(selected)}</p>
                  {selected.location ? <p className="mt-1 text-sm text-slate-500">{selected.location}</p> : null}
                  <p className="mt-3 text-sm text-slate-400">{selected.description}</p>
                  <span className="tag">{statusFor(selected)}</span>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Tap a pawprint—or the Northeast cluster—to inspect an operation.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {northeastEvents.length ? (
        <div className="panel !p-4 sm:!p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Magnified inset</div>
              <h3 className="text-2xl font-black">Northeast Operations — Area of Extreme Pawprint Density</h3>
            </div>
            <span className="tag !mt-0">{northeastEvents.length} recorded deployments</span>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
            <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-white/5 bg-[#08111f]">
              <svg viewBox={`0 0 ${INSET_WIDTH} ${INSET_HEIGHT}`} className="absolute inset-0 h-full w-full">
                <g fill="#12223a" stroke="#2d4a6b" strokeWidth="1.2">
                  {stateFeatures.states.map((state, index) => (
                    <path key={index} d={insetPath(state) ?? ""} />
                  ))}
                </g>
                {northeastEvents.map((event, index) => {
                  const point = insetProjection([event.longitude!, event.latitude!]);
                  if (!point) return null;
                  const angle = (index % 4) * (Math.PI / 2);
                  const duplicateCount = northeastEvents.filter((candidate) =>
                    Math.abs(candidate.latitude! - event.latitude!) < 0.01 &&
                    Math.abs(candidate.longitude! - event.longitude!) < 0.01
                  ).length;
                  const sameIndex = northeastEvents
                    .filter((candidate) =>
                      Math.abs(candidate.latitude! - event.latitude!) < 0.01 &&
                      Math.abs(candidate.longitude! - event.longitude!) < 0.01
                    )
                    .findIndex((candidate) => candidate.id === event.id);
                  const radius = duplicateCount > 1 ? 12 : 0;
                  const x = point[0] + Math.cos(angle + sameIndex) * radius;
                  const y = point[1] + Math.sin(angle + sameIndex) * radius;

                  return (
                    <PawMarker
                      key={event.id}
                      x={x}
                      y={y}
                      color={eventColors[event.eventType]}
                      upcoming={statusFor(event) === "upcoming"}
                      label={event.title}
                      onSelect={() => setSelectedId(event.id)}
                      scale={1.05}
                    />
                  );
                })}
              </svg>
            </div>

            <div className="grid content-start gap-2">
              {northeastEvents
                .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                .map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedId(event.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${selectedId === event.id ? "border-dusk-aqua/40 bg-dusk-aqua/10" : "border-dusk-line bg-white/[0.025] hover:border-white/15"}`}
                  >
                    <div>
                      <strong className="block">{event.title}</strong>
                      <span className="text-xs text-slate-500">{formatEventDate(event)} • {event.location}</span>
                    </div>
                    <span className="size-3 shrink-0 rounded-full" style={{ background: eventColors[event.eventType] }} />
                  </button>
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
