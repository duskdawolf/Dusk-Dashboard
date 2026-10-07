import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const src = path.join(root, "src");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && /\.(tsx|ts)$/.test(entry.name) ? [full] : [];
  });
}

function ensureImport(text, statement) {
  if (text.includes(statement)) return text;
  const importLines = [...text.matchAll(/^import .*;$/gm)];
  if (!importLines.length) return `${statement}\n${text}`;
  const last = importLines[importLines.length - 1];
  const at = (last.index ?? 0) + last[0].length;
  return `${text.slice(0, at)}\n${statement}${text.slice(at)}`;
}

const files = walk(src);

// ---------------------------------------------------------------------------
// Footer: convert the existing version text to APP_VERSION when possible.
// ---------------------------------------------------------------------------
let footerPatched = false;

for (const file of files) {
  let text = fs.readFileSync(file, "utf8");
  if (!text.includes("Copyright 2026 Dusk Induskries")) continue;

  const original = text;

  // Common JSX footer shape: >v26.0 Alpha 5<
  text = text.replace(
    />(?:v\d+(?:\.\d+){0,2}(?:\s+Alpha(?:\s+\d+(?:\.\d+)?)?)?|Alpha\s+v\d+(?:\.\d+)?)</g,
    ">{APP_VERSION}<",
  );

  // Text-node fallback after the copyright phrase.
  if (text === original) {
    text = text.replace(
      /(Copyright 2026 Dusk Induskries\.[\s\S]{0,400}?)(?:v\d+(?:\.\d+){0,2}(?:\s+Alpha(?:\s+\d+(?:\.\d+)?)?)?|Alpha\s+v\d+(?:\.\d+)?)/,
      "$1{APP_VERSION}",
    );
  }

  if (text !== original) {
    text = ensureImport(
      text,
      'import { APP_VERSION } from "@/lib/app-version";',
    );
    fs.writeFileSync(file, text);
    console.log("centralized footer version in", path.relative(root, file));
    footerPatched = true;
    break;
  }
}

// If the old project somehow has no global footer, install the canonical one.
if (!footerPatched) {
  const layoutPath = path.join(root, "src/app/layout.tsx");

  if (!fs.existsSync(layoutPath)) {
    console.error("Could not locate src/app/layout.tsx for the v30 footer.");
    process.exit(1);
  }

  let layout = fs.readFileSync(layoutPath, "utf8");

  if (!layout.includes("AppVersionFooter")) {
    layout = ensureImport(
      layout,
      'import { AppVersionFooter } from "@/components/AppVersionFooter";',
    );

    if (!layout.includes("</body>")) {
      console.error("Could not safely insert AppVersionFooter before </body>.");
      process.exit(1);
    }

    layout = layout.replace(
      "</body>",
      "        <AppVersionFooter />\n      </body>",
    );

    fs.writeFileSync(layoutPath, layout);
    console.log("added canonical Alpha v30 footer");
  }
}

// ---------------------------------------------------------------------------
// Obvious visible old release labels. These are decorative UI labels only.
// ---------------------------------------------------------------------------
for (const file of files) {
  let text = fs.readFileSync(file, "utf8");
  const original = text;

  text = text
    .replace(/v26 Alpha 8(?:\.1)? · Convention Ops/g, "Alpha v30 · Convention Ops")
    .replace(/v26 Alpha 7\.1/g, "Alpha v30")
    .replace(/v26 Alpha 7\.2/g, "Alpha v30");

  if (text !== original) {
    fs.writeFileSync(file, text);
    console.log("updated visible release label in", path.relative(root, file));
  }
}
