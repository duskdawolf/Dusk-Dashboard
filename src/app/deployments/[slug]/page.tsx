import { DeploymentImage } from "@/components/convention-directory/DeploymentImage";
import { ConventionInformation } from "@/components/convention-directory/ConventionInformation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeploymentFilterLink } from "@/components/DeploymentFilterLink";
import { buildWhereToFindDusk } from "@/lib/alpha31/where-to-find-dusk";
import { getIncidentReport } from "@/lib/incident-report";

function dateLabel(startAt: string, endAt?: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const start = new Date(startAt);
  if (!endAt) return formatter.format(start);

  const end = new Date(endAt);

  return formatter.format(start) === formatter.format(end)
    ? formatter.format(start)
    : `${formatter.format(start)} – ${formatter.format(end)}`;
}

function metricTotal(post: {
  platforms: {
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    reach?: number;
    impressions?: number;
  }[];
}) {
  return post.platforms.reduce<{
    reach: number;
    engagements: number;
  }>(
    (totals, platform) => ({
      reach: totals.reach + (platform.reach ?? platform.impressions ?? 0),
      engagements:
        totals.engagements +
        (platform.likes ?? 0) +
        (platform.comments ?? 0) +
        (platform.shares ?? 0) +
        (platform.saves ?? 0),
    }),
    { reach: 0, engagements: 0 },
  );
}

