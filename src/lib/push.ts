import webpush from "web-push";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

type NotificationRow = {
  id: string;
  user_id: string | null;
  severity: "info" | "action" | "reminder" | "urgent";
  title: string;
  message: string;
  target_url: string | null;
};

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

function configureWebPush() {
  if (!configured()) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  return true;
}

export async function sendWebPush(notification: NotificationRow) {
  if (!configureWebPush() || !notification.user_id) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const supabase = createAdminSupabaseClient();

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", notification.user_id)
    .maybeSingle();

  if (prefs && !prefs.web_push_enabled) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const severityAllowed =
    notification.severity === "urgent"
      ? prefs?.urgent_push ?? true
      : notification.severity === "reminder"
        ? prefs?.reminder_push ?? true
        : notification.severity === "action"
          ? prefs?.action_push ?? true
          : prefs?.info_push ?? false;

  if (!severityAllowed) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", notification.user_id)
    .eq("active", true);

  let sent = 0;
  let failed = 0;

  const payload = JSON.stringify({
    title: notification.title,
    message: notification.message,
    url: notification.target_url || "/dashboard/notifications",
    notificationId: notification.id,
    urgent: notification.severity === "urgent",
  });

  for (const row of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        },
        payload
      );
      sent += 1;
    } catch (error: any) {
      failed += 1;

      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await supabase
          .from("push_subscriptions")
          .update({ active: false })
          .eq("id", row.id);
      }
    }
  }

  return { sent, failed, skipped: false };
}
