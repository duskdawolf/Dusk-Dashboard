"use client";

import { useEffect, useMemo, useState } from "react";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/notification-catalog";

type GlobalPrefs = {
  webPushEnabled: boolean;
  telegramEnabled: boolean;
  emailEnabled: boolean;
  quietHoursEnabled: boolean;
  quietStart: string | null;
  quietEnd: string | null;
  quietUrgentBypass: boolean;
  badgeCountEnabled: boolean;
  timezone: string;
};

type TopicPrefs = {
  key: string;
  category: NotificationCategory;
  label: string;
  description: string;
  severity: "info" | "action" | "reminder" | "urgent";
  critical?: boolean;
  dashboardEnabled: boolean;
  webPushEnabled: boolean;
  telegramEnabled: boolean;
  emailEnabled: boolean;
};

type PreferencePayload = {
  global: GlobalPrefs;
  topics: TopicPrefs[];
};

function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
        checked
          ? "border-dusk-aqua/50 bg-dusk-aqua/35"
          : "border-white/10 bg-white/5"
      } ${disabled ? "cursor-not-allowed opacity-35" : ""}`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white transition ${
          checked ? "left-[22px]" : "left-1"
        }`}
      />
    </button>
  );
}

export function NotificationPreferences() {
  const [data, setData] = useState<PreferencePayload | null>(null);
  const [category, setCategory] = useState<NotificationCategory>("events");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    const response = await fetch("/api/admin/notification-preferences", {
      cache: "no-store",
    });
    const body = await response.json();

    if (!response.ok) {
      setStatus(body.error ?? "Could not load notification preferences.");
      return;
    }

    setData(body);
  }

  useEffect(() => {
    load();
  }, []);

  const visibleTopics = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();

    return data.topics.filter((topic) => {
      const matchesCategory = topic.category === category;
      const matchesSearch =
        !needle ||
        topic.label.toLowerCase().includes(needle) ||
        topic.description.toLowerCase().includes(needle) ||
        topic.key.toLowerCase().includes(needle);

      return matchesCategory && matchesSearch;
    });
  }, [data, category, search]);

  async function saveGlobal(next: GlobalPrefs) {
    if (!data) return;
    setData({ ...data, global: next });
    setStatus("Saving notification settings...");

    const response = await fetch("/api/admin/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ global: next }),
    });

    const body = await response.json();
    setStatus(response.ok ? "Notification settings saved." : body.error ?? "Save failed.");
  }

  async function saveTopic(
    topic: TopicPrefs,
    patch: Partial<
      Pick<
        TopicPrefs,
        "dashboardEnabled" | "webPushEnabled" | "telegramEnabled" | "emailEnabled"
      >
    >,
  ) {
    if (!data) return;

    const next = { ...topic, ...patch };
    setData({
      ...data,
      topics: data.topics.map((item) => (item.key === topic.key ? next : item)),
    });

    const response = await fetch("/api/admin/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: {
          eventKey: next.key,
          dashboardEnabled: next.dashboardEnabled,
          webPushEnabled: next.webPushEnabled,
          telegramEnabled: next.telegramEnabled,
          emailEnabled: next.emailEnabled,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.json();
      setStatus(body.error ?? "Could not save topic preference.");
      await load();
    }
  }

  async function applyPreset(
    preset: "recommended" | "critical_only" | "everything" | "dashboard_only",
  ) {
    setStatus("Applying preset...");

    const response = await fetch("/api/admin/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.error ?? "Could not apply preset.");
      return;
    }

    setStatus("Preset applied.");
    await load();
  }

  if (!data) {
    return (
      <div className="panel">
        <div className="eyebrow">Notification preferences</div>
        <p className="text-slate-400">{status || "Loading preference matrix..."}</p>
      </div>
    );
  }

  const global = data.global;

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Master notification controls</div>
        <h2 className="text-3xl font-black">Choose How Dusk Ops Interrupts You</h2>
        <p className="mt-3 max-w-3xl text-slate-400">
          Global channel switches sit above the 76 individual notification types below.
          A topic must be enabled here and at the topic level to use that delivery channel.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong>Web Push / iPhone</strong>
                <p className="mt-1 text-xs text-slate-500">
                  PWA push notifications on subscribed devices.
                </p>
              </div>
              <Switch
                label="Global web push"
                checked={global.webPushEnabled}
                onChange={(checked) =>
                  saveGlobal({ ...global, webPushEnabled: checked })
                }
              />
            </div>
          </div>

          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong>Telegram</strong>
                <p className="mt-1 text-xs text-slate-500">
                  Routed through the protected Make delivery queue.
                </p>
              </div>
              <Switch
                label="Global Telegram"
                checked={global.telegramEnabled}
                onChange={(checked) =>
                  saveGlobal({ ...global, telegramEnabled: checked })
                }
              />
            </div>
          </div>

          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong>Email</strong>
                <p className="mt-1 text-xs text-slate-500">
                  Delivered directly through Resend when enabled.
                </p>
              </div>
              <Switch
                label="Global email"
                checked={global.emailEnabled}
                onChange={(checked) =>
                  saveGlobal({ ...global, emailEnabled: checked })
                }
              />
            </div>
          </div>

          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong>Unread bell count</strong>
                <p className="mt-1 text-xs text-slate-500">
                  Show unread Dusk Ops count in the site header.
                </p>
              </div>
              <Switch
                label="Unread bell count"
                checked={global.badgeCountEnabled}
                onChange={(checked) =>
                  saveGlobal({ ...global, badgeCountEnabled: checked })
                }
              />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <strong>Quiet hours</strong>
              <p className="mt-1 text-xs text-slate-500">
                Suppress non-urgent Web Push during this local-time window.
              </p>
            </div>
            <Switch
              label="Quiet hours"
              checked={global.quietHoursEnabled}
              onChange={(checked) =>
                saveGlobal({ ...global, quietHoursEnabled: checked })
              }
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="form-label">
              Start
              <input
                className="form-input"
                type="time"
                value={global.quietStart ?? "23:00"}
                onChange={(event) =>
                  saveGlobal({ ...global, quietStart: event.target.value })
                }
                disabled={!global.quietHoursEnabled}
              />
            </label>

            <label className="form-label">
              End
              <input
                className="form-input"
                type="time"
                value={global.quietEnd ?? "07:00"}
                onChange={(event) =>
                  saveGlobal({ ...global, quietEnd: event.target.value })
                }
                disabled={!global.quietHoursEnabled}
              />
            </label>

            <label className="form-label">
              Timezone
              <select
                className="form-input"
                value={global.timezone}
                onChange={(event) =>
                  saveGlobal({ ...global, timezone: event.target.value })
                }
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="UTC">UTC</option>
              </select>
            </label>

            <div className="rounded-xl border border-white/10 bg-[#07101b] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-sm">Urgent override</strong>
                  <p className="mt-1 text-xs text-slate-500">
                    Let urgent alerts break quiet hours.
                  </p>
                </div>
                <Switch
                  label="Urgent quiet hours bypass"
                  checked={global.quietUrgentBypass}
                  onChange={(checked) =>
                    saveGlobal({ ...global, quietUrgentBypass: checked })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="eyebrow">Quick presets</div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" type="button" onClick={() => applyPreset("recommended")}>
              Recommended
            </button>
            <button className="button-secondary" type="button" onClick={() => applyPreset("critical_only")}>
              Critical only
            </button>
            <button className="button-secondary" type="button" onClick={() => applyPreset("everything")}>
              Absolutely everything
            </button>
            <button className="button-secondary" type="button" onClick={() => applyPreset("dashboard_only")}>
              Dashboard only
            </button>
          </div>
          {status ? <p className="mt-3 text-sm text-slate-400">{status}</p> : null}
        </div>
      </section>

      <section className="panel">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Granular routing matrix</div>
            <h2 className="text-3xl font-black">Every Notification Type</h2>
          </div>
          <input
            className="form-input max-w-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notification types..."
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {NOTIFICATION_CATEGORIES.map((item) => (
            <button
              key={item.key}
              className={`rounded-xl border px-3 py-2 text-xs font-black ${
                category === item.key
                  ? "border-dusk-aqua/50 bg-dusk-aqua/10"
                  : "border-dusk-line bg-white/[0.025]"
              }`}
              type="button"
              onClick={() => setCategory(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[850px]">
            <div className="grid grid-cols-[1fr_90px_90px_90px_90px] gap-2 border-b border-white/10 px-3 pb-2 text-[10px] font-black uppercase tracking-[.15em] text-slate-600">
              <span>Notification</span>
              <span className="text-center">Inbox</span>
              <span className="text-center">Push</span>
              <span className="text-center">Telegram</span>
              <span className="text-center">Email</span>
            </div>

            <div className="divide-y divide-white/5">
              {visibleTopics.map((topic) => (
                <div
                  key={topic.key}
                  className="grid grid-cols-[1fr_90px_90px_90px_90px] items-center gap-2 px-3 py-4"
                >
                  <div className="pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{topic.label}</strong>
                      <span className="tag !mt-0">{topic.severity}</span>
                      {topic.critical ? (
                        <span className="rounded-full border border-dusk-pink/30 bg-dusk-pink/10 px-2 py-1 text-[9px] font-black uppercase text-dusk-pink">
                          critical
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {topic.description}
                    </p>
                    <code className="mt-1 block text-[10px] text-slate-700">
                      {topic.key}
                    </code>
                  </div>

                  <div className="flex justify-center">
                    <Switch
                      label={`${topic.label} inbox`}
                      checked={topic.dashboardEnabled}
                      onChange={(checked) =>
                        saveTopic(topic, { dashboardEnabled: checked })
                      }
                    />
                  </div>

                  <div className="flex justify-center">
                    <Switch
                      label={`${topic.label} push`}
                      checked={topic.webPushEnabled}
                      disabled={!global.webPushEnabled}
                      onChange={(checked) =>
                        saveTopic(topic, { webPushEnabled: checked })
                      }
                    />
                  </div>

                  <div className="flex justify-center">
                    <Switch
                      label={`${topic.label} Telegram`}
                      checked={topic.telegramEnabled}
                      disabled={!global.telegramEnabled}
                      onChange={(checked) =>
                        saveTopic(topic, { telegramEnabled: checked })
                      }
                    />
                  </div>

                  <div className="flex justify-center">
                    <Switch
                      label={`${topic.label} email`}
                      checked={topic.emailEnabled}
                      disabled={!global.emailEnabled}
                      onChange={(checked) =>
                        saveTopic(topic, { emailEnabled: checked })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
