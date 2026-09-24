import Link from "next/link";
import { ChaosCopilot } from "@/components/ChaosCopilot";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Dusk Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createAdminSupabaseClient();

  const [
    { count: eventCount },
    { count: mediaCount },
    { count: postCount },
    { count: prepCount },
  ] = await Promise.all([
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("media").select("*", { count: "exact", head: true }),
    supabase.from("posts").select("*", { count: "exact", head: true }),
    supabase.from("con_preps").select("*", { count: "exact", head: true }),
  ]);

  const modules = [
    {
      href: "/dashboard/events",
      title: "Events",
      value: eventCount ?? 0,
      text: "Source of truth for deployments, map points, schedules, and future Make sync.",
    },
    {
      href: "/dashboard/media",
      title: "Media",
      value: mediaCount ?? 0,
      text: "Upload photos/video to Supabase Storage and associate them with events.",
    },
    {
      href: "/dashboard/posts",
      title: "Posts",
      value: postCount ?? 0,
      text: "Draft, approve, schedule, publish, and eventually analyze social content.",
    },
    {
      href: "/dashboard/con-prep",
      title: "Convention Ops",
      value: prepCount ?? 0,
      text: "Deploy conventions, build nested packing/loadouts, plan travel, production, readiness, and Tactical Deployment Plans.",
    },
  ];

  return (
    <section className="space-y-6">
      <ChaosCopilot contextType="global" />

      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="card transition hover:-translate-y-1 hover:border-dusk-aqua/30"
          >
            <div className="eyebrow">{module.title}</div>
            <div className="text-5xl font-black text-dusk-aqua">
              {module.value}
            </div>
            <p className="mt-3 text-sm text-slate-400">{module.text}</p>
          </Link>
        ))}
      </div>

      <div className="panel">
        <div className="eyebrow">Automation architecture</div>
        <h2 className="text-2xl font-black">One record, many destinations.</h2>
        <p className="mt-3 max-w-4xl text-slate-400">
          v26 Alpha makes Chaos Copilot™ the natural-language operations layer
          over the same typed Dusk tools used by the dashboard. Supabase remains
          the source of truth; AI changes are proposed for approval instead of
          writing arbitrary database state.
        </p>
      </div>
    </section>
  );
}
