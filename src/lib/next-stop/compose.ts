import sharp from "sharp";
import { formatLocation } from "./format";
import type { NextStopCopy, RouteContext } from "./types";

const W = 1152;
const H = 2048;

const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
   .replaceAll('"', "&quot;").replaceAll("'", "&apos;");

const cut = (s: string, n: number) =>
  s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1)).trimEnd()}…`;

function wrap(s: string, n: number, max = 2) {
  const out: string[] = [];
  let line = "";
  for (const word of s.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= n) line = next;
    else {
      if (line) out.push(line);
      line = word;
      if (out.length >= max - 1) break;
    }
  }
  if (line && out.length < max) out.push(line);
  return out.slice(0, max);
}

function card(label: string, title: string, location: string, y: number, stroke: string) {
  const lines = wrap(title, 32, 2);
  return `
  <g>
    <rect x="100" y="${y}" width="952" height="174" rx="32"
      fill="rgba(7,16,27,.80)" stroke="${stroke}" stroke-width="3"/>
    <text x="140" y="${y + 38}" fill="${stroke}" font-size="21"
      font-family="Arial,Helvetica,sans-serif" font-weight="900" letter-spacing="2">${esc(label.toUpperCase())}</text>
    ${lines.map((line, i) => `<text x="140" y="${y + 88 + i * 42}" fill="#fff" font-size="39"
      font-family="Arial,Helvetica,sans-serif" font-weight="900">${esc(line)}</text>`).join("")}
    <text x="140" y="${y + 151}" fill="#b9c9dd" font-size="22"
      font-family="Arial,Helvetica,sans-serif" font-weight="700">${esc(cut(location, 64))}</text>
  </g>`;
}

export async function composeNextStopPoster(args: {
  background: Buffer;
  route: RouteContext;
  copy: NextStopCopy;
}) {
  const { route, copy } = args;
  const prev = route.previous.slice(-2)
    .map((e, i) => card(copy.pastLabel, e.title, formatLocation(e), 210 + i * 194, "#b58cff"))
    .join("");
  const next = route.next.slice(0, 2)
    .map((e, i) => card(copy.futureLabel, e.title, formatLocation(e), 1600 + i * 194, "#64ecff"))
    .join("");

  const titleLines = wrap(copy.currentEventTitle, 22, 2);
  const bullets = copy.findMeItems.slice(0, 4).map((item, i) => {
    const y = 1260 + i * 59;
    return `<circle cx="160" cy="${y - 9}" r="7" fill="#64ecff"/>
      <text x="188" y="${y}" fill="#f6f9ff" font-size="26"
        font-family="Arial,Helvetica,sans-serif" font-weight="700">${esc(cut(item, 58))}</text>`;
  }).join("");

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="rgba(5,10,20,.34)"/>
    <text x="576" y="78" text-anchor="middle" fill="#64ecff" font-size="24"
      font-family="Arial,Helvetica,sans-serif" font-weight="900" letter-spacing="5">DUSK INDUSKRIES</text>
    <text x="576" y="140" text-anchor="middle" fill="#fff" font-size="53"
      font-family="Arial,Helvetica,sans-serif" font-weight="900">${esc(copy.headline)}</text>
    <text x="576" y="177" text-anchor="middle" fill="#c7d4e6" font-size="21"
      font-family="Arial,Helvetica,sans-serif">${esc(cut(copy.subheadline, 90))}</text>
    ${prev}
    <rect x="70" y="720" width="1012" height="815" rx="52"
      fill="rgba(6,12,23,.83)" stroke="#ff5ca8" stroke-width="4"/>
    <text x="120" y="785" fill="#64ecff" font-size="25"
      font-family="Arial,Helvetica,sans-serif" font-weight="900" letter-spacing="3">${esc(copy.currentEventKicker.toUpperCase())}</text>
    ${titleLines.map((line, i) => `<text x="120" y="${890 + i*78}" fill="#fff"
      font-size="${titleLines.length > 1 ? 70 : 80}" font-family="Arial,Helvetica,sans-serif"
      font-weight="900">${esc(line)}</text>`).join("")}
    <text x="120" y="${titleLines.length > 1 ? 1066 : 1000}" fill="#ff87be" font-size="34"
      font-family="Arial,Helvetica,sans-serif" font-weight="900">${esc(copy.locationLine)}</text>
    <text x="120" y="${titleLines.length > 1 ? 1112 : 1046}" fill="#d8e4f2" font-size="27"
      font-family="Arial,Helvetica,sans-serif" font-weight="800">${esc(copy.dateLine)}</text>
    <text x="120" y="1194" fill="#64ecff" font-size="27"
      font-family="Arial,Helvetica,sans-serif" font-weight="900">${esc(copy.findMeTitle.toUpperCase())}</text>
    ${bullets}
    <text x="120" y="1510" fill="#becde1" font-size="21"
      font-family="Arial,Helvetica,sans-serif" font-style="italic">${esc(cut(copy.flavorText, 94))}</text>
    ${next}
    <text x="576" y="2020" text-anchor="middle" fill="#8ea4bf" font-size="19"
      font-family="Arial,Helvetica,sans-serif" font-weight="800">@duskdawolf • past paws → present chaos → future deployments</text>
  </svg>`;

  return sharp(args.background)
    .resize(W, H, { fit: "cover" })
    .composite([{ input: Buffer.from(svg) }])
    .webp({ quality: 92 })
    .toBuffer();
}
