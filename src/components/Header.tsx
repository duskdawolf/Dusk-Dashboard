import Image from "next/image";
import Link from "next/link";
import { NotificationBell } from "@/components/NotificationBell";

const links = [
  { href: "/chaos", label: "Chaos" },
  { href: "/sticker-factory", label: "Sticker Factory" },
  { href: "/shop", label: "Shop" },
  { href: "/donk-toss", label: "Donk Toss" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-dusk-bg/88 backdrop-blur-xl">
      <div className="mx-auto flex h-[88px] w-[min(1220px,calc(100%-32px))] items-center justify-between gap-4">
        <Link
          href="/"
          className="group flex min-w-0 items-center"
          aria-label="Dusk Industries home"
        >
          <Image
            src="/assets/logo-graffiti.png"
            alt="Dusk Industries — spray-painted IndusKries logo"
            width={1448}
            height={1086}
            priority
            className="h-[74px] w-auto max-w-[220px] object-contain object-left transition duration-300 group-hover:scale-[1.02] sm:max-w-[270px]"
          />
        </Link>

        <nav className="hidden gap-5 text-sm text-slate-400 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <Link
            href="/dashboard"
            className="rounded-xl border border-dusk-aqua/30 bg-dusk-aqua/10 px-3 py-2 text-xs font-bold sm:px-4 sm:text-sm"
          >
            Dusk Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
