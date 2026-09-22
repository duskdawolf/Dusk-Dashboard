import { EventManager } from "@/components/EventManager";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Events · Dusk Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardEventsPage() {
  const supabase = createAdminSupabaseClient();
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .order("start_at", { ascending: true });

  if (error) {
    return (
      <div className="panel">
        <strong>Could not load the events table.</strong>
        <p className="mt-2 text-sm text-slate-400">{error.message}</p>
      </div>
    );
  }

  return <EventManager initialEvents={(events ?? []) as never[]} />;
}
