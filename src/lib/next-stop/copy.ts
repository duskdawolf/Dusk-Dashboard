import { buildWhereToFindDusk } from "@/lib/alpha31/where-to-find-dusk";
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

export async function generateNextStopCopy(
  route: RouteContext,
): Promise<NextStopCopy> {
  const client = nextStopOpenAI();
  const whereToFind = await buildWhereToFindDusk(route.current.id);
  const findMeItems = whereToFind.nextStopLines;

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
