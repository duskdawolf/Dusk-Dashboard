import { CaseStudyManager } from "@/components/CaseStudyManager";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Case Studies · Dusk Dashboard" };
export const dynamic = "force-dynamic";

export default async function CaseStudiesDashboardPage() {
  const supabase = createAdminSupabaseClient();

  const [{ data: events, error: eventError }, { data: studies, error: studyError }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id,slug,title,start_at,location")
        .order("start_at", { ascending: false }),
      supabase
        .from("case_studies")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

  if (eventError || studyError) {
    return (
      <div className="panel">
        <strong>Could not load Case Studies.</strong>
        <p className="mt-2 text-sm text-slate-400">
          {eventError?.message ?? studyError?.message}
        </p>
      </div>
    );
  }

  return (
    <CaseStudyManager
      events={(events ?? []) as never[]}
      initialStudies={(studies ?? []) as never[]}
    />
  );
}
