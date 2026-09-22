import { ChaosArchiveCard } from "@/components/ChaosArchiveCard";
import { getChaosArchive } from "@/lib/repository";

export const metadata = { title: "Case Studies in Chaos" };
export const dynamic = "force-dynamic";

export default async function ChaosPage() {
  const archive = await getChaosArchive();

  const completed = archive.filter(
    (item) =>
      new Date(item.event.endAt ?? item.event.startAt).getTime() < Date.now(),
  );
  const upcoming = archive.filter(
    (item) =>
      new Date(item.event.endAt ?? item.event.startAt).getTime() >= Date.now(),
  );

  return (
    <main className="mx-auto w-[min(1220px,calc(100%-32px))] py-16">
      <div className="eyebrow">Corporate evidence locker</div>
      <h1 className="text-6xl font-black tracking-[-.05em]">
        Case Studies in Chaos.
      </h1>
      <p className="mt-5 max-w-3xl text-lg text-slate-400">
        Every published Dusk deployment now enters the archive automatically.
        Photos, social receipts, analytics, and formal corporate findings attach
        themselves to the same event record as evidence accumulates.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <span className="tag !mt-0">{archive.length} total deployments</span>
        <span className="tag !mt-0">{completed.length} completed</span>
        <span className="tag !mt-0">{upcoming.length} future chaos</span>
      </div>

      {upcoming.length ? (
        <section className="mt-12">
          <div className="eyebrow">Forward-looking liabilities</div>
          <h2 className="text-3xl font-black">Chaos Pending</h2>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {upcoming.map((item) => (
              <ChaosArchiveCard key={item.event.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12">
        <div className="eyebrow">Historical record</div>
        <h2 className="text-3xl font-black">Documented Incidents</h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {completed.map((item) => (
            <ChaosArchiveCard key={item.event.id} item={item} />
          ))}
        </div>
      </section>
    </main>
  );
}
