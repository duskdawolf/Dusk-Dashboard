import assert from "node:assert/strict";
import { APP_VERSION_NUMBER } from "../src/lib/app-version.ts";
assert.ok(
  APP_VERSION_NUMBER >= 31.1,
  "This historical feature check requires Alpha v31.1 or later",
);
import fs from "node:fs";

const required = [
  "src/lib/app-version.ts",
  "src/components/DeploymentsNav.tsx",
  "src/components/DeploymentArchiveCard.tsx",
  "src/components/DeploymentArchivePage.tsx",
  "src/components/DeploymentFilterLink.tsx",
  "src/lib/deployment-archive.ts",
  "src/app/deployments/page.tsx",
  "src/app/deployments/future/page.tsx",
  "src/app/deployments/past/page.tsx",
  "src/app/deployments/[slug]/page.tsx",
  "src/app/chaos/page.tsx",
  "src/app/chaos/[slug]/page.tsx",
  "src/components/alpha8/Alpha8ConventionWorkspace.tsx",
  "src/components/alpha8/Alpha8WorkspaceEditor.tsx",
  "src/lib/alpha8/workspace-records.ts",
  "src/lib/alpha7/record-actions.ts",
  "supabase/ALPHA_V31_1_SECURITY_HOTFIX_RUN_THIS.sql",
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
    "src/components/DeploymentsNav.tsx",
    "/deployments/future",
    "Future deployment nav",
  );

  check(
    "src/components/DeploymentsNav.tsx",
    "/deployments/past",
    "Past deployment nav",
  );

  check(
    "src/app/deployments/[slug]/page.tsx",
    "Tactical Deployment Plan",
    "future tactical plan rendering",
  );

  check(
    "src/app/deployments/[slug]/page.tsx",
    "Case Study",
    "past case study rendering",
  );

  const editor = fs.readFileSync(
    "src/components/alpha8/Alpha8WorkspaceEditor.tsx",
    "utf8",
  );

  if (editor.includes("Readiness summary")) {
    console.error("Readiness summary textbox still exists");
    failed = true;
  } else {
    console.log("OK      no Readiness summary textbox");
  }

  const workspace = fs.readFileSync(
    "src/components/alpha8/Alpha8ConventionWorkspace.tsx",
    "utf8",
  );

  if (workspace.includes(">Automatic Readiness<")) {
    console.error("Duplicate Automatic Readiness breakdown still exists");
    failed = true;
  } else {
    console.log("OK      duplicate readiness breakdown removed");
  }

  const security = fs.readFileSync(
    "supabase/ALPHA_V31_1_SECURITY_HOTFIX_RUN_THIS.sql",
    "utf8",
  );

  for (const needle of [
    "revoke execute on function public.dusk_alpha31_lifecycle_sweep()",
    "set search_path = public",
    "to service_role",
  ]) {
    if (!security.includes(needle)) {
      console.error("Security hotfix missing:", needle);
      failed = true;
    } else {
      console.log("OK     security:", needle);
    }
  }
}

if (failed) process.exit(1);

console.log("\nAlpha v31.1 files are present.");
