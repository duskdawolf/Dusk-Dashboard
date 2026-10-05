import fs from "node:fs";

const required = [
  "src/app/dashboard/con-prep/layout.tsx",
  "src/components/alpha7/Alpha7ConventionOpsDock.tsx",
  "src/app/api/alpha7/chaos/analyze/route.ts",
  "src/app/api/alpha7/chaos/actions/route.ts",
  "src/app/api/alpha7/chaos/actions/[id]/apply/route.ts",
  "src/app/api/events/[id]/next-stop/route.ts",
  "src/components/next-stop/NextStopGeneratorCard.tsx",
  "src/lib/alpha7/record-actions.ts",
  "src/lib/next-stop/generate.ts",
  "supabase/V26_ALPHA7_COMPLETE_RUN_THIS.sql",
];

let fail = false;
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error("MISSING", file);
    fail = true;
  } else {
    console.log("OK     ", file);
  }
}

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (!pkg.dependencies?.sharp && !pkg.devDependencies?.sharp) {
  console.error("MISSING dependency: sharp (run npm install sharp)");
  fail = true;
} else {
  console.log("OK      sharp dependency");
}

if (fail) process.exit(1);
console.log("\nAlpha 7 complete feature files are present.");
