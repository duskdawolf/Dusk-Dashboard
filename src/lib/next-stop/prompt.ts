import type { NextStopCopy, RouteContext } from "./types";

export const NEXT_STOP_IMAGE_SIZE = "1152x2048";

export function buildBackgroundPrompt(route: RouteContext, copy: NextStopCopy) {
  return [
    "Create a polished vertical 9:16 background artwork for Dusk Induskries.",
    "Mood: neon dusk sky, electric aqua, cobalt blue, violet and magenta; playful furry road-trip / deployment poster.",
    `Current event theme: ${route.current.eventTheme || "energetic furry event"}.`,
    `Art direction: ${copy.artDirection}`,
    "The center must be the visual focal point.",
    "Suggest a top-to-center-to-bottom route with glowing trails or paw-inspired marks.",
    "Leave low-detail/dark negative-space areas for typography overlays.",
    "No readable text, no letters, no numbers, no logos, no watermark.",
  ].join("\n");
}
