"use client";

import { FormEvent, useState } from "react";

type EventOption = { id: string; title: string };
type PostRow = {
  id: string;
  event_id: string | null;
  title: string;
  master_caption: string;
  status: string;
  scheduled_at: string | null;
  approved_at: string | null;
  automation_status: string | null;
  created_at: string;
  post_platforms?: {
    id: string;
    platform: string;
    status: string;
    post_url: string | null;
    published_at: string | null;
    post_metrics?: {
      impressions: number | null;
      reach: number | null;
      likes: number | null;
      comments: number | null;
      shares: number | null;
      saves: number | null;
      clicks: number | null;
      video_views: number | null;
    }[];
  }[];
};

const PLATFORMS = ["telegram", "twitter", "instagram", "snapchat"];

export function PostManager({
  initialPosts,
  events,
}: {
  initialPosts: PostRow[];
  events: EventOption[];
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [status, setStatus] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/posts", { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setPosts(body.posts ?? []);
    else setStatus(body.error ?? "Could not refresh posts.");
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const platforms = PLATFORMS.filter(
      (platform) => formData.get(`platform-${platform}`) === "on"
    );

    const response = await fetch("/api/admin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(formData.get("title") ?? ""),
        masterCaption: String(formData.get("masterCaption") ?? ""),
        eventId: String(formData.get("eventId") ?? "") || null,
        scheduledAt: String(formData.get("scheduledAt") ?? "") || null,
        status: String(formData.get("status") ?? "draft"),
        platforms,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatus(body.detail ?? body.error ?? "Could not create post.");
      return;
    }

    setStatus("Post saved.");
    form.reset();
    await refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[410px_1fr]">
      <section className="panel self-start xl:sticky xl:top-28">
        <div className="eyebrow">Social publishing</div>
        <h2 className="text-2xl font-black">New Post</h2>
        <p className="mt-2 text-sm text-slate-400">
          This stores the approved content plan. Make will later take scheduled
          records and push them to each platform.
        </p>

        <form onSubmit={create} className="mt-5 space-y-4">
          <label className="form-label">
            Internal title
            <input className="form-input" name="title" required />
          </label>

          <label className="form-label">
            Related event
            <select className="form-input" name="eventId" defaultValue="">
              <option value="">No event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>

          <label className="form-label">
            Master caption
            <textarea
              className="form-input min-h-40"
              name="masterCaption"
              required
            />
          </label>

          <div>
            <div className="mb-2 text-sm font-bold">Platforms</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {PLATFORMS.map((platform) => (
                <label key={platform} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={`platform-${platform}`}
                    defaultChecked={platform !== "snapchat"}
                  />
                  <span className="capitalize">{platform}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="form-label">
            Status
            <select className="form-input" name="status" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </label>

          <label className="form-label">
            Scheduled time
            <input
              className="form-input"
              name="scheduledAt"
              placeholder="2026-09-25T19:30:00-04:00"
            />
          </label>

          <button className="button-primary" type="submit">
            Save post
          </button>

          {status ? <p className="text-sm text-slate-400">{status}</p> : null}
        </form>
      </section>

      <section>
        <div className="eyebrow">Publishing queue & performance</div>
        <h2 className="text-3xl font-black">Posts</h2>

        <div className="mt-5 space-y-4">
          {posts.map((post) => {
            const metrics = (post.post_platforms ?? []).flatMap(
              (platform) => platform.post_metrics ?? []
            );
            const totalReach = metrics.reduce(
              (sum, metric) => sum + (metric.reach ?? metric.impressions ?? 0),
              0
            );
            const engagements = metrics.reduce(
              (sum, metric) =>
                sum +
                (metric.likes ?? 0) +
                (metric.comments ?? 0) +
                (metric.shares ?? 0) +
                (metric.saves ?? 0),
              0
            );

            return (
              <article key={post.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="tag !mt-0">{post.status}</span>
                      {(post.post_platforms ?? []).map((platform) => (
                        <span key={platform.id} className="tag !mt-0">
                          {platform.platform}
                        </span>
                      ))}
                    </div>

                    <h3 className="mt-3 text-xl font-black">{post.title}</h3>
                    <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-slate-300">
                      {post.master_caption}
                    </p>

                    {post.scheduled_at ? (
                      <p className="mt-3 text-xs text-slate-500">
                        Scheduled: {new Date(post.scheduled_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid min-w-[160px] grid-cols-2 gap-2">
                    <div className="rounded-xl border border-dusk-line bg-white/[0.03] p-3">
                      <div className="text-xs uppercase text-slate-500">Reach</div>
                      <strong className="text-xl text-dusk-aqua">
                        {totalReach || "—"}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-dusk-line bg-white/[0.03] p-3">
                      <div className="text-xs uppercase text-slate-500">
                        Engagements
                      </div>
                      <strong className="text-xl text-dusk-pink">
                        {engagements || "—"}
                      </strong>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
