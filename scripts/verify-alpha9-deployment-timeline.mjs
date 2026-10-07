import fs from "node:fs";

const required = [
  "src/lib/alpha9/sub-events.ts",
  "src/app/api/alpha9/con-preps/[id]/sub-events/route.ts",
  "src/app/api/alpha9/deployments/discover/route.ts",
  "src/app/api/integrations/make/sub-event-reminder-sweep/route.ts",
  "src/components/alpha9/Alpha9SubEventsCard.tsx",
  "src/components/alpha8/Alpha8AddDeploymentSheet.tsx",
  "src/components/alpha8/Alpha8WorkspaceEditor.tsx",
  "src/components/alpha8/Alpha8ConventionWorkspace.tsx",
  "src/lib/next-stop/copy.ts",
  "src/lib/next-stop/prompt.ts",
  "src/lib/next-stop/compose.tsx",
  "src/app/api/events/[id]/next-stop/download/route.ts",
  "supabase/V26_ALPHA9_DEPLOYMENT_TIMELINE_RUN_THIS.sql",
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

const workspace = fs.readFileSync(
  "src/components/alpha8/Alpha8ConventionWorkspace.tsx",
  "utf8",
);

for (const needle of [
  "Where to Find Dusk",
  "Alpha31WhereToFindDuskCard",
  "Alpha9SubEventsCard",
  "Fullsuiting",
]) {
  if (!workspace.includes(needle)) {
    console.error(`Workspace missing: ${needle}`);
    failed = true;
  }
}

const prompt = fs.readFileSync("src/lib/next-stop/prompt.ts", "utf8");

for (const needle of [
  "furry",
  "convention",
  "Snapchat",
  "Instagram Story",
  "centered",
]) {
  if (!prompt.toLowerCase().includes(needle.toLowerCase())) {
    console.error(`Next Stop prompt missing: ${needle}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("\nAlpha 9 Deployment Timeline files are present.");
