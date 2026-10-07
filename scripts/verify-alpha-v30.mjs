import assert from "node:assert/strict";
import { APP_VERSION_NUMBER } from "../src/lib/app-version.ts";
assert.ok(
  APP_VERSION_NUMBER >= 30,
  "This historical feature check requires Alpha v30 or later",
);
import fs from "node:fs";

const required = [
  "src/lib/app-version.ts",
  "src/components/AppVersionFooter.tsx",
  "src/lib/next-stop/types.ts",
  "src/lib/next-stop/hash.ts",
  "src/lib/next-stop/openai.ts",
  "src/lib/next-stop/poster-content.ts",
  "src/lib/next-stop/prompt.ts",
  "src/lib/next-stop/validate.ts",
  "src/lib/next-stop/generate.ts",
  "src/lib/next-stop/state.ts",
  "src/lib/next-stop/persist.ts",
  "src/app/api/events/[id]/next-stop/route.ts",
  "src/components/alpha8/Alpha8NextStopCard.tsx",
  "supabase/ALPHA_V30_NEXT_STOP_AI_RENDER_RUN_THIS.sql",
];

let failed = false;

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error("MISSING", file);
    failed = true;
  } else {
    console.log("OK     ", file);
  }
}

function check(file, needle, label) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(needle)) {
    console.error("MISSING", label);
    failed = true;
  } else {
    console.log("OK     ", label);
  }
}

if (!failed) {
  check(
    "src/lib/next-stop/generate.ts",
    "brandConfig.secondaryMascot",
    "secondary brand reference",
  );

  check("src/lib/next-stop/generate.ts", "brandConfig.logo", "logo reference");

  check(
    "src/lib/next-stop/generate.ts",
    "image: files",
    "multiple reference images sent for background",
  );

  check(
    "src/lib/next-stop/generate.ts",
    "image: backgroundFile",
    "saved background is sole final-poster image input",
  );

  check(
    "src/lib/next-stop/prompt.ts",
    "WORDING MODE: STRICT",
    "strict wording mode",
  );

  check(
    "src/lib/next-stop/prompt.ts",
    "WORDING MODE: CREATIVE",
    "creative wording mode",
  );

  check(
    "src/lib/next-stop/validate.ts",
    "REQUIRED VISIBLE LINES",
    "strict text validation",
  );

  check(
    "src/components/alpha8/Alpha8NextStopCard.tsx",
    "Let AI change wording?",
    "wording toggle UI",
  );

  check(
    "src/components/alpha8/Alpha8NextStopCard.tsx",
    "Saved Background",
    "saved background preview",
  );

  check(
    "src/components/alpha8/Alpha8NextStopCard.tsx",
    "Final Poster",
    "final poster preview",
  );
}

if (failed) process.exit(1);

console.log("\nAlpha v30 Next Stop files are present.");
