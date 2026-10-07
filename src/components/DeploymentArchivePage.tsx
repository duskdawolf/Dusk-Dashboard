import Link from "next/link";
import { DeploymentArchiveCard } from "@/components/DeploymentArchiveCard";
import {
  getDeploymentArchive,
  type DeploymentArchiveMode,
} from "@/lib/deployment-archive";

export async function DeploymentArchivePage({
  mode,
  tag,
}: {
  mode: DeploymentArchiveMode;
  tag: string;
}) {
  const items = await getDeploymentArchive(mode, tag);

  const isFuture = mode === "future";

  return (
    <main className="mx-auto w-[min(1220px,calc(100%-32px))] py-16">
      <div className="eyebrow">
        {isFuture
          ? "Forward operations"
          : "Historical evidence locker"}
      </div>

      <h1 className="text-5xl font-black tracking-[-.05em] sm:text-6xl">
        {isFuture
          ? "Tactical Deployment Plans."
          : "Case Studies in Chaos."}
      </h1>

      <p className="mt-5 max-w-3xl text-lg text-slate-400">
        {isFuture
          ? "Upcoming Dusk deployments, appearances, and furry-event operations. Each record automatically moves to the historical archive after the deployment ends."
          : "Completed Dusk deployments, photographic evidence, social receipts, and formal corporate findings."}
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <span className="tag !mt-0">
          {items.length} {isFuture ? "future" : "past"} deployment
          {items.length === 1 ? "" : "s"}
        </span>

        {tag ? (
          <>
            <span className="tag !mt-0">{tag}</span>
            <Link
              href={`/deployments/${mode}`}
              className="rounded-full border border-dusk-aqua/20 bg-dusk-aqua/5 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-dusk-aqua"
            >
              Clear filter ×
            </Link>
          </>
        ) : null}
      </div>

      {items.length ? (
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {items.map((item) => (
            <DeploymentArchiveCard
              key={item.event.id}
              item={item}
              mode={mode}
            />
          ))}
        </div>
      ) : (
        <section className="panel mt-10">
          <div className="eyebrow">No matching deployments</div>
          <h2 className="text-2xl font-black">
            {tag
              ? `Nothing here matches “${tag}”.`
              : isFuture
                ? "No future deployments are currently published."
                : "No completed deployments are currently published."}
          </h2>
          {tag ? (
            <Link
              href={`/deployments/${mode}`}
              className="button-secondary mt-5 inline-flex"
            >
              CLEAR FILTER →
            </Link>
          ) : null}
        </section>
      )}
    </main>
  );
}
