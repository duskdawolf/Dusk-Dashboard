import type { NextStopCopy, RouteContext } from './types';
import type { BrandConfig } from '@/lib/alpha71/types';

export const NEXT_STOP_IMAGE_SIZE = '1152x2048';

export function buildBackgroundPrompt(route: RouteContext, copy: NextStopCopy, brandConfig?: BrandConfig | null) {
  const lines = [
    'Create a polished vertical 9:16 background artwork for Dusk Induskries.',
    'Mood: neon dusk sky, electric aqua, cobalt blue, violet and magenta; playful furry road-trip / deployment poster.',
    `Current event theme: ${route.current.eventTheme || 'energetic furry event'}.`,
    `Art direction: ${copy.artDirection}`,
    'The center must be the visual focal point.',
    'Suggest a top-to-center-to-bottom route with glowing trails or paw-inspired marks.',
    'Leave low-detail / dark negative-space areas for typography overlays.',
    'No readable text, no letters, no numbers, no logos, no watermark.',
  ];

  if (brandConfig?.settings?.use_brand_assets_in_next_stop) {
    lines.push('A cheerful wolf mascot presence is appropriate; make space for a mascot overlay and avoid cluttering the hero area.');
    if (brandConfig.primaryMascot) {
      lines.push(`Brand anchor note: the final poster will include official Dusk mascot art labeled "${brandConfig.primaryMascot.label}". Keep the background composition harmonious with that mascot presence.`);
    }
    if (brandConfig.logo) {
      lines.push(`Brand anchor note: the final poster may include the official Dusk Induskries logo labeled "${brandConfig.logo.label}".`);
    }
  }

  return lines.join('\n');
}
