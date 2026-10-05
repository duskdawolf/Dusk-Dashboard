import type { NextStopCopy, RouteContext } from './types';

export const NEXT_STOP_IMAGE_SIZE = '1152x2048';

export function buildBackgroundPrompt(route: RouteContext, copy: NextStopCopy) {
  const theme = route.current.eventTheme?.trim() || 'energetic furry convention road-trip';
  return [
    'Create a polished vertical 9:16 background artwork for a mobile event poster.',
    'Brand mood: Dusk Induskries — neon dusk sky, electric aqua, cobalt blue, violet, magenta, slightly chaotic but polished furry road-trip energy.',
    `Current event mood/theme: ${theme}.`,
    `Creative direction: ${copy.artDirection}`,
    'Composition requirements:',
    '- Keep the center visually strongest for the current stop.',
    '- Leave useful dark/low-detail negative-space bands near the top, upper-middle, center-lower, and bottom so exact text cards can be overlaid by the app.',
    '- Suggest a winding travel/deployment path from top to center to bottom using abstract glowing tracks, dotted lines, or paw-inspired shapes.',
    '- Include a charismatic blue-and-black wolf-mascot energy if appropriate, but do not imitate any copyrighted character or official convention logo.',
    '- High contrast and vivid lighting, optimized for a phone screen.',
    '- No text. No letters. No numbers. No logos. No watermarks. No readable signage.',
    '- Do not draw fake event names; all typography will be rendered by the application.',
  ].join('\n');
}
