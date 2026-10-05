import type { NextStopCopy, RouteContext } from "./types";
import type { BrandConfig } from "@/lib/alpha71/types";

export const NEXT_STOP_IMAGE_SIZE = "1152x2048";

export function buildBackgroundPrompt(
  route: RouteContext,
  copy: NextStopCopy,
  brandConfig?: BrandConfig | null,
) {
  const lines = [
    "Create a polished vertical 9:16 scenic background for a Dusk Induskries event-route poster.",
    "Visual mood: dusk sky, electric aqua, cobalt blue, violet and magenta, playful furry road-trip energy, crisp illustration.",
    `Current event theme: ${route.current.eventTheme || "energetic furry event"}.`,
    `Creative direction: ${copy.artDirection}`,
    "The center is the visual focal region.",
    "Suggest travel/deployment motion from top through center to bottom using subtle glowing trails or paw-inspired movement.",
    "Keep major text zones relatively low-detail so the application can add exact typography afterward.",
    "No readable text, letters, numbers, logos, labels, watermarks, fake convention names, or fake signage.",
  ];

  if (
    brandConfig?.settings?.use_brand_assets_in_next_stop &&
    brandConfig.primaryMascot
  ) {
    lines.push(
      "The supplied canonical Dusk artwork is the authoritative character/style reference.",
      "The final application also preserves official artwork directly, so composition should support that brand asset cleanly.",
    );
  }

  if (brandConfig?.logo) {
    lines.push(
      "The application will add the official Dusk Induskries logo afterward; leave branding space uncluttered.",
    );
  }

  return lines.join("\n");
}
