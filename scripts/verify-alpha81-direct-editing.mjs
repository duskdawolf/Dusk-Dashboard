import fs from "node:fs";

const required = [
  "src/lib/alpha8/workspace-records.ts",
  "src/app/api/alpha8/con-preps/[id]/records/route.ts",
  "src/app/api/alpha8/deployments/route.ts",
  "src/app/api/alpha7/chaos/analyze/route.ts",
  "src/app/api/alpha7/chaos/actions/route.ts",
  "src/lib/alpha7/record-actions.ts",
  "src/components/alpha8/Alpha8WorkspaceEditor.tsx",
  "src/components/alpha8/Alpha8AddDeploymentSheet.tsx",
  "src/components/alpha8/Alpha8ConventionWorkspace.tsx",
  "src/components/alpha8/DisclosureCard.tsx",
  "src/app/dashboard/con-prep/layout.tsx",
  "supabase/V26_ALPHA81_DIRECT_EDITING_RUN_THIS.sql",
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
  "+ Add Deployment",
  "+ Add Item",
  "+ Add Task",
  "+ Add Budget Item",
  "Edit Event",
]) {
  if (!workspace.includes(needle)) {
    console.error(`Workspace missing control: ${needle}`);
    failed = true;
  }
}

const records = fs.readFileSync(
  "src/lib/alpha8/workspace-records.ts",
  "utf8",
);

for (const resource of [
  "packing",
  "task",
  "hotel",
  "travel",
  "registration",
  "cost",
  "prep",
  "event",
]) {
  if (!records.includes(`"${resource}"`)) {
    console.error(`CRUD resource missing: ${resource}`);
    failed = true;
  }
}

const layout = fs.readFileSync(
  "src/app/dashboard/con-prep/layout.tsx",
  "utf8",
);

if (layout.includes("Advanced / Legacy workspace")) {
  console.error("Legacy workspace is still rendered.");
  failed = true;
}

if (failed) process.exit(1);
console.log("\nAlpha 8.1 direct-editing files are present.");
