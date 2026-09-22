export type NotificationCategory =
  | "events"
  | "con_prep"
  | "sticker_factory"
  | "orders"
  | "shipping"
  | "social"
  | "finance"
  | "media"
  | "integrations"
  | "system";

export type NotificationSeverity = "info" | "action" | "reminder" | "urgent";

export type NotificationTopic = {
  key: string;
  category: NotificationCategory;
  label: string;
  description: string;
  severity: NotificationSeverity;
  defaultDashboard: boolean;
  defaultPush: boolean;
  defaultTelegram: boolean;
  defaultEmail: boolean;
  critical?: boolean;
};

function topic(
  key: string,
  category: NotificationCategory,
  label: string,
  description: string,
  severity: NotificationSeverity,
  defaults: {
    dashboard?: boolean;
    push?: boolean;
    telegram?: boolean;
    email?: boolean;
    critical?: boolean;
  } = {},
): NotificationTopic {
  return {
    key,
    category,
    label,
    description,
    severity,
    defaultDashboard: defaults.dashboard ?? true,
    defaultPush: defaults.push ?? false,
    defaultTelegram: defaults.telegram ?? false,
    defaultEmail: defaults.email ?? false,
    critical: defaults.critical ?? false,
  };
}

export const NOTIFICATION_TOPICS: NotificationTopic[] = [
  // EVENTS ----------------------------------------------------------
  topic("event.created", "events", "Event created", "A new deployment/event is added.", "info"),
  topic("event.updated", "events", "Event updated", "Dates, details, location, or status change.", "info"),
  topic("event.tomorrow", "events", "Event tomorrow", "A deployment begins roughly 24 hours from now.", "reminder", { push: true, telegram: true }),
  topic("event.today", "events", "Event today", "A deployment begins later today.", "reminder", { push: true, telegram: true }),
  topic("event.starting_soon", "events", "Event starting soon", "A deployment begins within roughly an hour.", "reminder", { push: true, telegram: true }),
  topic("event.location_changed", "events", "Event location changed", "A recorded venue/location changed.", "action", { push: true, telegram: true }),
  topic("event.cancelled", "events", "Event cancelled", "A planned deployment is cancelled.", "urgent", { push: true, telegram: true, email: true, critical: true }),
  topic("event.tactical_plan_updated", "events", "Tactical Deployment Plan updated", "A future event plan was materially revised.", "info"),
  topic("event.incident_report_ready", "events", "Incident Report ready", "A completed deployment has enough evidence for review.", "action", { push: true }),

  // CON PREP --------------------------------------------------------
  topic("conprep.task_due_24h", "con_prep", "Prep task due within 24 hours", "An unfinished con-prep task is due tomorrow.", "reminder", { push: true }),
  topic("conprep.task_due_1h", "con_prep", "Prep task due within 1 hour", "An unfinished con-prep task is due very soon.", "reminder", { push: true, telegram: true }),
  topic("conprep.task_overdue", "con_prep", "Prep task overdue", "A required con-prep task is past due.", "action", { push: true, telegram: true }),
  topic("conprep.packing_window", "con_prep", "Packing window starting", "A scheduled packing block is starting soon.", "reminder", { push: true }),
  topic("conprep.packing_deadline", "con_prep", "Packing deadline", "The packing-complete deadline is approaching or passed.", "urgent", { push: true, telegram: true, critical: true }),
  topic("conprep.departure_2h", "con_prep", "Departure in 2 hours", "A travel segment leaves in about two hours.", "reminder", { push: true, telegram: true }),
  topic("conprep.departure_30m", "con_prep", "Departure in 30 minutes", "A travel segment leaves in about thirty minutes.", "urgent", { push: true, telegram: true, critical: true }),
  topic("conprep.departure_now", "con_prep", "Leave now", "The scheduled departure time has arrived.", "urgent", { push: true, telegram: true, email: true, critical: true }),
  topic("conprep.hotel_checkin", "con_prep", "Hotel check-in approaching", "Hotel check-in is coming up.", "reminder", { push: true }),
  topic("conprep.hotel_checkout", "con_prep", "Hotel checkout approaching", "Hotel checkout is coming up.", "reminder", { push: true }),
  topic("conprep.hotel_payment_due", "con_prep", "Hotel payment due", "A hotel balance/payment needs attention.", "action", { push: true, telegram: true }),
  topic("conprep.badge_needed", "con_prep", "Convention badge still needed", "Registration/badge is not yet resolved.", "action", { push: true }),
  topic("conprep.flight_checkin", "con_prep", "Flight check-in available", "Airline check-in is available or approaching.", "reminder", { push: true, telegram: true }),
  topic("conprep.travel_delay", "con_prep", "Travel delay/change", "A travel segment has a meaningful schedule change.", "urgent", { push: true, telegram: true, email: true, critical: true }),
  topic("conprep.budget_warning", "con_prep", "Trip budget warning", "Projected or recorded trip costs cross a configured threshold.", "action", { push: true }),

  // STICKER FACTORY -------------------------------------------------
  topic("sticker.print_block_today", "sticker_factory", "Sticker print block today", "A scheduled printing window is happening today.", "reminder", { push: true }),
  topic("sticker.print_block_1h", "sticker_factory", "Sticker printing in 1 hour", "A scheduled sticker production block starts soon.", "reminder", { push: true }),
  topic("sticker.production_started", "sticker_factory", "Production started", "A sticker job entered production.", "info"),
  topic("sticker.production_complete", "sticker_factory", "Production complete", "A sticker job finished printing.", "action", { push: true }),
  topic("sticker.production_overdue", "sticker_factory", "Production overdue", "A sticker job is behind its planned production window.", "urgent", { push: true, telegram: true, critical: true }),
  topic("sticker.low_materials", "sticker_factory", "Materials running low", "Laminate, vinyl, ink, or packaging inventory needs attention.", "action", { push: true }),
  topic("sticker.quote_received", "sticker_factory", "New custom-print quote", "A new sticker-printing quote request arrived.", "action", { push: true }),

  // ORDERS ----------------------------------------------------------
  topic("order.new", "orders", "New order", "A new paid or pending shop order was created.", "action", { push: true, telegram: true }),
  topic("order.payment_received", "orders", "Payment received", "Payment cleared for an order.", "info", { push: true }),
  topic("order.payment_failed", "orders", "Payment failed", "A payment attempt failed.", "urgent", { push: true, telegram: true, email: true, critical: true }),
  topic("order.action_required", "orders", "Order needs action", "An order needs manual review or customer follow-up.", "action", { push: true, telegram: true }),
  topic("order.cancelled", "orders", "Order cancelled", "An order was cancelled.", "action", { push: true }),
  topic("order.refund", "orders", "Refund issued/requested", "A refund event occurred.", "action", { push: true, telegram: true }),

  // SHIPPING --------------------------------------------------------
  topic("shipping.label_created", "shipping", "Shipping label created", "A label is ready for an order.", "info"),
  topic("shipping.ship_by_today", "shipping", "Shipment due today", "An order should be handed off to the carrier today.", "reminder", { push: true }),
  topic("shipping.shipped", "shipping", "Package shipped", "A package entered carrier possession.", "info", { push: true }),
  topic("shipping.delivered", "shipping", "Package delivered", "Carrier reports delivery.", "info"),
  topic("shipping.delayed", "shipping", "Shipment delayed", "Carrier reports a meaningful delay.", "action", { push: true, telegram: true }),
  topic("shipping.exception", "shipping", "Shipping exception", "Carrier reports an exception or failed delivery.", "urgent", { push: true, telegram: true, email: true, critical: true }),

  // SOCIAL OPS ------------------------------------------------------
  topic("social.needs_approval", "social", "Post needs approval", "A social post is waiting for your approval.", "action", { push: true }),
  topic("social.approved", "social", "Post approved", "A post moved into Approved.", "info"),
  topic("social.scheduled", "social", "Post scheduled", "A post is approved and scheduled.", "info", { push: true }),
  topic("social.due_soon", "social", "Post publishes soon", "A scheduled post is within about an hour of publishing.", "reminder", { push: true }),
  topic("social.publishing", "social", "Publishing started", "A provider publishing job started.", "info"),
  topic("social.published", "social", "Post published", "A platform accepted and published the post.", "action", { push: true, telegram: true }),
  topic("social.publish_failed", "social", "Publishing failed", "A provider rejected or failed a social post.", "urgent", { push: true, telegram: true, email: true, critical: true }),
  topic("social.partial_failure", "social", "Partial publishing failure", "Some platforms published while at least one failed.", "urgent", { push: true, telegram: true, critical: true }),
  topic("social.metrics_ready", "social", "New social metrics", "Fresh reach/engagement metrics were collected.", "info"),
  topic("social.engagement_milestone", "social", "Engagement milestone", "A post crossed a configured performance threshold.", "action", { push: true }),
  topic("social.best_performer", "social", "New best-performing post", "A post becomes the strongest performer in a comparison window.", "action", { push: true }),

  // MEDIA -----------------------------------------------------------
  topic("media.upload_complete", "media", "Media upload complete", "A photo/video finished archiving.", "info"),
  topic("media.upload_failed", "media", "Media upload failed", "A photo/video could not be stored.", "action", { push: true }),
  topic("media.unassigned", "media", "Unassigned media", "Archived media is not attached to an event.", "info"),

  // FINANCE ---------------------------------------------------------
  topic("finance.expense_added", "finance", "Expense recorded", "A new event/business expense was recorded.", "info"),
  topic("finance.budget_warning", "finance", "Budget threshold warning", "Spending approaches a configured budget threshold.", "action", { push: true }),
  topic("finance.budget_exceeded", "finance", "Budget exceeded", "Recorded/projected spending exceeds a configured budget.", "urgent", { push: true, telegram: true, critical: true }),
  topic("finance.sync_failed", "finance", "Finance sync failed", "QuickBooks or another finance sync failed.", "urgent", { push: true, telegram: true, critical: true }),
  topic("finance.reconciliation_needed", "finance", "Reconciliation needed", "A transaction or cost requires manual reconciliation.", "action", { push: true }),

  // INTEGRATIONS ----------------------------------------------------
  topic("integration.make_failed", "integrations", "Make automation failed", "A Make scenario failed or exhausted retries.", "urgent", { push: true, telegram: true, critical: true }),
  topic("integration.make_recovered", "integrations", "Make automation recovered", "A previously failing automation recovered.", "info", { push: true }),
  topic("integration.calendar_failed", "integrations", "Calendar sync failed", "A calendar job could not be created or updated.", "action", { push: true, telegram: true }),
  topic("integration.telegram_failed", "integrations", "Telegram delivery failed", "A Telegram notification could not be delivered.", "action", { push: true }),
  topic("integration.provider_disconnected", "integrations", "Provider disconnected", "An external provider requires reauthorization.", "urgent", { push: true, telegram: true, email: true, critical: true }),
  topic("integration.provider_reconnected", "integrations", "Provider reconnected", "An external integration was restored.", "info", { push: true }),

  // SYSTEM ----------------------------------------------------------
  topic("system.deployment_succeeded", "system", "Website deployment succeeded", "A Dusk Industries deployment completed successfully.", "info"),
  topic("system.deployment_failed", "system", "Website deployment failed", "A production deployment failed.", "urgent", { push: true, telegram: true, critical: true }),
  topic("system.database_error", "system", "Database error", "A database operation failed in an important workflow.", "urgent", { push: true, telegram: true, critical: true }),
  topic("system.security", "system", "Security/authentication alert", "An authentication or security event needs attention.", "urgent", { push: true, telegram: true, email: true, critical: true }),
  topic("system.daily_digest", "system", "Daily Dusk Ops digest", "One daily summary of upcoming work and unresolved items.", "info", { push: true }),
  topic("system.weekly_digest", "system", "Weekly Dusk Ops digest", "Weekly operations, travel, social, and production summary.", "info"),
  topic("system.test", "system", "Test notification", "Manual test from the Notification Center.", "action", { push: true }),
  topic("system.generic", "system", "Other system notification", "Fallback for uncategorized system messages.", "info"),
];

