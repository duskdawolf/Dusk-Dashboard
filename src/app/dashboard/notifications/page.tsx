import { NotificationCenter } from "@/components/NotificationCenter";
import { requireDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Notifications · Dusk Dashboard" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireDashboardUser();
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*, notification_deliveries(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="panel">
        <strong>Notification migration is not ready yet.</strong>
        <p className="mt-2 text-sm text-slate-400">{error.message}</p>
      </div>
    );
  }

  return <NotificationCenter initialNotifications={(data ?? []) as never[]} />;
}
