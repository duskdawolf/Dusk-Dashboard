import Link from "next/link";
import { LogoHero } from "@/components/LogoHero";
import { EventCard } from "@/components/EventCard";
import { SocialLinks } from "@/components/SocialLinks";
import { DonkHero } from "@/components/DonkHero";
import { PawprintMap } from "@/components/PawprintMap";
import { getEvents, getSocialLinks } from "@/lib/repository";

export default async function HomePage() {
  const [events, socials] = await Promise.all([getEvents(), getSocialLinks()]);
  const upcoming = events.filter((event) => new Date(event.startAt) >= new Date("2026-09-20T00:00:00-04:00"));

  return (
    <main>
      <LogoHero />

      <section className="mx-auto w-[min(1220px,calc(100%-32px))] py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div><div className="eyebrow">Forward-looking statements</div><h2 className="text-4xl font-black">Upcoming Deployments</h2></div>
          <p className="max-w-2xl text-slate-400">Rendered from the repository layer. When Supabase is configured, this stops being hardcoded automatically.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{upcoming.map((event) => <EventCard key={event.id} event={event} />)}</div>
      </section>

      <section className="mx-auto w-[min(1220px,calc(100%-32px))] py-16">
        <div className="mb-8"><div className="eyebrow">Logistics & expansion</div><h2 className="text-4xl font-black">Pawprint Expansion Map</h2></div>
        <PawprintMap events={events} />
      </section>

      <section className="mx-auto w-[min(1220px,calc(100%-32px))] py-16">
        <div className="mb-8"><div className="eyebrow">Direct channels</div><h2 className="text-4xl font-black">Find Dusk Everywhere</h2></div>
        <SocialLinks links={socials} />
      </section>

      <section className="mx-auto w-[min(1220px,calc(100%-32px))] py-16">
        <div className="mb-8"><div className="eyebrow">Special projects</div><h2 className="text-4xl font-black">Donk Toss</h2></div>
        <DonkHero />
        <Link href="/donk-toss" className="button-primary mt-5">Open Donk Toss Operations</Link>
      </section>

      <section className="mx-auto w-[min(1220px,calc(100%-32px))] py-16">
        <div className="panel flex flex-wrap items-center justify-between gap-5">
          <div><div className="eyebrow">Backend direction</div><h2 className="text-3xl font-black">Dusk Dashboard</h2><p className="mt-2 text-slate-400">A real Node/Next foundation is now in place, with a Supabase-ready repository layer and schema.</p></div>
          <Link className="button-secondary" href="/dashboard">Open Dashboard</Link>
        </div>
      </section>
    </main>
  );
}
