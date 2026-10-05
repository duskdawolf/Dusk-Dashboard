import sharp from 'sharp';
import type { NextStopCopy, RouteContext } from './types';
import { formatLocation } from './format';

const WIDTH = 1152;
const HEIGHT = 2048;

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

function wrapWords(value: string, maxChars: number, maxLines = 2) {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length >= maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.join(' ').length > lines.join(' ').length && lines.length) {
    lines[lines.length - 1] = truncate(lines[lines.length - 1], maxChars);
  }
  return lines.slice(0, maxLines);
}

function textLines(lines: string[], x: number, y: number, fontSize: number, lineHeight: number, attrs = '') {
  return lines.map((line, index) =>
    `<text x="${x}" y="${y + index * lineHeight}" ${attrs} font-size="${fontSize}">${escapeXml(line)}</text>`
  ).join('\n');
}

function paw(x: number, y: number, scale = 1, opacity = 0.72) {
  return `
    <g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}">
      <ellipse cx="0" cy="10" rx="18" ry="14" fill="#64ecff"/>
      <ellipse cx="-17" cy="-9" rx="7" ry="10" fill="#64ecff"/>
      <ellipse cx="-6" cy="-17" rx="7" ry="10" fill="#64ecff"/>
      <ellipse cx="7" cy="-17" rx="7" ry="10" fill="#64ecff"/>
      <ellipse cx="18" cy="-9" rx="7" ry="10" fill="#64ecff"/>
    </g>`;
}

function routeCard(label: string, title: string, location: string, y: number, accent: string) {
  const titleLines = wrapWords(title, 34, 2);
  return `
    <g>
      <rect x="100" y="${y}" width="952" height="180" rx="34"
        fill="rgba(7,16,27,.78)" stroke="${accent}" stroke-width="3"/>
      <text x="140" y="${y + 42}" fill="${accent}" font-size="22"
        font-family="Arial, Helvetica, sans-serif" font-weight="800"
        letter-spacing="2">${escapeXml(label.toUpperCase())}</text>
      ${textLines(titleLines, 140, y + 94, 42, 46,
        'fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-weight="900"')}
      <text x="140" y="${y + 154}" fill="#b9c9dd" font-size="23"
        font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(truncate(location, 62))}</text>
    </g>`;
}

export async function composeNextStopPoster(input: {
  background: Buffer;
  route: RouteContext;
  copy: NextStopCopy;
}) {
  const { background, route, copy } = input;
  const previous = route.previous.slice(-2);
  const next = route.next.slice(0, 2);

  const previousCards = previous.map((event, index) =>
    routeCard(copy.pastLabel, event.title, formatLocation(event), 210 + index * 200, '#b58cff')
  ).join('\n');

  const nextCards = next.map((event, index) =>
    routeCard(copy.futureLabel, event.title, formatLocation(event), 1602 + index * 200, '#64ecff')
  ).join('\n');

  const currentTitle = wrapWords(copy.currentEventTitle, 22, 2);
  const findRows = copy.findMeItems.slice(0, 4).map((item, index) => {
    const y = 1272 + index * 62;
    return `
      <circle cx="166" cy="${y - 8}" r="8" fill="#64ecff"/>
      <text x="192" y="${y}" fill="#f6f9ff" font-size="27"
        font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(truncate(item, 58))}</text>`;
  }).join('\n');

  const paws = [
    paw(575, 595, 0.72, 0.58),
    paw(555, 668, 0.58, 0.48),
    paw(595, 1488, 0.62, 0.58),
    paw(565, 1552, 0.52, 0.48),
  ].join('\n');

  const currentLocationY = currentTitle.length > 1 ? 1080 : 1020;
  const currentDateY = currentTitle.length > 1 ? 1128 : 1068;

  const svg = `
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"
    xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#07101b" stop-opacity=".22"/>
        <stop offset=".45" stop-color="#07101b" stop-opacity=".42"/>
        <stop offset="1" stop-color="#07101b" stop-opacity=".56"/>
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="7" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#shade)"/>

    <text x="576" y="88" text-anchor="middle" fill="#64ecff" font-size="26"
      font-family="Arial, Helvetica, sans-serif" font-weight="900"
      letter-spacing="5">DUSK INDUSKRIES</text>
    <text x="576" y="148" text-anchor="middle" fill="#ffffff" font-size="54"
      font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeXml(copy.headline)}</text>
    <text x="576" y="184" text-anchor="middle" fill="#c7d4e6" font-size="22"
      font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(truncate(copy.subheadline, 88))}</text>

    ${previousCards}
    ${paws}

    <g filter="url(#glow)">
      <rect x="70" y="720" width="1012" height="820" rx="54"
        fill="rgba(6,12,23,.82)" stroke="#ff5ca8" stroke-width="4"/>
    </g>

    <text x="120" y="785" fill="#64ecff" font-size="26"
      font-family="Arial, Helvetica, sans-serif" font-weight="900"
      letter-spacing="3">${escapeXml(copy.currentEventKicker.toUpperCase())}</text>

    ${textLines(currentTitle, 120, 895, currentTitle.length > 1 ? 72 : 82, 82,
      'fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-weight="900"')}

    <text x="120" y="${currentLocationY}" fill="#ff87be"
      font-size="34" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeXml(copy.locationLine)}</text>
    <text x="120" y="${currentDateY}" fill="#d8e4f2"
      font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeXml(copy.dateLine)}</text>

    <text x="120" y="1200" fill="#64ecff" font-size="28"
      font-family="Arial, Helvetica, sans-serif" font-weight="900"
      letter-spacing="2">${escapeXml(copy.findMeTitle.toUpperCase())}</text>

    ${findRows}

    <text x="120" y="1510" fill="#becde1" font-size="22"
      font-family="Arial, Helvetica, sans-serif" font-style="italic"
      font-weight="700">${escapeXml(truncate(copy.flavorText, 92))}</text>

    ${nextCards}

    <text x="576" y="2022" text-anchor="middle" fill="#8ea4bf" font-size="20"
      font-family="Arial, Helvetica, sans-serif" font-weight="800">@duskdawolf • past paws → present chaos → future deployments</text>
  </svg>`;

  return sharp(background)
    .resize(WIDTH, HEIGHT, { fit: 'cover' })
    .composite([{ input: Buffer.from(svg) }])
    .webp({ quality: 92 })
    .toBuffer();
}
