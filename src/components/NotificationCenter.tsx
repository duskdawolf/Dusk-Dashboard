"use client";

import { useMemo, useState } from "react";
import { PushSettings } from "@/components/PushSettings";

type Delivery = {
  id: string;
  channel: string;
  status: string;
};

type NotificationRow = {
  id: string;
  severity: "info" | "action" | "reminder" | "urgent";
  category: string;
  title: string;
  message: string;
  target_url: string | null;
  read_at: string | null;
  created_at: string;
  notification_deliveries?: Delivery[];
};

const FILTERS = [
  "all",
  "events",
  "con_prep",
  "sticker_factory",
  "orders",
  "shipping",
  "social",
  "finance",
  "system",
];

export function NotificationCenter({
  initialNotifications,
}: {
  initialNotifications: NotificationRow[];
}) {
  const [items, setItems] = useState(initialNotifications);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("");

  const visible = useMemo(
    () =>
      items.filter((item) => filter === "all" || item.category === filter),
    [items, filter]
  );

  async function refresh() {
    const response = await fetch("/api/admin/notifications", { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setItems(body.notifications ?? []);
  }

  async function toggleRead(item: NotificationRow) {
    const response = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, read: !item.read_at }),
    });

    if (response.ok) await refresh();
  }

  async function testPush() {
    setStatus("Sending test notification...");

    const response = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        severity: "action",
        category: "system",
        title: "Dusk Industries Test 🐾",
        message: "If this buzzed your phone, the notification conglomerate is operational.",
        targetUrl: "/dashboard/notifications",
        channels: ["web_push", "telegram"],
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.error ?? "Test failed.");
      return;
    }

    setStatus("Test notification created.");
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <PushSettings />
        <div className="card">
          <div className="eyebrow">Delivery test</div>
          <h3 className="text-xl font-black">Test Dusk Ops</h3>
          <p className="mt-3 text-sm text-slate-400">
            Creates an action-level notification, sends Web Push immediately,
            and queues Telegram for Make.
          </p>
          <button className="button-primary mt-4" type="button" onClick={testPush}>
            Send test notification
          </button>
          {status ? <p className="mt-3 text-sm text-slate-400">{status}</p> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-xl border px-3 py-2 text-xs font-black ${
              filter === item
                ? "border-dusk-aqua/40 bg-dusk-aqua/10"
                : "border-dusk-line bg-white/5"
            }`}
          >
            {item.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((item) => (
          <article
            key={item.id}
            className={`card ${item.read_at ? "opacity-65" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="flex flex-wrap gap-2">
                  <span className="tag !mt-0">{item.severity}</span>
                  <span className="tag !mt-0">{item.category}</span>
                  {(item.notification_deliveries ?? []).map((delivery) => (
                    <span key={delivery.id} className="tag !mt-0">
                      {delivery.channel}: {delivery.status}
                    </span>
                  ))}
                </div>

                <h3 className="mt-3 text-xl font-black">{item.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                  {item.message}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>

              <div className="flex gap-2">
                {item.target_url ? (
                  <a className="button-secondary" href={item.target_url}>
                    Open
                  </a>
                ) : null}
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => toggleRead(item)}
                >
                  {item.read_at ? "Unread" : "Read"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
