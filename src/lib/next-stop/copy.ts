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
    findMeItems: { type: "array", maxItems: 4, items: { type: "string" } },
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

export async function generateNextStopCopy(route: RouteContext): Promise<NextStopCopy> {
  const client = nextStopOpenAI();
  const response = await client.responses.create({
    model: nextStopCopyModel(),
    store: false,
    input: [
      {
        role: "system",
        content:
          "Write very concise all-ages Dusk Induskries furry-event poster copy. " +
          "Be playful and mischievous. Never invent a time, room, appearance, panel, hotel detail, or event fact. " +
          "Use only supplied data. Exact event title/location/date are rendered separately by code.",
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
    currentEventTitle: route.current.title,
    locationLine: formatLocation(route.current),
    dateLine: formatDateLine(route.current),
  };
}
