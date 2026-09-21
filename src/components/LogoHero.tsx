import Image from "next/image";
import Link from "next/link";

export function LogoHero() {
  return (
    <section className="mx-auto grid w-[min(1220px,calc(100%-32px))] gap-10 py-16 lg:grid-cols-[1.02fr_.98fr] lg:items-center">
      <div>
        <div className="eyebrow">A vertically integrated furry conglomerate</div>
        <h1 className="text-5xl font-black leading-[.95] tracking-[-.05em] sm:text-7xl">Corporate polish.<br />Furry vandalism.</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-300">
          Dusk Industries™ operates across convention travel, stickers, events, community infrastructure,
          wolf deployment, and other strategically questionable growth sectors.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link className="button-primary" href="/chaos">Case Studies in Chaos</Link>
          <Link className="button-secondary" href="/shop">Sticker Shop</Link>
        </div>
        <p className="mt-4 text-xs text-slate-600">Not responsible for spontaneous awoos, itinerary escalation, missed sleep, or shareholder fluff.</p>
      </div>
      <div className="panel">
        <Image src="/assets/logo-graffiti.png" alt="Dusk spraying a K over the T in Industries" width={1400} height={1000} priority className="h-auto w-full" />
        <p className="mt-3 text-sm text-slate-400"><strong className="text-white">INDUSKRIES™</strong> — unauthorized but management-approved rebranding.</p>
      </div>
    </section>
  );
}
