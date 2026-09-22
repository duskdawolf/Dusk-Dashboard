"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          "/api/admin/notifications?unreadCount=1",
          { cache: "no-store" },
        );

        if (!response.ok) {
          if (!cancelled) setCount(null);
          return;
        }

        const body = await response.json();
        if (!cancelled) setCount(body.unreadCount ?? 0);
      } catch {
        if (!cancelled) setCount(null);
      }
    }

    load();
    const interval = window.setInterval(load, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // Public visitors / unauthenticated users get a 401 and see no bell.
  if (count == null) return null;

  return (
    <Link
      href="/dashboard/notifications"
      aria-label={`${count} unread Dusk Ops notifications`}
      className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-lg transition hover:border-dusk-aqua/30 hover:bg-dusk-aqua/10"
    >
      <span aria-hidden>🔔</span>
      {count > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full border border-[#07101b] bg-dusk-pink px-1.5 py-0.5 text-[10px] font-black text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
