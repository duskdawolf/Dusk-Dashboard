"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/events", label: "Events" },
  { href: "/dashboard/media", label: "Media" },
  { href: "/dashboard/posts", label: "Posts" },
  { href: "/dashboard/con-prep", label: "Con Prep" },
  { href: "/dashboard/notifications", label: "Notifications" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {links.map((link) => {
        const active =
          link.href === "/dashboard"
            ? pathname === link.href
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-xl border px-4 py-2 text-sm font-black ${
              active
                ? "border-dusk-aqua/40 bg-dusk-aqua/10 text-white"
                : "border-dusk-line bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
