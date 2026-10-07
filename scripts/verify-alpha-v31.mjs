import assert from "node:assert/strict";
import { APP_VERSION_NUMBER } from "../src/lib/app-version.ts";
assert.ok(
  APP_VERSION_NUMBER >= 31,
  "This historical feature check requires Alpha v31 or later",
);
import fs from "node:fs";

const required = [
  "src/lib/app-version.ts",
  "src/lib/alpha31/where-to-find-dusk.ts",
  "src/lib/next-stop/copy.ts",
  "src/lib/next-stop/prompt.ts",
  "src/components/alpha31/Alpha31WhereToFindDuskCard.tsx",
  "src/components/alpha8/Alpha8ConventionWorkspace.tsx",
  "src/components/alpha8/Alpha8WorkspaceEditor.tsx",
  "src/components/alpha9/Alpha9SubEventsCard.tsx",
  "src/lib/alpha8/workspace-records.ts",
  "src/lib/alpha7/record-actions.ts",
  "src/app/api/alpha7/chaos/analyze/route.ts",
  "src/app/api/alpha8/con-preps/[id]/summary/route.ts",
  "src/app/api/integrations/automation/tick/route.ts",
  "src/lib/incident-report.ts",
  "supabase/ALPHA_V31_DEPLOYMENT_AUTOMATION_RUN_THIS.sql",
  "supabase/ALPHA_V31_ENABLE_SUPABASE_CRON_AFTER_DEPLOY.sql",
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

function contains(file, needle, label) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(needle)) {
    console.error("MISSING", label);
    failed = true;
  } else {
    console.log("OK     ", label);
  }
}

if (!failed) {
  contains(
    "src/lib/next-stop/prompt.ts",
    "Your job in this pass is graphic design, not illustration.",
    "simple final-render instruction",
  );
  contains(
    "src/lib/next-stop/copy.ts",
    "buildWhereToFindDusk",
    "shared Where to Find Dusk source",
  );
  contains(
    "src/components/alpha8/Alpha8ConventionWorkspace.tsx",
    "prep?.readiness_score",
    "stored readiness score remains displayed",
  );
  contains(
    "src/components/alpha8/Alpha8WorkspaceEditor.tsx",
    "Counts toward readiness",
    "task readiness toggle",
  );
  contains(
    "src/components/alpha8/Alpha8WorkspaceEditor.tsx",
    "Parent task",
    "parent/child task UI",
  );
  const editor = fs.readFileSync(
    "src/components/alpha8/Alpha8WorkspaceEditor.tsx",
    "utf8",
  );
  const packingBlock = editor.slice(
    editor.indexOf('case "packing":'),
    editor.indexOf('case "task":'),
  );
  if (
    packingBlock.includes("counts_toward_readiness") ||
    packingBlock.includes("parent_task_id")
  ) {
    console.error(
      "Packing editor incorrectly contains task-only readiness fields",
    );
    failed = true;
  } else {
    console.log("OK     task-only fields stay out of packing");
  }
  contains(
    "src/lib/alpha7/record-actions.ts",
    "counts_toward_readiness",
    "Chaos typed task readiness support",
  );
  contains(
    "src/app/api/integrations/automation/tick/route.ts",
    "dusk_alpha31_lifecycle_sweep",
    "unified lifecycle tick",
  );
  contains(
    "supabase/ALPHA_V31_DEPLOYMENT_AUTOMATION_RUN_THIS.sql",
    "v_task * 0.55",
    "55/35/10 readiness formula",
  );
  contains(
    "supabase/ALPHA_V31_DEPLOYMENT_AUTOMATION_RUN_THIS.sql",
    "return 'packing'",
    "automatic Packing status",
  );
}

if (failed) process.exit(1);
console.log("\nAlpha v31 Deployment Automation files are present.");
