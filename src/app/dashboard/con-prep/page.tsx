import { ConPrepManager } from "@/components/ConPrepManager";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Con Prep · Dusk Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardConPrepPage() {
  const supabase = createAdminSupabaseClient();

  const [{ data: events }, { data: preps, error }] = await Promise.all([
    supabase
      .from("events")
      .select("id,title,start_at,location,event_type")
      .order("start_at", { ascending: true }),
    supabase
      .from("con_preps")
      .select(
        "*, events(id,title,start_at,location,event_type), packing_items(*), prep_tasks(*), travel_segments(*), hotel_stays(*), con_registrations(*), cost_entries(*)"
      )
      .order("created_at", { ascending: false }),
  ]);

  if (error) {
    return (
      <div className="panel">
        <strong>Con Prep migration is not ready yet.</strong>
        <p className="mt-2 text-sm text-slate-400">{error.message}</p>
      </div>
    );
  }

  return (
    <ConPrepManager
      events={(events ?? []) as never[]}
      initialPreps={(preps ?? []) as never[]}
    />
  );
}
