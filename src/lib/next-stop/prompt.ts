import type { BrandConfig } from "@/lib/alpha71/types";
import type { NextStopCopy, RouteContext } from "./types";

export const NEXT_STOP_IMAGE_SIZE = "1152x2048";

export function buildBackgroundPrompt(
  route: RouteContext,
  copy: NextStopCopy,
  brandConfig?: BrandConfig | null,
) {
  const lines = [
    "Create a premium vertical 9:16 scenic background for a Dusk Induskries event-route poster.",
    "Visual mood: dusk sky, electric aqua, cobalt blue, violet and magenta; playful furry road-trip energy; crisp polished illustration rather than generic neon wallpaper.",
    `Current event theme: ${route.current.eventTheme || "energetic furry event"}.`,
    `Creative direction: ${copy.artDirection}`,
    "COMPOSITION: Keep the visual axis centered. The application will place three major information groups (past stops, current stop, future stops) as centered cards on the same vertical centerline. Preserve a broad centered low-detail corridor through the middle 70–80% of the canvas so these cards feel intentional rather than pasted over busy art.",
    "Keep the strongest scenery, mascot-adjacent accents, motion trails, and paw-route decoration near the outer edges and corners. Do not place a focal face, bright moon, logo-like object, or high-detail landmark directly behind the centered information cards.",
    "Use subtle paw-route movement from upper edge → centered middle → lower edge, but keep it subordinate to the information corridor.",
    "TYPOGRAPHY / BRAND LANGUAGE: When the supplied reference art or logo contains distinctive lettering, use its visual language as inspiration for any NON-READABLE decorative typographic shapes in the artwork: similar weight, geometry, roundness/angularity, stroke energy, and spacing where practical. Do not invent readable words. The exact official logo and all real poster text are added later by the application.",
    "No readable text, letters, numbers, fake convention names, labels, watermarks, fake logos, or fake signage in the generated background.",
  ];

  if (brandConfig?.settings?.use_brand_assets_in_next_stop && brandConfig.primaryMascot) {
    lines.push(
      "The supplied Dusk artwork is the canonical visual reference for Dusk: preserve its design language, palette, proportions, markings, and illustration style.",
      brandConfig.settings?.composite_mascot
        ? "The application will composite the exact official Dusk art afterward. Do not draw a second giant full-body Dusk. Design the scenery to frame the official mascot overlay and centered cards cleanly."
        : "If Dusk appears in the generated artwork, preserve the reference identity closely.",
    );
  }

  if (brandConfig?.logo) {
    lines.push(
      `The supplied logo (${brandConfig.logo.label}) is the canonical Dusk Induskries typography/branding reference. Match its overall graphic energy and typographic character where possible without reproducing fake readable text.`,
      "Leave the configured logo corner visually quiet because the exact logo is composited afterward.",
    );
  }

  return lines.join("\n");
}
