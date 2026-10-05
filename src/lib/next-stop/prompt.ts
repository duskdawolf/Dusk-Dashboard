import type { BrandConfig } from "@/lib/alpha71/types";
import type { NextStopCopy, RouteContext } from "./types";

export const NEXT_STOP_IMAGE_SIZE = "1152x2048";

export function buildBackgroundPrompt(
  route: RouteContext,
  copy: NextStopCopy,
  brandConfig?: BrandConfig | null,
) {
  const lines = [
    "Create a polished vertical 9:16 scenic background artwork for a Dusk Induskries event-route poster.",
    "Visual mood: dusk sky, electric aqua, cobalt blue, violet and magenta, playful furry road-trip energy, crisp illustration, premium poster quality.",
    `Current event theme: ${route.current.eventTheme || "energetic furry event"}.`,
    `Creative direction: ${copy.artDirection}`,
    "Keep the central information area and lower footer areas visually readable with controlled detail and darker values.",
    "Suggest route motion with subtle glowing trails or paw-inspired movement.",
    "No readable text, letters, numbers, logos, labels, watermarks, fake convention names, or fake signage.",
  ];

  if (brandConfig?.settings?.use_brand_assets_in_next_stop && brandConfig.primaryMascot) {
    lines.push(
      "The supplied Dusk art is the canonical mascot reference.",
      "If the app will composite official Dusk art afterward, avoid drawing a second giant mascot and keep the hero area compositionally supportive.",
    );
  }

  if (brandConfig?.logo) {
    lines.push("The application will add the official Dusk Induskries logo afterward; keep corner branding space uncluttered.");
  }

  return lines.join("\n");
}
