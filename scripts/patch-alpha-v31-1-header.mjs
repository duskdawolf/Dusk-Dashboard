import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const file = path.join(root, "src/components/Header.tsx");

function fail(message) {
  console.error(`\nAlpha v31.1 header patch failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(file)) {
  fail(`Header.tsx was not found at ${file}`);
}

let text = fs.readFileSync(file, "utf8");
const original = text;

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
const importStatement =
  'import { DeploymentsNav } from "@/components/DeploymentsNav";';

if (!text.includes(importStatement)) {
  const imports = [...text.matchAll(/^import[\s\S]*?;$/gm)];

  if (imports.length) {
    const last = imports[imports.length - 1];
    const insertAt = (last.index ?? 0) + last[0].length;
    text =
      text.slice(0, insertAt) +
      `\n${importStatement}` +
      text.slice(insertAt);
  } else {
    text = `${importStatement}\n${text}`;
  }
}

// ---------------------------------------------------------------------------
// Remove old Chaos navigation entry when recognizable.
//
// Supports:
//   { href: "/chaos", label: "Chaos" },
//   { label: "Chaos", href: "/chaos" },
//   direct <Link href="/chaos">Chaos</Link>
//   multiline JSX Links
// ---------------------------------------------------------------------------

// Array/object forms.
text = text.replace(
  /\s*\{\s*href\s*:\s*["']\/chaos["']\s*,\s*label\s*:\s*["']Chaos["']\s*,?\s*\}\s*,?/g,
  "",
);

text = text.replace(
  /\s*\{\s*label\s*:\s*["']Chaos["']\s*,\s*href\s*:\s*["']\/chaos["']\s*,?\s*\}\s*,?/g,
  "",
);

// More flexible object form where other simple properties may exist.
text = text.replace(
  /\s*\{(?=[^{}]*href\s*:\s*["']\/chaos["'])(?=[^{}]*label\s*:\s*["']Chaos["'])[^{}]*\}\s*,?/g,
  "",
);

// Direct Link JSX.
text = text.replace(
  /\s*<Link\b(?=[^>]*\bhref\s*=\s*["']\/chaos["'])[^>]*>\s*Chaos\s*<\/Link>\s*/gs,
  "\n",
);

// href={"/chaos"} variant.
text = text.replace(
  /\s*<Link\b(?=[^>]*\bhref\s*=\s*\{\s*["']\/chaos["']\s*\})[^>]*>\s*Chaos\s*<\/Link>\s*/gs,
  "\n",
);

// ---------------------------------------------------------------------------
// Insert DeploymentsNav into the primary nav.
//
// We do NOT depend on exact Tailwind classes or links.map formatting.
// Find the first opening <nav ...> and inject immediately after it.
// ---------------------------------------------------------------------------
if (!text.includes("<DeploymentsNav />")) {
  const navMatch = text.match(/<nav\b[^>]*>/s);

  if (navMatch && navMatch.index !== undefined) {
    const insertAt = navMatch.index + navMatch[0].length;

    text =
      text.slice(0, insertAt) +
      "\n          <DeploymentsNav />" +
      text.slice(insertAt);
  } else {
    // Fallback: insert before the first dashboard/home-account style Link in
    // the header rather than failing the entire v31.1 install.
    const dashboardMatch = text.match(
      /<Link\b[^>]*href\s*=\s*["']\/dashboard["'][^>]*>/s,
    );

    if (dashboardMatch && dashboardMatch.index !== undefined) {
      text =
        text.slice(0, dashboardMatch.index) +
        '<div className="hidden md:block"><DeploymentsNav /></div>\n        ' +
        text.slice(dashboardMatch.index);
    } else {
      fail(
        "Could not find a <nav> element or /dashboard link in Header.tsx. " +
          "No source was overwritten.",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Sanity checks
// ---------------------------------------------------------------------------
if (!text.includes("DeploymentsNav")) {
  fail("DeploymentsNav was not added.");
}

if (text === original) {
  console.log("Header already appears to be patched for Alpha v31.1.");
  process.exit(0);
}

fs.writeFileSync(file, text);

console.log("Header patched for Alpha v31.1.");
console.log("  Added Deployments → Future / Past");
console.log("  Removed legacy Chaos nav item when recognized");
