import fs from "node:fs";

const required = [
  "src/app/dashboard/con-prep/layout.tsx",
  "src/app/dashboard/settings/brand/page.tsx",
  "src/app/api/alpha8/con-preps/[id]/summary/route.ts",
  "src/components/alpha8/Alpha8ConventionWorkspace.tsx",
  "src/components/alpha8/Alpha8ChaosCard.tsx",
  "src/components/alpha8/Alpha8NextStopCard.tsx",
  "src/components/alpha8/DisclosureCard.tsx",
  "src/lib/next-stop/prompt.ts",
  "src/lib/next-stop/compose.tsx",
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

if (failed) process.exit(1);
console.log("\nAlpha 8 Convention Workspace files are present.");
