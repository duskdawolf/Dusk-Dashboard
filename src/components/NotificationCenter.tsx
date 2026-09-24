"use client";

import { useMemo, useState } from "react";
import { NotificationPreferences } from "@/components/NotificationPreferences";
import { PushSettings } from "@/components/PushSettings";
import {
  NOTIFICATION_CATEGORIES,
  topicForKey,
} from "@/lib/notification-catalog";

type Delivery = {
  id: string;
  channel: string;
  status: string;
  error_message?: string | null;
  attempt_count?: number;
  sent_at?: string | null;
};

type NotificationRow = {
  id: string;
  event_key: string;
  severity: "info" | "action" | "reminder" | "urgent";
  category: string;
  title: string;
  message: string;
  target_url: string | null;
  action_label?: string | null;
  read_at: string | null;
  created_at: string;
  notification_deliveries?: Delivery[];
};

function categoryLabel(key: string) {
  return NOTIFICATION_CATEGORIES.find((item) => item.key === key)?.label ?? key;
}

export function NotificationCenter({
  initialNotifications,
}: {
  initialNotifications: NotificationRow[];
}) {
  const [items, setItems] = useState(initialNotifications);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<"inbox" | "preferences">("inbox");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const unreadCount = items.filter((item) => !item.read_at).length;

  const visible = useMemo(
    () =>
      items.filter((item) => {
        const categoryMatches =
          filter === "all" || item.category === filter;
        const unreadMatches = !unreadOnly || !item.read_at;
        return categoryMatches && unreadMatches;
      }),
    [items, filter, unreadOnly],
  );

  async function refresh() {
    const response = await fetch("/api/admin/notifications", {
      cache: "no-store",
    });
    const body = await response.json();

    if (response.ok) {
      setItems(body.notifications ?? []);
    } else {
      setStatus(body.error ?? "Could not refresh notifications.");
    }
  }

  async function toggleRead(item: NotificationRow) {
    const response = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, read: !item.read_at }),
    });

    if (response.ok) await refresh();
  }

  async function markAllRead() {
    const response = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });

    if (response.ok) {
      setStatus("Inbox cleared.");
      await refresh();
    }
  }

  async function testPush() {
    setStatus("Sending test notification...");

    const response = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topicKey: "system.test",
        title: "Dusk Industries Test 🐾",
        message:
          "If this buzzed your phone, the notification conglomerate is operational.",
        targetUrl: "/dashboard/notifications",
        actionLabel: "Open Dusk Ops",
        dedupeKey: `system-test-${Math.floor(Date.now() / 300000)}`,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Test failed.");
      return;
    }

    setStatus(
      body.skipped
        ? `Test skipped: ${body.reason ?? "disabled or deduplicated"}.`
        : "Test notification created.",
    );
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          className={tab === "inbox" ? "button-primary" : "button-secondary"}
          type="button"
          onClick={() => setTab("inbox")}
        >
          Notification Inbox {unreadCount ? `· ${unreadCount}` : ""}
        </button>
        <button
          className={tab === "preferences" ? "button-primary" : "button-secondary"}
          type="button"
          onClick={() => setTab("preferences")}
        >
          Routing Preferences
        </button>
      </div>

      {tab === "preferences" ? (
        <NotificationPreferences />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <PushSettings />

            <div className="card">
              <div className="eyebrow">Delivery diagnostics</div>
              <h3 className="text-xl font-black">Test Dusk Ops</h3>
              <p className="mt-3 text-sm text-slate-400">
                Creates a real <code>system.test</code> notification and routes it
                according to your current preferences.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="button-primary"
                  type="button"
                  onClick={testPush}
                >
                  Send test notification
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={refresh}
                >
                  Refresh
                </button>
                {unreadCount ? (
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={markAllRead}
                  >
                    Mark all read
                  </button>
                ) : null}
              </div>

              {status ? (
                <p className="mt-3 text-sm text-slate-400">{status}</p>
              ) : null}
            </div>
          </div>

          <section className="panel">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="eyebrow">Notification inbox</div>
                <h2 className="text-3xl font-black">
                  {unreadCount} unread operational alert{unreadCount === 1 ? "" : "s"}
                </h2>
              </div>

              <label className="flex items-center gap-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(event) => setUnreadOnly(event.target.checked)}
                />
                Unread only
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-xl border px-3 py-2 text-xs font-black ${
                  filter === "all"
                    ? "border-dusk-aqua/40 bg-dusk-aqua/10"
                    : "border-dusk-line bg-white/5"
                }`}
              >
                All
              </button>

              {NOTIFICATION_CATEGORIES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`rounded-xl border px-3 py-2 text-xs font-black ${
                    filter === item.key
                      ? "border-dusk-aqua/40 bg-dusk-aqua/10"
                      : "border-dusk-line bg-white/5"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <div className="space-y-3">
            {visible.map((item) => {
              const topic = topicForKey(item.event_key);

              return (
                <article
                  key={item.id}
                  className={`card ${
                    item.read_at ? "opacity-65" : ""
                  } ${
                    item.severity === "urgent"
                      ? "!border-dusk-pink/30"
                      : item.severity === "reminder"
                        ? "!border-dusk-aqua/20"
                        : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap gap-2">
                        <span className="tag !mt-0">{item.severity}</span>
                        <span className="tag !mt-0">
                          {categoryLabel(item.category)}
                        </span>
                        {topic ? (
                          <span className="tag !mt-0">{topic.label}</span>
                        ) : null}

                        {(item.notification_deliveries ?? []).map((delivery) => (
                          <span
                            key={delivery.id}
                            className={`tag !mt-0 ${
                              delivery.status === "failed"
                                ? "!border-dusk-pink/30 !text-dusk-pink"
                                : ""
                            }`}
                            title={delivery.error_message ?? undefined}
                          >
                            {delivery.channel}: {delivery.status}
                          </span>
                        ))}
                      </div>

                      <h3 className="mt-3 text-xl font-black">{item.title}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                        {item.message}
                      </p>

                      {(item.notification_deliveries ?? []).some(
                        (delivery) => delivery.error_message,
                      ) ? (
                        <div className="mt-3 rounded-xl border border-dusk-pink/20 bg-dusk-pink/5 p-3 text-xs text-dusk-pink">
                          {(item.notification_deliveries ?? [])
                            .filter((delivery) => delivery.error_message)
                            .map((delivery) => (
                              <div key={delivery.id}>
                                {delivery.channel}: {delivery.error_message}
                              </div>
                            ))}
                        </div>
                      ) : null}

                      <p className="mt-3 text-xs text-slate-500">
                        {new Date(item.created_at).toLocaleString()} ·{" "}
                        <code>{item.event_key}</code>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.target_url ? (
                        <a className="button-primary" href={item.target_url}>
                          {item.action_label || "Open"}
                        </a>
                      ) : null}

                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => toggleRead(item)}
                      >
                        {item.read_at ? "Mark unread" : "Mark read"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {!visible.length ? (
              <div className="panel text-slate-500">
                No notifications match the current filter.
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