export const NOTIFICATION_CATEGORIES: {
  key: NotificationCategory;
  label: string;
  description: string;
}[] = [
  { key: "events", label: "Events", description: "Deployments, meetups, conventions, and public event changes." },
  { key: "con_prep", label: "Con Prep", description: "Packing, travel, hotels, badges, tasks, and departure reminders." },
  { key: "sticker_factory", label: "Sticker Factory", description: "Printing windows, production, materials, and quote activity." },
  { key: "orders", label: "Orders", description: "Customer orders, payments, refunds, and manual-action alerts." },
  { key: "shipping", label: "Shipping", description: "Labels, ship-by deadlines, carrier updates, and exceptions." },
  { key: "social", label: "Social Ops", description: "Approvals, schedules, publishing, failures, and performance." },
  { key: "finance", label: "Finance", description: "Expenses, budgets, reconciliation, and accounting syncs." },
  { key: "media", label: "Media", description: "Photo/video upload and evidence-library activity." },
  { key: "integrations", label: "Integrations", description: "Make, calendar, Telegram, provider authorization, and recovery." },
  { key: "system", label: "System", description: "Deployments, security, database health, tests, and digests." },
];

export function topicForKey(key: string) {
  return NOTIFICATION_TOPICS.find((item) => item.key === key);
}
