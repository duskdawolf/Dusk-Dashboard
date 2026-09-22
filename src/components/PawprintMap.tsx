"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { geoAlbersUsa, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesTopology from "us-atlas/states-10m.json";
import type { EventItem, EventQuarter, EventType } from "@/types";

type YearFilter = number | "all";
type QuarterFilter = EventQuarter | "all";
type ProjectedPoint = [number, number];
type ZoomMode = "national" | "northeast";

const WIDTH = 960;
const HEIGHT = 560;

// The same light aqua / "TOSS" color used throughout Dusk branding.
const DUSK_BLUE = "#61e8ff";

// FIPS IDs used by us-atlas. Keeping the zoom geometry to the Northeast avoids
// Alaska/Hawaii/continental-wide geometry from shrinking the zoomed map.
const NORTHEAST_STATE_IDS = new Set([
  "09", // CT
  "10", // DE
  "11", // DC
  "23", // ME
  "24", // MD
  "25", // MA
  "33", // NH
  "34", // NJ
  "36", // NY
  "42", // PA
  "44", // RI
  "50", // VT
]);

const northeastBounds = {
  minLon: -80.6,
  maxLon: -66.2,
  minLat: 38.2,
  maxLat: 46.2,
};

const eventColors: Record<EventType, string> = {
  convention: "#ff4f9b",
  meetup: DUSK_BLUE,
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
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (!end || formatter.format(start) === formatter.format(end)) {
    return formatter.format(start);
  }

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function statusFor(event: EventItem) {
  const now = Date.now();
  const end = new Date(event.endAt ?? event.startAt).getTime();
  return end < now ? "completed" : "upcoming";
}

function chaosIndex(events: EventItem[]) {
  const states = new Set(events.map((event) => event.stateCode).filter(Boolean)).size;
  const hosted = events.filter((event) => event.eventType === "hosting").length;
  return Math.min(99, 8 + events.length * 6 + states * 4 + hosted * 4);
}

function pathFromPoints(points: ProjectedPoint[]) {
  if (points.length < 2) return "";
  return (
    geoPath().projection(null)({
      type: "LineString",
      coordinates: points,
    } as never) ?? ""
  );
}

function projectedRouteRows(
  projection: ReturnType<typeof geoAlbersUsa>,
  events: EventItem[],
  northeastCluster: ProjectedPoint | null,
) {
  const ordered = [...events]
    .filter((event) => event.latitude != null && event.longitude != null)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const rows: { event: EventItem; point: ProjectedPoint }[] = [];
  let previousWasNortheast = false;

  for (const event of ordered) {
    const northeast = isNortheast(event);

    if (northeast && northeastCluster) {
      if (!previousWasNortheast) {
        rows.push({ event, point: northeastCluster });
      }
      previousWasNortheast = true;
      continue;
    }

    previousWasNortheast = false;
    const point = projection([event.longitude!, event.latitude!]);
    if (point) rows.push({ event, point: point as ProjectedPoint });
  }

  return rows;
}

function spreadDuplicatePoints(
  events: EventItem[],
  project: (coordinates: [number, number]) => [number, number] | null,
) {
  return events.map((event) => {
    const point = project([event.longitude!, event.latitude!]);
    if (!point) return { event, point: null };

    const colocated = events.filter(
      (candidate) =>
        Math.abs(candidate.latitude! - event.latitude!) < 0.02 &&
        Math.abs(candidate.longitude! - event.longitude!) < 0.02,
    );

    const index = colocated.findIndex((candidate) => candidate.id === event.id);
    const radius = colocated.length > 1 ? 14 : 0;
    const angle = index * ((Math.PI * 2) / Math.max(1, colocated.length));

    return {
      event,
      point: [
        point[0] + Math.cos(angle) * radius,
        point[1] + Math.sin(angle) * radius,
      ] as ProjectedPoint,
    };
  });
}

function PawMarker({
  x,
  y,
  color,
  upcoming,
  label,
  onSelect,
  scale = 1,
  selected = false,
}: {
  x: number;
  y: number;
  color: string;
  upcoming: boolean;
  label: string;
  onSelect: () => void;
  scale?: number;
  selected?: boolean;
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
      {selected ? (
        <circle r="19" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity=".9" />
      ) : null}
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
  const [zoomMode, setZoomMode] = useState<ZoomMode>("national");

  const stateFeatures = useMemo(() => {
    const topology = statesTopology as unknown as {
      objects: { states: unknown; nation: unknown };
    };

    const states = (
      feature(
        statesTopology as never,
        topology.objects.states as never,
      ) as unknown as { features: Array<{ id?: string | number }> }
    ).features;

    const northeastStates = states.filter((state) => {
      const id = String(state.id ?? "").padStart(2, "0");
      return NORTHEAST_STATE_IDS.has(id);
    });

    return {
      states,
      northeastStates,
      nation: feature(
        statesTopology as never,
        topology.objects.nation as never,
      ) as never,
    };
  }, []);

  const nationalProjection = useMemo(
    () =>
      geoAlbersUsa().fitExtent(
        [
          [24, 24],
          [WIDTH - 24, HEIGHT - 24],
        ],
        stateFeatures.nation,
      ),
    [stateFeatures.nation],
  );

  const northeastProjection = useMemo(() => {
    const collection = {
      type: "FeatureCollection",
      features: stateFeatures.northeastStates,
    } as never;

    return geoMercator().fitExtent(
      [
        [48, 42],
        [WIDTH - 48, HEIGHT - 42],
      ],
      collection,
    );
  }, [stateFeatures.northeastStates]);

  const nationalPath = useMemo(
    () => geoPath(nationalProjection),
    [nationalProjection],
  );

  const northeastPath = useMemo(
    () => geoPath(northeastProjection),
    [northeastProjection],
  );

  const filtered = useMemo(
    () =>
      events.filter((event) => {
        const matchesYear = year === "all" || eventYear(event) === year;
        const matchesQuarter = quarter === "all" || event.quarter === quarter;
        return matchesYear && matchesQuarter;
      }),
    [events, quarter, year],
  );

  const mapped = filtered.filter(
    (event) => event.latitude != null && event.longitude != null,
  );
  const northeastEvents = mapped.filter(isNortheast);
  const nonNortheastEvents = mapped.filter((event) => !isNortheast(event));

  const northeastCentroid = useMemo<ProjectedPoint | null>(() => {
    if (!northeastEvents.length) return null;

    const lon =
      northeastEvents.reduce((sum, event) => sum + event.longitude!, 0) /
      northeastEvents.length;
    const lat =
      northeastEvents.reduce((sum, event) => sum + event.latitude!, 0) /
      northeastEvents.length;

    const point = nationalProjection([lon, lat]);
    return point ? (point as ProjectedPoint) : null;
  }, [northeastEvents, nationalProjection]);

  const routeRows = useMemo(
    () =>
      projectedRouteRows(
        nationalProjection,
        filtered,
        northeastCentroid,
      ),
    [nationalProjection, filtered, northeastCentroid],
  );

  const firstUpcomingIndex = routeRows.findIndex(
    (row) => statusFor(row.event) === "upcoming",
  );

  const completedPoints =
    firstUpcomingIndex === -1
      ? routeRows.map((row) => row.point)
      : routeRows.slice(0, Math.max(1, firstUpcomingIndex)).map((row) => row.point);

  // Include the final completed point at the start of the future path so
  // the blue future route visibly continues from the historical route.
  const futurePoints =
    firstUpcomingIndex === -1
      ? []
      : routeRows
          .slice(Math.max(0, firstUpcomingIndex - 1))
          .map((row) => row.point);

  const completedRoute = pathFromPoints(completedPoints);
  const futureRoute = pathFromPoints(futurePoints);

  const northeastMarkerRows = useMemo(
    () =>
      spreadDuplicatePoints(northeastEvents, (coordinates) => {
        const point = northeastProjection(coordinates);
        return point ? ([point[0], point[1]] as [number, number]) : null;
      }),
    [northeastEvents, northeastProjection],
  );

  const selected =
    filtered.find((event) => event.id === selectedId) ?? null;

  const score = chaosIndex(filtered);

  function resetSelection() {
    setSelectedId(null);
  }

  return (
    <div className="space-y-5">
      <div className="panel !p-4 sm:!p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {years.map((value) => (
              <button
                key={value}
                onClick={() => {
                  setYear(value);
                  resetSelection();
                }}
                className={`rounded-full border px-3 py-2 text-xs font-black ${
                  year === value
                    ? "border-dusk-pink/50 bg-dusk-pink/15"
                    : "border-dusk-line bg-white/5"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "q1", "q2", "q3", "q4"] as const).map((value) => (
              <button
                key={value}
                onClick={() => {
                  setQuarter(value);
                  resetSelection();
                }}
                className={`rounded-full border px-3 py-2 text-xs font-black uppercase ${
                  quarter === value
                    ? "border-dusk-aqua/50 bg-dusk-aqua/10"
                    : "border-dusk-line bg-white/5"
                }`}
              >
                {value === "all" ? "All quarters" : value}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#08111f]">
            <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
              <span className="text-xs font-black uppercase tracking-[.16em] text-slate-500">
                {zoomMode === "national"
                  ? "National Operations"
                  : "Northeast Operations — Pawprint Density Critical"}
              </span>

              {zoomMode === "northeast" ? (
                <button
                  type="button"
                  onClick={() => {
                    setZoomMode("national");
                    resetSelection();
                  }}
                  className="rounded-full border border-dusk-aqua/25 bg-dusk-aqua/10 px-3 py-1.5 text-xs font-black text-dusk-aqua"
                >
                  ← Zoom back out
                </button>
              ) : null}
            </div>

            <div className="relative aspect-[16/10] w-full">
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="absolute inset-0 h-full w-full"
              >
                <defs>
                  <marker
                    id="future-arrow"
                    markerWidth="10"
                    markerHeight="10"
                    refX="8"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L0,6 L9,3 z" fill={DUSK_BLUE} />
                  </marker>
                </defs>

                {zoomMode === "national" ? (
                  <>
                    <g fill="#12223a" stroke="#2d4a6b" strokeWidth="1.1">
                      {stateFeatures.states.map((state, index) => (
                        <path key={index} d={nationalPath(state) ?? ""} />
                      ))}
                    </g>

                    {completedRoute ? (
                      <path
                        d={completedRoute}
                        fill="none"
                        stroke="#ff4f9b"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="9 9"
                        className="map-route-line"
                        opacity=".6"
                      />
                    ) : null}

                    {futureRoute ? (
                      <path
                        d={futureRoute}
                        fill="none"
                        stroke={DUSK_BLUE}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="9 9"
                        markerEnd="url(#future-arrow)"
                        className="map-route-line"
                      />
                    ) : null}

                    {nonNortheastEvents.map((event) => {
                      const projected = nationalProjection([
                        event.longitude!,
                        event.latitude!,
                      ]);
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
                          selected={selectedId === event.id}
                          scale={1.15}
                        />
                      );
                    })}

                    {northeastCentroid && northeastEvents.length ? (
                      <g
                        transform={`translate(${northeastCentroid[0]} ${northeastCentroid[1]})`}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer outline-none"
                        aria-label={`Zoom into Northeast operations: ${northeastEvents.length} events`}
                        onClick={() => {
                          setZoomMode("northeast");
                          resetSelection();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            setZoomMode("northeast");
                            resetSelection();
                          }
                        }}
                      >
                        <circle
                          r="27"
                          fill="#08111f"
                          stroke={DUSK_BLUE}
                          strokeWidth="3"
                        >
                          <animate
                            attributeName="r"
                            values="25;30;25"
                            dur="2.4s"
                            repeatCount="indefinite"
                          />
                        </circle>
                        <circle r="21" fill="#ff4f9b" stroke="#07101b" strokeWidth="2" />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#07101b"
                          fontSize="13"
                          fontWeight="900"
                        >
                          NE×{northeastEvents.length}
                        </text>
                        <text
                          y="42"
                          textAnchor="middle"
                          fill={DUSK_BLUE}
                          fontSize="12"
                          fontWeight="900"
                        >
                          ZOOM
                        </text>
                      </g>
                    ) : null}
                  </>
                ) : (
                  <>
                    <g fill="#12223a" stroke="#2d4a6b" strokeWidth="1.15">
                      {stateFeatures.northeastStates.map((state, index) => (
                        <path key={index} d={northeastPath(state as never) ?? ""} />
                      ))}
                    </g>

                    {northeastMarkerRows.map(({ event, point }) =>
                      point ? (
                        <PawMarker
                          key={event.id}
                          x={point[0]}
                          y={point[1]}
                          color={eventColors[event.eventType]}
                          upcoming={statusFor(event) === "upcoming"}
                          label={event.title}
                          onSelect={() => setSelectedId(event.id)}
                          selected={selectedId === event.id}
                          scale={1.15}
                        />
                      ) : null,
                    )}
                  </>
                )}
              </svg>

              {zoomMode === "northeast" && !selected ? (
                <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-dusk-aqua/20 bg-[#07101b]/90 px-3 py-2 text-xs font-bold text-slate-400 backdrop-blur">
                  Tap a pawprint to open the deployment preview.
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <div className="eyebrow">
                {year === "all" ? "All-Time" : year} Geographic Chaos Index
              </div>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-black text-dusk-pink">{score}%</span>
                <span className="pb-1 text-sm text-slate-500">
                  enterprise concern level
                </span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-dusk-aqua via-dusk-pink to-dusk-gold transition-all"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            <div className="card">
              <div className="eyebrow">Legend</div>
              <div className="grid gap-2 text-sm">
                {(Object.keys(eventColors) as EventType[]).map((type) => (
                  <div key={type} className="flex items-center gap-3">
                    <span
                      className="size-3 rounded-full"
                      style={{ background: eventColors[type] }}
                    />
                    <span>{eventLabels[type]}</span>
                  </div>
                ))}
                <div className="mt-2 border-t border-white/5 pt-3 text-slate-500">
                  Pulsing = upcoming • solid = completed
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <span className="h-0.5 w-8 bg-dusk-pink" />
                  completed route
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <span
                    className="h-0.5 w-8"
                    style={{ background: DUSK_BLUE }}
                  />
                  future chaos trajectory
                </div>
              </div>
            </div>

            <div className="card min-h-52">
              <div className="eyebrow">Selected Deployment</div>

              {selected ? (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-black">{selected.title}</h3>
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: eventColors[selected.eventType] }}
                    />
                  </div>

                  <p className="mt-2 text-sm font-bold text-slate-300">
                    {formatEventDate(selected)}
                  </p>
                  {selected.location ? (
                    <p className="mt-1 text-sm text-slate-500">
                      {selected.location}
                    </p>
                  ) : null}

                  <p className="mt-3 text-sm text-slate-400">
                    {selected.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="tag !mt-0">{statusFor(selected)}</span>
                    <span className="tag !mt-0">{eventLabels[selected.eventType]}</span>
                  </div>

                  <Link
                    href={`/chaos/${selected.slug}`}
                    className="button-primary mt-5 inline-flex"
                  >
                    OPEN THE INCIDENT REPORT →
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {zoomMode === "national"
                    ? "Tap a pawprint—or hit the Northeast cluster to zoom into the operational disaster."
                    : "Tap an individual pawprint to inspect that deployment. Northeast chaos is now actually zoomed."}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
