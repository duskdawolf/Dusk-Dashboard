import fs from "node:fs";

const required = [
  "src/lib/alpha7/auth.ts",
  "src/app/api/alpha91/media/route.ts",
  "src/components/media/MediaLibraryPicker.tsx",
  "src/components/media/MediaLibraryPage.tsx",
  "src/app/dashboard/media/page.tsx",
  "src/app/api/alpha91/brand-from-media/route.ts",
  "src/components/media/BrandMediaImportPage.tsx",
  "src/app/dashboard/settings/brand/media/page.tsx",
  "src/app/api/alpha91/tags/route.ts",
  "src/components/alpha91/TagInput.tsx",
  "src/app/api/alpha91/deployments/route.ts",
  "src/components/alpha91/DeploymentListPage.tsx",
  "src/app/dashboard/con-prep/deployments/page.tsx",
  "src/lib/alpha7/record-actions.ts",
  "src/app/api/alpha7/chaos/analyze/route.ts",
  "src/components/alpha8/Alpha8ChaosCard.tsx",
  "src/components/alpha8/Alpha8WorkspaceEditor.tsx",
  "src/components/alpha8/Alpha8ConventionWorkspace.tsx",
  "supabase/V26_ALPHA91_MEDIA_TAGS_FIX_RUN_THIS.sql",
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

const actions = fs.readFileSync("src/lib/alpha7/record-actions.ts", "utf8");
if (!actions.includes("Schedule items require an exact start date/time")) {
  console.error("Sub-event time guard missing.");
  failed = true;
}

const analyze = fs.readFileSync(
  "src/app/api/alpha7/chaos/analyze/route.ts",
  "utf8",
);
if (!analyze.includes("NEVER create a NEW upsert_sub_event proposal")) {
  console.error("Chaos exact-time guard missing.");
  failed = true;
}
if (!analyze.includes("mediaId")) {
  console.error("Chaos Media Library input missing.");
  failed = true;
}

const workspace = fs.readFileSync(
  "src/components/alpha8/Alpha8ConventionWorkspace.tsx",
  "utf8",
);
if (!workspace.includes("/dashboard/con-prep/deployments?tag=")) {
  console.error("Clickable tag filters missing.");
  failed = true;
}

if (failed) process.exit(1);
console.log("\nAlpha 9.1 files are present.");
