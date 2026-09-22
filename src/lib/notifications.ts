import { getAdminEmails } from "@/lib/supabase/config";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  topicForKey,
  type NotificationSeverity,
} from "@/lib/notification-catalog";
import { sendWebPush } from "@/lib/push";
import { sendResendNotificationEmail } from "@/lib/email";

export type NotificationChannel = "web_push" | "telegram" | "email";

export type CreateNotificationInput = {
  userId: string;
  topicKey: string;
  title: string;
  message: string;
  targetUrl?: string | null;
  actionLabel?: string | null;
  severity?: NotificationSeverity;
  eventId?: string | null;
  postId?: string | null;
  orderId?: string | null;
  dedupeKey?: string | null;
  dedupeMinutes?: number;
  payload?: Record<string, unknown>;
};

type EffectiveChannels = {
  dashboard: boolean;
  webPush: boolean;
  telegram: boolean;
  email: boolean;
};

function minutesForTime(value: string | null | undefined) {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function quietNow(
  quietStart: string | null | undefined,
  quietEnd: string | null | undefined,
  timeZone: string,
) {
  const start = minutesForTime(quietStart);
  const end = minutesForTime(quietEnd);
  if (start == null || end == null || start === end) return false;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const now = hour * 60 + minute;

  return start < end ? now >= start && now < end : now >= start || now < end;
}

async function effectiveChannels(
  userId: string,
  topicKey: string,
): Promise<EffectiveChannels> {
  const topic = topicForKey(topicKey) ?? topicForKey("system.generic")!;
  const supabase = createAdminSupabaseClient();

  const [{ data: globals }, { data: override }] = await Promise.all([
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("notification_topic_preferences")
      .select("*")
      .eq("user_id", userId)
      .eq("event_key", topicKey)
      .maybeSingle(),
  ]);

  const inQuietHours =
    Boolean(globals?.quiet_hours_enabled) &&
    quietNow(
      globals?.quiet_start,
      globals?.quiet_end,
      globals?.timezone ?? "America/New_York",
    );

  const urgentBypass =
    topic.severity === "urgent" &&
    (globals?.quiet_urgent_bypass ?? true);

  const suppressExternal = inQuietHours && !urgentBypass;

  return {
    dashboard: override?.dashboard_enabled ?? topic.defaultDashboard,
    webPush:
      !suppressExternal &&
      (globals?.web_push_enabled ?? true) &&
      (override?.web_push_enabled ?? topic.defaultPush),
    telegram:
      !suppressExternal &&
      (globals?.telegram_enabled ?? true) &&
      (override?.telegram_enabled ?? topic.defaultTelegram),
    email:
      !suppressExternal &&
      (globals?.email_enabled ?? false) &&
      (override?.email_enabled ?? topic.defaultEmail),
  };
}

export async function createDuskNotification(
  input: CreateNotificationInput,
) {
  const topic = topicForKey(input.topicKey) ?? topicForKey("system.generic")!;
  const supabase = createAdminSupabaseClient();
  const channels = await effectiveChannels(input.userId, input.topicKey);

  if (
    !channels.dashboard &&
    !channels.webPush &&
    !channels.telegram &&
    !channels.email
  ) {
    return { notification: null, skipped: true, reason: "disabled" as const };
  }

  if (input.dedupeKey) {
    const dedupeMinutes = input.dedupeMinutes ?? 60;
    const since = new Date(Date.now() - dedupeMinutes * 60_000).toISOString();

    const { data: duplicate } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", input.userId)
      .eq("dedupe_key", input.dedupeKey)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (duplicate) {
      return {
        notification: duplicate,
        skipped: true,
        reason: "deduplicated" as const,
      };
    }
  }

  const { data: notification, error } = await supabase
    .from("notifications")
    .insert({
      user_id: input.userId,
      severity: input.severity ?? topic.severity,
      category: topic.category,
      event_key: input.topicKey,
      title: input.title,
      message: input.message,
      target_url: input.targetUrl ?? null,
      action_label: input.actionLabel ?? null,
      event_id: input.eventId ?? null,
      post_id: input.postId ?? null,
      order_id: input.orderId ?? null,
      dedupe_key: input.dedupeKey ?? null,
      dashboard_visible: channels.dashboard,
      read_at: channels.dashboard ? null : new Date().toISOString(),
      payload: input.payload ?? {},
    })
    .select("*")
    .single();

  if (error || !notification) {
    throw new Error(error?.message ?? "Could not create notification.");
  }

  const deliveryChannels: NotificationChannel[] = [];
  if (channels.webPush) deliveryChannels.push("web_push");
  if (channels.telegram) deliveryChannels.push("telegram");
  if (channels.email) deliveryChannels.push("email");

  if (deliveryChannels.length) {
    const { error: deliveryError } = await supabase
      .from("notification_deliveries")
      .insert(
        deliveryChannels.map((channel) => ({
          notification_id: notification.id,
          channel,
          status: "pending",
        })),
      );

    if (deliveryError) {
      throw new Error(deliveryError.message);
    }
  }

  if (channels.webPush) {
    const result = await sendWebPush(notification);

    await supabase
      .from("notification_deliveries")
      .update({
        status:
          result.skipped
            ? "skipped"
            : result.failed > 0
              ? "failed"
              : "sent",
        attempt_count: 1,
        sent_at: result.sent > 0 ? new Date().toISOString() : null,
        error_message:
          result.failed > 0
            ? `${result.failed} push subscription(s) failed.`
            : result.reason ?? null,
      })
      .eq("notification_id", notification.id)
      .eq("channel", "web_push");
  }

  if (channels.email) {
    const { data: authUser } = await supabase.auth.admin.getUserById(
      input.userId,
    );

    const emailResult = await sendResendNotificationEmail(
      authUser?.user?.email,
      notification,
    );

    await supabase
      .from("notification_deliveries")
      .update({
        status:
          emailResult.skipped
            ? "skipped"
            : emailResult.failed > 0
              ? "failed"
              : "sent",
        provider_message_id: emailResult.providerMessageId ?? null,
        attempt_count: 1,
        sent_at: emailResult.sent > 0 ? new Date().toISOString() : null,
        error_message: emailResult.reason ?? null,
      })
      .eq("notification_id", notification.id)
      .eq("channel", "email");
  }

  return { notification, skipped: false, reason: null };
}

export async function getAdminUserIds() {
  const emails = getAdminEmails();
  if (!emails.length) return [];

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw new Error(error.message);

  const wanted = new Set(emails.map((email) => email.toLowerCase()));
  return data.users
    .filter((user) => user.email && wanted.has(user.email.toLowerCase()))
    .map((user) => user.id);
}

export async function notifyAdmins(
  input: Omit<CreateNotificationInput, "userId">,
) {
  const userIds = await getAdminUserIds();
  const results = [];

  for (const userId of userIds) {
    results.push(
      await createDuskNotification({
        ...input,
        userId,
      }),
    );
  }

  return results;
}