export default async function DeploymentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const report = await getIncidentReport(slug);

  if (!report) notFound();

  const { event, caseStudy, media, posts, lifecycle } = report;
  const mode = lifecycle === "case_study" ? "past" : "future";

  let whereToFind: string[] = [];

  if (lifecycle === "deployment") {
    try {
      whereToFind = (await buildWhereToFindDusk(event.id)).publicLines;
    } catch {
      whereToFind = [];
    }
  }

  return (
    <main className="mx-auto w-[min(1220px,calc(100%-32px))] py-14">
      <Link
        href={`/deployments/${mode}`}
        className="text-sm font-black text-dusk-aqua"
      >
        ←{" "}
        {lifecycle === "case_study"
          ? "BACK TO CASE STUDIES"
          : "BACK TO TACTICAL DEPLOYMENT PLANS"}
      </Link>

      <DeploymentImage
        images={event.imageCandidates}
        alt={event.title}
        className="mt-8 max-h-[480px] w-full rounded-3xl object-cover"
      />
      {event.convention ? (
        <div className="mt-6">
          <ConventionInformation edition={event.convention} />
        </div>
      ) : null}
      <div className="mt-8 grid gap-7 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <div className="eyebrow">
            {lifecycle === "case_study"
              ? "Dusk Industries Case Study"
              : "Dusk Industries Tactical Deployment Plan"}
          </div>

          <h1 className="mt-2 text-5xl font-black tracking-[-.05em] sm:text-7xl">
            {event.title}
          </h1>

          <p className="mt-5 text-lg font-bold text-slate-300">
            {dateLabel(event.startAt, event.endAt)}
            {event.location ? ` • ${event.location}` : ""}
          </p>

          <p className="mt-5 max-w-3xl text-lg text-slate-400">
            {event.description}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <DeploymentFilterLink mode={mode} value={event.tag} />
            <DeploymentFilterLink mode={mode} value={event.eventType} />
            <DeploymentFilterLink
              mode={mode}
              value={event.quarter.toUpperCase()}
            />
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">
            {lifecycle === "case_study"
              ? "Deployment lifecycle"
              : "Operational state"}
          </div>

          <div className="mt-2 text-4xl font-black text-dusk-pink">
            {lifecycle === "case_study"
              ? "DEPLOYMENT COMPLETE."
              : "CHAOS PENDING."}
          </div>

          <p className="mt-3 text-sm text-slate-400">
            {lifecycle === "case_study"
              ? "This deployment has moved into the historical Case Studies in Chaos archive."
              : "This plan remains in the Future archive until the event ends, then transitions automatically into its Case Study."}
          </p>
        </div>
      </div>

      {lifecycle === "deployment" ? (
        <section className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="panel">
            <div className="eyebrow">Tactical brief</div>
            <h2 className="text-3xl font-black">Deployment Plan</h2>
            <p className="mt-4 leading-7 text-slate-400">
              This is the public forward-looking record for the deployment.
              Operational planning remains live until the event concludes.
            </p>
          </div>

          <div className="panel">
            <div className="eyebrow">Public appearance data</div>
            <h2 className="text-2xl font-black">Where to Find Dusk</h2>

            {whereToFind.length ? (
              <div className="mt-4 grid gap-2">
                {whereToFind.map((line, index) => (
                  <div
                    key={`${line}-${index}`}
                    className="rounded-xl border border-white/5 bg-white/[0.025] p-3 text-sm text-slate-300"
                  >
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                Public appearance details have not been posted yet.
              </p>
            )}
          </div>
        </section>
      ) : (
        <>
          {caseStudy ? (
            <section className="mt-10 grid gap-4 lg:grid-cols-3">
              <div className="card">
                <div className="eyebrow">The Assignment</div>
                <h2 className="mt-2 text-xl font-black">
                  {caseStudy.challenge}
                </h2>
              </div>
              <div className="card">
                <div className="eyebrow">
                  The Extremely Professional Response
                </div>
                <h2 className="mt-2 text-xl font-black">
                  {caseStudy.solution}
                </h2>
              </div>
              <div className="card">
                <div className="eyebrow">Damage Report</div>
                <h2 className="mt-2 text-xl font-black">{caseStudy.outcome}</h2>
              </div>
            </section>
          ) : (
            <section className="panel mt-10">
              <div className="eyebrow">Case study status</div>
              <h2 className="text-2xl font-black">
                Deployment complete. Corporate analysis pending.
              </h2>
            </section>
          )}

          <section className="mt-12">
            <div className="eyebrow">Exhibit A</div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-4xl font-black">Photographic Evidence</h2>
              <span className="tag !mt-0">{media.length} archived files</span>
            </div>

            {media.length ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {media.map((item) => (
                  <figure key={item.id} className="card overflow-hidden">
                    <div className="aspect-square overflow-hidden rounded-2xl bg-black/30">
                      {item.kind === "image" ? (
                        <img
                          src={item.url}
                          alt={item.altText ?? item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <video
                          src={item.url}
                          controls
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <figcaption className="mt-3">
                      <strong>{item.title}</strong>
                      {item.caption ? (
                        <p className="mt-1 text-sm text-slate-400">
                          {item.caption}
                        </p>
                      ) : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="panel mt-6 text-slate-400">
                No public media has been attached yet.
              </div>
            )}
          </section>

          <section className="mt-12">
            <div className="eyebrow">Exhibit B</div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-4xl font-black">Social Media Receipts</h2>
              <span className="tag !mt-0">{posts.length} published posts</span>
            </div>

            {posts.length ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {posts.map((post) => {
                  const totals = metricTotal(post);

                  return (
                    <article key={post.id} className="card">
                      <h3 className="text-xl font-black">{post.title}</h3>

                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">
                        {post.caption}
                      </p>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                          <div className="text-xs uppercase tracking-wider text-slate-500">
                            Reach
                          </div>
                          <strong className="text-2xl text-dusk-aqua">
                            {totals.reach || "—"}
                          </strong>
                        </div>

                        <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                          <div className="text-xs uppercase tracking-wider text-slate-500">
                            Engagements
                          </div>
                          <strong className="text-2xl text-dusk-pink">
                            {totals.engagements || "—"}
                          </strong>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {post.platforms.map((platform) =>
                          platform.url ? (
                            <a
                              key={platform.platform}
                              href={platform.url}
                              target="_blank"
                              rel="noreferrer"
                              className="button-secondary"
                            >
                              {platform.platform} ↗
                            </a>
                          ) : (
                            <span key={platform.platform} className="tag !mt-0">
                              {platform.platform}
                            </span>
                          ),
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="panel mt-6 text-slate-400">
                No published social receipts are associated with this deployment
                yet.
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
