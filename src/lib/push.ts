import webpush from "web-push";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

type NotificationRow = {
  id: string;
  user_id: string | null;
  severity: "info" | "action" | "reminder" | "urgent";
  title: string;
  message: string;
  target_url: string | null;
  action_label?: string | null;
  event_key?: string | null;
};

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function configureWebPush() {
  if (!configured()) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  return true;
}

function minutesForTime(value: string | null | undefined) {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function localMinutesNow(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );

  return hour * 60 + minute;
}

function insideQuietHours(
  quietStart: string | null | undefined,
  quietEnd: string | null | undefined,
  timeZone: string,
) {
  const start = minutesForTime(quietStart);
  const end = minutesForTime(quietEnd);

  if (start == null || end == null || start === end) return false;

  const now = localMinutesNow(timeZone);

  if (start < end) {
    return now >= start && now < end;
  }

  // Overnight window, e.g. 23:00 → 07:00.
  return now >= start || now < end;
}

export async function sendWebPush(notification: NotificationRow) {
  if (!configureWebPush() || !notification.user_id) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "Web Push/VAPID is not configured.",
    };
  }

  const supabase = createAdminSupabaseClient();

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", notification.user_id)
    .maybeSingle();

  if (prefs && !prefs.web_push_enabled) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "Web Push is disabled globally.",
    };
  }

  if (
    prefs?.quiet_hours_enabled &&
    insideQuietHours(
      prefs.quiet_start,
      prefs.quiet_end,
      prefs.timezone ?? "America/New_York",
    )
  ) {
    const urgentCanBypass =
      notification.severity === "urgent" &&
      (prefs.quiet_urgent_bypass ?? true);

    if (!urgentCanBypass) {
      return {
        sent: 0,
        failed: 0,
        skipped: true,
        reason: "Suppressed by quiet hours.",
      };
    }
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
    actionLabel: notification.action_label || "Open",
    notificationId: notification.id,
    eventKey: notification.event_key || "system.generic",
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
        payload,
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

  return {
    sent,
    failed,
    skipped: false,
    reason: null,
  };
}
