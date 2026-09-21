import Link from "next/link";

const links = [
  { href: "/chaos", label: "Chaos" },
  { href: "/sticker-factory", label: "Sticker Factory" },
  { href: "/shop", label: "Shop" },
  { href: "/donk-toss", label: "Donk Toss" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-dusk-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] w-[min(1220px,calc(100%-32px))] items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 font-black tracking-[0.05em]">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-dusk-aqua to-dusk-purple text-dusk-bg">🐾</span>
          <span>DUSK INDUSTRIES™</span>
        </Link>
        <nav className="hidden gap-5 text-sm text-slate-400 md:flex">
          {links.map((link) => <Link key={link.href} href={link.href} className="hover:text-white">{link.label}</Link>)}
        </nav>
        <Link href="/dashboard" className="rounded-xl border border-dusk-aqua/30 bg-dusk-aqua/10 px-4 py-2 text-sm font-bold">Dusk Dashboard</Link>
      </div>
    </header>
  );
}
