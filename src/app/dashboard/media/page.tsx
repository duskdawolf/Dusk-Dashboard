import { MediaManager } from "@/components/MediaManager";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Media · Dusk Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardMediaPage() {
  const supabase = createAdminSupabaseClient();

  const [{ data: media, error }, { data: events }] = await Promise.all([
    supabase
      .from("media")
      .select("*")
      .order("event_id", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("events")
      .select("id,title,slug,start_at")
      .order("start_at", { ascending: false }),
  ]);

  if (error) {
    return (
      <div className="panel">
        <strong>Media migration is not ready yet.</strong>
        <p className="mt-2 text-sm text-slate-400">{error.message}</p>
      </div>
    );
  }

  return (
    <MediaManager
      initialMedia={(media ?? []) as never[]}
      events={(events ?? []) as never[]}
    />
  );
}
