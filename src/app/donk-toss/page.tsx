import { DonkHero } from "@/components/DonkHero";

export const metadata = { title: "Donk Toss" };

export default function DonkTossPage() {
  return (
    <main className="mx-auto w-[min(1220px,calc(100%-32px))] py-16">
      <DonkHero />
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="panel">
          <div className="eyebrow">Project definition</div>
          <h2 className="text-3xl font-black">What it is</h2>
          <p className="mt-4 text-slate-400">A ridiculous idea turned into an actual convention experience through rules, scoring, signage, prizes, hosting, and Dusk-grade stage presence.</p>
          <div className="mt-5 space-y-3">
            <div className="card"><strong>All-ages mode</strong><p className="mt-1 text-sm text-slate-400">Cheeky, goofy, approachable, and convention-friendly.</p></div>
            <div className="card"><strong>Signature rule</strong><p className="mt-1 text-sm text-slate-400">Immaculate Donk clears the board on throw two; on throw one, it stays.</p></div>
          </div>
        </section>
        <section className="panel">
          <div className="eyebrow">Operations board</div>
          <h2 className="text-3xl font-black">Roadmap</h2>
          <div className="mt-5 space-y-3">
            {["Rules & scoring", "Signage & safety", "Prize lane", "Convention expansion"].map((item, i) => (
              <div className="card flex items-center justify-between gap-3" key={item}><strong>{item}</strong><span className="tag !mt-0">{["Active","Next","Planned","Future"][i]}</span></div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
