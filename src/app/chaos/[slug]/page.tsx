import Link from "next/link";
import { notFound } from "next/navigation";
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
  if (formatter.format(start) === formatter.format(end)) return formatter.format(start);
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

type MetricTotals = {
  reach: number;
  engagements: number;
};

function metricTotal(post: {
  platforms: {
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    reach?: number;
    impressions?: number;
  }[];
}): MetricTotals {
  return post.platforms.reduce<MetricTotals>(
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

export default async function IncidentReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const report = await getIncidentReport(slug);

  if (!report) notFound();

  const { event, caseStudy, media, posts } = report;

  return (
    <main className="mx-auto w-[min(1220px,calc(100%-32px))] py-14">
      <Link href="/#travel-map" className="text-sm font-black text-dusk-aqua">
        ← RETURN TO GEOGRAPHIC CHAOS
      </Link>

      <div className="mt-8 grid gap-7 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <div className="eyebrow">Dusk Industries Incident Report</div>
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
            <span className="tag !mt-0">{event.tag}</span>
            <span className="tag !mt-0">{event.eventType}</span>
            <span className="tag !mt-0">{event.quarter.toUpperCase()}</span>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">Official corporate finding</div>
          <div className="mt-2 text-4xl font-black text-dusk-pink">
            CHAOS SUBSTANTIATED.
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Supporting photographic evidence, social-media receipts, and
            questionable operational decisions are archived below.
          </p>
        </div>
      </div>

      {caseStudy ? (
        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          <div className="card">
            <div className="eyebrow">The Assignment</div>
            <h2 className="mt-2 text-xl font-black">{caseStudy.challenge}</h2>
          </div>
          <div className="card">
            <div className="eyebrow">The Extremely Professional Response</div>
            <h2 className="mt-2 text-xl font-black">{caseStudy.solution}</h2>
          </div>
          <div className="card">
            <div className="eyebrow">Damage Report</div>
            <h2 className="mt-2 text-xl font-black">{caseStudy.outcome}</h2>
          </div>
        </section>
      ) : (
        <section className="panel mt-10">
          <div className="eyebrow">Case study status</div>
          <h2 className="text-2xl font-black">Incident report opened. Corporate analysis pending.</h2>
          <p className="mt-3 text-slate-400">
            This event already has a permanent incident-report URL. Add a formal
            Case Study in Chaos later and the challenge / response / damage report
            will appear here automatically.
          </p>
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
                    <p className="mt-1 text-sm text-slate-400">{item.caption}</p>
                  ) : null}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="panel mt-6 text-slate-400">
            No associated public media yet. Upload photos/videos in Dusk Dashboard
            and attach them to this event; they will populate here automatically.
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
            No published posts are associated with this event yet. Once the social
            pipeline publishes and records the platform posts, they will appear
            here with links and analytics.
          </div>
        )}
      </section>

      <section className="mt-12 border-t border-white/5 pt-8">
        <Link href="/chaos" className="button-secondary">
          BROWSE ALL CASE STUDIES IN CHAOS →
        </Link>
      </section>
    </main>
  );
}
