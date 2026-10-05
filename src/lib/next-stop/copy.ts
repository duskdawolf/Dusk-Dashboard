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
    findMeTitle: { type: "string" },
    findMeItems: { type: "array", maxItems: 5, items: { type: "string" } },
    flavorText: { type: "string" },
    pastLabel: { type: "string" },
    futureLabel: { type: "string" },
    artDirection: { type: "string" },
  },
  required: [
    "headline",
    "subheadline",
    "currentEventKicker",
    "findMeTitle",
    "findMeItems",
    "flavorText",
    "pastLabel",
    "futureLabel",
    "artDirection",
  ],
} as const;

function splitFindMeNotes(text: string | null | undefined) {
  if (!text) return [];
  return text
    .replace(/\r/g, "")
    .split(/\n|•|;|\|/g)
    .map((part) => part.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
}

function canonicalFindMeItems(route: RouteContext) {
  const items: string[] = [];
  if (route.current.appearanceMode) {
    const label = route.current.appearanceMode.trim();
    items.push(
      /^look for/i.test(label)
        ? label
        : `Look for Dusk ${/^in\b/i.test(label.toLowerCase()) ? label : `in ${label}`}.`,
    );
  }

  for (const note of splitFindMeNotes(route.current.findMeNotes)) {
    items.push(note.endsWith(".") ? note : `${note}.`);
  }

  const deduped = Array.from(new Set(items.map((item) => item.trim()))).filter(Boolean);
  if (deduped.length) return deduped.slice(0, 5);

  return [
    "No specific meetup details supplied yet.",
    "Keep your whiskers tuned for updates!",
  ];
}

export async function generateNextStopCopy(route: RouteContext): Promise<NextStopCopy> {
  const client = nextStopOpenAI();
  const response = await client.responses.create({
    model: nextStopCopyModel(),
    store: false,
    input: [
      {
        role: "system",
        content:
          "Write concise all-ages Dusk Induskries event-poster copy. " +
          "Be playful and mischievous. Never invent times, rooms, appearances, panel names, meetup logistics, or other event facts. " +
          "Use supplied appearanceMode and findMeNotes directly for 'How to Find Dusk'.",
      },
      {
        role: "user",
        content:
          "Create supporting copy for a 9:16 Dusk's Next Stop poster.\n" +
          JSON.stringify({
            current: {
              title: route.current.title,
              location: formatLocation(route.current),
              date: formatDateLine(route.current),
              theme: route.current.eventTheme,
              appearanceMode: route.current.appearanceMode,
              findMeNotes: route.current.findMeNotes,
            },
            previous: route.previous.map((e) => ({
              title: e.title,
              location: formatLocation(e),
            })),
            next: route.next.map((e) => ({
              title: e.title,
              location: formatLocation(e),
            })),
          }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "dusk_next_stop_copy",
        strict: true,
        schema,
      },
    },
  });

  const base = JSON.parse(response.output_text);
  return {
    ...base,
    findMeTitle: "How to Find Dusk",
    findMeItems: canonicalFindMeItems(route),
    currentEventTitle: route.current.title,
    locationLine: formatLocation(route.current),
    dateLine: formatDateLine(route.current),
  };
}
