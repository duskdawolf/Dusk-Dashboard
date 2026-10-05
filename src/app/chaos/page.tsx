import { ChaosArchiveCard } from "@/components/ChaosArchiveCard";
import Link from "next/link";
import { getChaosArchive } from "@/lib/repository";

export const metadata = { title: "Case Studies in Chaos" };
export const dynamic = "force-dynamic";

export default async function ChaosPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawTag = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  const activeTag = rawTag?.trim() ?? "";

  const archive = await getChaosArchive();

  const filteredArchive = activeTag
    ? archive.filter((item) => {
        const needle = activeTag.toLowerCase();

        return [
          item.event.tag,
          item.event.eventType,
          item.event.quarter.toUpperCase(),
        ].some(
          (value) =>
            String(value ?? "")
              .trim()
              .toLowerCase() === needle,
        );
      })
    : archive;

  const completed = filteredArchive.filter(
    (item) =>
      new Date(item.event.endAt ?? item.event.startAt).getTime() < Date.now(),
  );
  const upcoming = filteredArchive.filter(
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

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <span className="tag !mt-0">
          {activeTag
            ? `${filteredArchive.length} matching ${activeTag}`
            : `${archive.length} total deployments`}
        </span>
        <span className="tag !mt-0">{completed.length} completed</span>
        <span className="tag !mt-0">{upcoming.length} future chaos</span>

        {activeTag ? (
          <Link
            href="/chaos"
            className="rounded-full border border-dusk-aqua/20 bg-dusk-aqua/5 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-dusk-aqua transition hover:bg-dusk-aqua/10"
          >
            Clear filter ×
          </Link>
        ) : null}
      </div>

      {activeTag && filteredArchive.length === 0 ? (
        <section className="panel mt-10">
          <div className="eyebrow">Evidence search</div>
          <h2 className="text-2xl font-black">
            No incident reports match “{activeTag}”.
          </h2>
          <p className="mt-3 text-slate-400">
            Try another incident-report tag or clear the filter to reopen the
            entire corporate evidence locker.
          </p>
          <Link href="/chaos" className="button-secondary mt-5 inline-flex">
            CLEAR FILTER →
          </Link>
        </section>
      ) : null}

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
