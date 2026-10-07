import fs from "node:fs";

const required = [
  "src/lib/alpha92/event-lifecycle.ts",
  "src/app/api/alpha92/events/route.ts",
  "src/app/api/alpha92/events/[id]/route.ts",
  "src/app/api/alpha92/events/[id]/ops/route.ts",
  "src/app/api/alpha92/events/[id]/case-study/route.ts",
  "src/app/api/alpha92/events/[id]/media/route.ts",
  "src/app/api/case-studies/[slug]/media/route.ts",
  "src/components/alpha92/UnifiedEventsPage.tsx",
  "src/components/alpha92/PastEventSheet.tsx",
  "src/components/alpha92/EventLifecycleWorkspace.tsx",
  "src/components/alpha92/CaseStudyEditor.tsx",
  "src/components/alpha92/CaseStudyMediaManager.tsx",
  "src/app/dashboard/events/page.tsx",
  "src/app/dashboard/events/[id]/page.tsx",
  "src/components/alpha8/Alpha8ConventionWorkspace.tsx",
  "src/app/dashboard/con-prep/deployments/page.tsx",
  "supabase/V26_ALPHA92_UNIFIED_EVENT_LIFECYCLE_RUN_THIS.sql",
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

const sql = fs.readFileSync(
  "supabase/V26_ALPHA92_UNIFIED_EVENT_LIFECYCLE_RUN_THIS.sql",
  "utf8",
);

for (const needle of [
  "create table if not exists public.event_media",
  "insert into public.event_media",
  "case_studies_event_id_unique",
]) {
  if (!sql.toLowerCase().includes(needle.toLowerCase())) {
    console.error(`Migration missing: ${needle}`);
    failed = true;
  }
}

const events = fs.readFileSync(
  "src/components/alpha92/UnifiedEventsPage.tsx",
  "utf8",
);

for (const needle of [
  "Upcoming Deployment",
  "Past Event",
  "Open Deployment Ops",
  "Open Case Study",
]) {
  if (!events.includes(needle)) {
    console.error(`Unified events UI missing: ${needle}`);
    failed = true;
  }
}

const media = fs.readFileSync(
  "src/components/alpha92/CaseStudyMediaManager.tsx",
  "utf8",
);

if (!media.includes("MediaLibraryPicker")) {
  console.error("Case Study Media is not connected to Media Library.");
  failed = true;
}

const workspace = fs.readFileSync(
  "src/components/alpha8/Alpha8ConventionWorkspace.tsx",
  "utf8",
);

if (!workspace.includes('url.searchParams.get("add") !== "1"')) {
  console.error("Convention Ops does not accept ?add=1.");
  failed = true;
}

if (failed) process.exit(1);
console.log("\nAlpha 9.2 Unified Event Lifecycle files are present.");
