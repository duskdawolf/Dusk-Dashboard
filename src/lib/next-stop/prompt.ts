import type { BrandConfig } from "@/lib/alpha71/types";
import { posterTextAsPromptBlock } from "./poster-content";
import type {
  NextStopCopy,
  NextStopPosterText,
  RouteContext,
} from "./types";

export const NEXT_STOP_IMAGE_SIZE = "1152x2048";

function selectedReferenceDescription(brandConfig?: BrandConfig | null) {
  const refs = [
    brandConfig?.primaryMascot
      ? `Reference 1 — PRIMARY DUSK ART: ${brandConfig.primaryMascot.label}`
      : null,
    brandConfig?.secondaryMascot
      ? `Reference 2 — SECONDARY DUSK ART / STYLE: ${brandConfig.secondaryMascot.label}`
      : null,
    brandConfig?.logo
      ? `Reference 3 — DUSK INDUSKRIES LOGO / TYPOGRAPHY: ${brandConfig.logo.label}`
      : null,
  ].filter(Boolean);

  return refs.length
    ? [
        "REFERENCE IMAGES:",
        ...refs,
        "Use every supplied reference image for its intended role. Preserve Dusk's recognizable design and use the logo reference to understand the brand's typography/letterform energy.",
      ]
    : [];
}

export function buildBackgroundPrompt(
  route: RouteContext,
  copy: NextStopCopy,
  brandConfig?: BrandConfig | null,
) {
  return [
    "DRAW a premium reusable 9:16 background for a social Story poster.",
    "",
    "PURPOSE:",
    "Dusk is a furry announcing that they will be attending a furry convention / furry event. This background will later be edited into a finished promotional poster for X, Snapchat, and Instagram Story.",
    "",
    "IMPORTANT:",
    "This request creates BACKGROUND ART ONLY. Do not render readable event copy, schedules, labels, dates, handles, fake logos, or information boxes. A later OpenAI image-edit request will use this saved background to design the complete poster and typography.",
    "",
    `Current event: ${route.current.title}.`,
    `Location context: ${route.current.location || route.current.stateCode || "location not specified"}.`,
    `Event theme: ${route.current.eventTheme || "energetic furry convention / event"}.`,
    `Creative direction: ${copy.artDirection}`,
    "",
    "VISUAL DIRECTION:",
    "Vertical 9:16 social-story composition. Dusk-sky atmosphere, electric aqua, cobalt blue, violet, magenta, polished furry-event energy. Make it feel like a purpose-built convention announcement background, not generic neon wallpaper.",
    "Keep a strong clean visual hierarchy and enough calm areas for later typography. Center-weight the composition but allow visual interest around the edges. Pawprint-route motifs may travel from the prior-events area toward the current stop and future-events area, but keep them decorative and subordinate.",
    "Do not draw fake cards or fake readable text. Do not invent convention signage.",
    "",
    ...selectedReferenceDescription(brandConfig),
  ].join("\n");
}

export function buildFinalPosterPrompt(args: {
  route: RouteContext;
  copy: NextStopCopy;
  text: NextStopPosterText;
  correction?: string | null;
}) {
  const exactBlock = posterTextAsPromptBlock(args.text);

  const wordingRule =
    args.text.mode === "strict"
      ? [
          "WORDING MODE: STRICT.",
          "Render the supplied visible wording EXACTLY. Do not paraphrase, abbreviate, rename, omit, reorder, add, or invent visible words.",
          "You may choose line breaks, line wrapping, font size, weight, alignment, spacing, and placement, but the visible characters/words themselves must remain unchanged.",
        ]
      : [
          "WORDING MODE: CREATIVE.",
          "You MAY rewrite, shorten, abbreviate, reorganize, or restyle the supplied copy when that improves the poster.",
          "However, preserve every underlying fact exactly: event names, dates, times, locations, roles, suiting status, schedule details, route stops, and @duskdawolf. Do not invent any new factual claim.",
        ];

  return [
    "EDIT the supplied image into the COMPLETE FINISHED PROMOTIONAL POSTER.",
    "",
    "PURPOSE:",
    `This is a social Story graphic for Dusk, a furry, promoting that Dusk will be at ${args.route.current.title}, a furry convention / furry event.`,
    "It is intended to be posted directly to X, Snapchat, and Instagram Story so other furries can quickly understand where Dusk is going and how to find Dusk there.",
    "",
    "SOURCE IMAGE:",
    "The supplied image is the already-approved/saved Next Stop background. Treat it as the visual foundation. Do NOT replace it with unrelated artwork. You may intelligently darken, blur, mask, extend, vignette, add panels, or locally simplify parts of it when needed for readability.",
    "This saved background is the ONLY image reference for this final-poster request. Do not assume access to earlier mascot/logo reference files.",
    "",
    "DESIGN THE FINISHED POSTER YOURSELF — BUT KEEP IT SIMPLE:",
    "The supplied background is already the finished artwork. Preserve as much of it unchanged as possible.",
    "DO NOT generate substantial new character art, mascot art, scenery, landmarks, pawprint illustrations, decorative scenes, or a second background. Do not redraw Dusk.",
    "Your job in this pass is graphic design, not illustration.",
    "Add only what is necessary to communicate the supplied copy cleanly: typography, simple information boxes/panels, borders, pills, dividers, subtle shadows, restrained gradients, masks, or local blur/darkening for readability.",
    "Avoid decorative clutter. Avoid adding art merely to fill space. Prefer fewer, simpler shapes and strong typography.",
    "Do not imitate the old application-rendered cards; design a cohesive but restrained professional layout directly over the existing artwork.",
    "Prefer a clean centered hierarchy suitable for a phone screen. Keep the major information groups centered or optically centered unless the background clearly demands a slight adjustment.",
    "Make the current event the dominant focal information. Past stops and next stops are route context. 'How to Find Dusk' must be easy to scan.",
    "Match the typographic/graphic language already present in the supplied background when practical.",
    "",
    ...wordingRule,
    "",
    "APP-PROVIDED POSTER COPY:",
    "----- BEGIN COPY -----",
    exactBlock,
    "----- END COPY -----",
    "",
    "FACT LEDGER — THESE FACTS MAY NEVER CHANGE:",
    ...args.text.factLedger.map((fact) => `- ${fact}`),
    "",
    "OUTPUT:",
    "Return one finished 9:16 poster. Do not add watermarks, signatures, disclaimers, QR codes, extra handles, fake sponsors, or invented text.",
    args.correction
      ? [
          "",
          "CORRECTION PASS:",
          "The previous render failed validation. Correct these issues while keeping the saved background as the design foundation:",
          args.correction,
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
