import { copyModel, openaiClient } from './openai';
import { formatDateLine, formatLocation } from './format';
import type { GeneratedCopyFields, NextStopCopy, RouteContext } from './types';

const copySchema = {
  type: 'object',
  properties: {
    headline: { type: 'string', minLength: 1, maxLength: 40 },
    subheadline: { type: 'string', minLength: 1, maxLength: 90 },
    currentEventKicker: { type: 'string', minLength: 1, maxLength: 30 },
    findMeTitle: { type: 'string', minLength: 1, maxLength: 36 },
    findMeItems: {
      type: 'array', minItems: 1, maxItems: 4,
      items: { type: 'string', minLength: 1, maxLength: 52 },
    },
    flavorText: { type: 'string', minLength: 1, maxLength: 110 },
    pastLabel: { type: 'string', minLength: 1, maxLength: 24 },
    futureLabel: { type: 'string', minLength: 1, maxLength: 24 },
    artDirection: { type: 'string', minLength: 1, maxLength: 500 },
  },
  required: [
    'headline','subheadline','currentEventKicker','findMeTitle','findMeItems',
    'flavorText','pastLabel','futureLabel','artDirection',
  ],
  additionalProperties: false,
} as const;

function routeSummary(route: RouteContext) {
  return {
    current: {
      title: route.current.title,
      location: formatLocation(route.current),
      date: formatDateLine(route.current),
      theme: route.current.eventTheme,
      appearanceMode: route.current.appearanceMode,
      findMeNotes: route.current.findMeNotes,
    },
    previous: route.previous.map((event) => ({ title: event.title, location: formatLocation(event) })),
    next: route.next.map((event) => ({ title: event.title, location: formatLocation(event) })),
  };
}

export async function generateNextStopCopy(route: RouteContext): Promise<NextStopCopy> {
  const response = await openaiClient().responses.create({
    model: copyModel(),
    store: false,
    input: [
      {
        role: 'system',
        content: 'You write concise branded copy for Dusk Induskries, a playful furry-event operations site. Keep the tone mischievous, energetic, cute, and all-ages. Never invent a panel time, room, venue detail, appearance, performance, policy, or schedule item that is not present in the supplied data. If find-me data is sparse, use truthful generic wording based only on appearanceMode/findMeNotes. Do not alter event names, dates, or locations; those are rendered separately by code.',
      },
      {
        role: 'user',
        content: "Create the short supporting copy and art direction for a mobile 9:16 'Dusk's Next Stop' route poster. Past events appear above, current event dominates the middle, future events appear below. The image itself will NOT render factual text; exact text is overlaid later by the app. Data:\n" + JSON.stringify(routeSummary(route), null, 2),
      },
    ],
    text: {
      format: { type: 'json_schema', name: 'dusk_next_stop_copy', strict: true, schema: copySchema },
    },
  });

  const parsed = JSON.parse(response.output_text) as GeneratedCopyFields;
  return {
    ...parsed,
    currentEventTitle: route.current.title,
    locationLine: formatLocation(route.current),
    dateLine: formatDateLine(route.current),
  };
}
