import { formatDateLine, formatLocation } from "./format";
import type {
  NextStopCopy,
  NextStopPosterText,
  PosterStop,
  RouteContext,
} from "./types";

function clean(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text || null;
}

function stop(event: RouteContext["current"]): PosterStop {
  return {
    title: event.title,
    location: clean(formatLocation(event)),
  };
}

function exactLines(args: {
  pastStops: PosterStop[];
  currentTitle: string;
  currentDate: string;
  currentLocation: string;
  findMeItems: string[];
  futureStops: PosterStop[];
}) {
  const lines: string[] = [
    "DUSK'S NEXT STOP",
  ];

  if (args.pastStops.length) {
    lines.push("PAST STOPS");
    for (const item of args.pastStops) {
      lines.push(item.title);
      if (item.location) lines.push(item.location);
    }
  }

  lines.push(
    "CURRENT STOP",
    args.currentTitle,
    args.currentDate,
    args.currentLocation,
  );

  if (args.findMeItems.length) {
    lines.push("HOW TO FIND DUSK", ...args.findMeItems);
  }

  if (args.futureStops.length) {
    lines.push("NEXT STOPS");
    for (const item of args.futureStops) {
      lines.push(item.title);
      if (item.location) lines.push(item.location);
    }
  }

  lines.push("@duskdawolf");

  return lines.filter(Boolean);
}

function facts(args: {
  route: RouteContext;
  copy: NextStopCopy;
}) {
  const values = [
    args.route.current.title,
    formatDateLine(args.route.current),
    formatLocation(args.route.current),
    ...args.route.previous.flatMap((event) => [
      event.title,
      formatLocation(event),
    ]),
    ...args.copy.findMeItems,
    ...args.route.next.flatMap((event) => [
      event.title,
      formatLocation(event),
    ]),
    "@duskdawolf",
  ];

  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

export function buildNextStopPosterText(args: {
  route: RouteContext;
  copy: NextStopCopy;
  allowAiWording: boolean;
}): NextStopPosterText {
  const pastStops = args.route.previous.map(stop);
  const futureStops = args.route.next.map(stop);
  const currentTitle = args.route.current.title;
  const currentDate = formatDateLine(args.route.current);
  const currentLocation = formatLocation(args.route.current);
  const findMeItems = args.copy.findMeItems ?? [];

  return {
    mode: args.allowAiWording ? "creative" : "strict",
    purpose:
      "A furry social-story poster announcing where Dusk will be at a furry convention or furry event.",
    title: "DUSK'S NEXT STOP",
    pastLabel: "PAST STOPS",
    pastStops,
    currentLabel: "CURRENT STOP",
    currentTitle,
    currentDate,
    currentLocation,
    findMeLabel: "HOW TO FIND DUSK",
    findMeItems,
    futureLabel: "NEXT STOPS",
    futureStops,
    handle: "@duskdawolf",
    exactVisibleLines: exactLines({
      pastStops,
      currentTitle,
      currentDate,
      currentLocation,
      findMeItems,
      futureStops,
    }),
    factLedger: facts({
      route: args.route,
      copy: args.copy,
    }),
  };
}

export function posterTextAsPromptBlock(payload: NextStopPosterText) {
  return [
    payload.title,
    "",
    ...(payload.pastStops.length
      ? [
          payload.pastLabel,
          ...payload.pastStops.flatMap((item) =>
            [item.title, item.location].filter(Boolean) as string[],
          ),
          "",
        ]
      : []),
    payload.currentLabel,
    payload.currentTitle,
    payload.currentDate,
    payload.currentLocation,
    "",
    ...(payload.findMeItems.length
      ? [
          payload.findMeLabel,
          ...payload.findMeItems,
          "",
        ]
      : []),
    ...(payload.futureStops.length
      ? [
          payload.futureLabel,
          ...payload.futureStops.flatMap((item) =>
            [item.title, item.location].filter(Boolean) as string[],
          ),
          "",
        ]
      : []),
    payload.handle,
  ]
    .filter((line, index, all) => {
      if (line !== "") return true;
      return index > 0 && all[index - 1] !== "";
    })
    .join("\n");
}
