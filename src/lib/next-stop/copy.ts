import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import { nextStopCopyModel, nextStopOpenAI } from "./openai";
import { formatDateLine, formatLocation } from "./format";
import type { NextStopCopy, RouteContext } from "./types";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    subheadline: { type: "string" },
    currentEventKicker: { type: "string" },
    flavorText: { type: "string" },
    pastLabel: { type: "string" },
    futureLabel: { type: "string" },
    artDirection: { type: "string" },
  },
  required: [
    "headline",
    "subheadline",
    "currentEventKicker",
    "flavorText",
    "pastLabel",
    "futureLabel",
    "artDirection",
  ],
} as const;

function suitLabel(mode: string) {
  if (mode === "fullsuiting") return "Fullsuiting";
  if (mode === "partialing") return "Partialing";
  return "Not suiting";
}

function timeLabel(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.DUSK_HOME_TIMEZONE ?? "America/New_York",
  }).format(date);
}

function splitNotes(value?: string | null) {
  if (!value) return [];
  return value
    .replace(/\r/g, "")
    .split(/\n|•|;/g)
    .map((part) => part.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
}

async function structuredFindMe(route: RouteContext) {
  const supabase = createAlpha7SupabaseAdmin();
  const { data, error } = await supabase
    .from("deployment_sub_events")
    .select("*")
    .eq("event_id", route.current.id)
    .neq("attendance_status", "not_going")
    .order("next_stop_priority", { ascending: false })
    .order("starts_at", { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const featured = rows.filter((item) => item.feature_on_next_stop);
  const publicRows = rows.filter((item) => item.show_in_find_dusk);
  const chosen = featured.length ? featured : publicRows;

  const deploymentSuiting =
    String((route.current.raw as any).suiting_mode ?? "not_suiting");

  const items = chosen.slice(0, 4).map((item) => {
    const effectiveSuit =
      item.suiting_mode === "inherit"
        ? deploymentSuiting
        : item.suiting_mode;

    const location = item.room || item.location;
    return [
      `${timeLabel(item.starts_at)} — ${item.title}`,
      location ? `@ ${location}` : null,
      suitLabel(effectiveSuit),
      ["hosting", "performing"].includes(item.attendance_status)
        ? item.attendance_status === "hosting"
          ? "Hosting"
          : "Performing"
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  });

  if (items.length < 5) {
    for (const note of splitNotes(route.current.findMeNotes)) {
      if (items.length >= 5) break;
      items.push(note);
    }
  }

  if (!items.length) {
    items.push(`Deployment default: ${suitLabel(deploymentSuiting)}`);
  }

  return items;
}

export async function generateNextStopCopy(
  route: RouteContext,
): Promise<NextStopCopy> {
  const client = nextStopOpenAI();
  const findMeItems = await structuredFindMe(route);

  const response = await client.responses.create({
    model: nextStopCopyModel(),
    store: false,
    input: [
      {
        role: "system",
        content:
          "Write concise all-ages social-poster copy for Dusk, a furry promoting that they will be attending a furry convention. " +
          "This will be posted to X, Snapchat, and Instagram Story. Keep it energetic, legible, promotional, and brief. " +
          "Do not invent schedule facts, rooms, suiting state, appearances, panels, or locations. Structured schedule facts are rendered separately.",
      },
      {
        role: "user",
        content: JSON.stringify({
          current: {
            title: route.current.title,
            location: formatLocation(route.current),
            date: formatDateLine(route.current),
            theme: route.current.eventTheme,
          },
          previous: route.previous.map((event) => event.title),
          next: route.next.map((event) => event.title),
          structuredFindMe: findMeItems,
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "dusk_next_stop_copy_alpha9",
        strict: true,
        schema,
      },
    },
  });

  const base = JSON.parse(response.output_text);

  return {
    ...base,
    findMeTitle: "How to Find Dusk",
    findMeItems,
    currentEventTitle: route.current.title,
    locationLine: formatLocation(route.current),
    dateLine: formatDateLine(route.current),
  };
}
