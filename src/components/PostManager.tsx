"use client";

import { FormEvent, useMemo, useState } from "react";
import { deploymentDocumentLabel, deploymentDocumentUrl } from "@/lib/social/deployment-link";

type PlatformName = "telegram" | "twitter" | "instagram" | "bluesky" | "snapchat";
type PostStatus = "draft" | "approved" | "scheduled" | "published" | "failed";

type EventOption = {
  id: string;
  title: string;
  slug: string;
  start_at: string;
};

type MediaOption = {
  id: string;
  title: string;
  kind: "image" | "video";
  url: string;
  mime_type?: string | null;
  event_id: string | null;
  published: boolean;
  sort_order: number;
};

type MetricRow = {
  captured_at?: string;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  video_views: number | null;
};

type PlatformRow = {
  id: string;
  platform: PlatformName;
  platform_caption_override: string | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  post_url: string | null;
  last_error: string | null;
  attempt_count: number;
  provider_account?: string | null;
  published_caption?: string | null;
  published_media?: unknown[];
  provider_response?: Record<string, unknown>;
  post_metrics?: MetricRow[];
};

type PostMediaRow = {
  id: string;
  sort_order: number;
  media: MediaOption | null;
};

type PostRow = {
  id: string;
  event_id: string | null;
  title: string;
  master_caption: string;
  include_deployment_link?: boolean;
  status: PostStatus;
  scheduled_at: string | null;
  approved_at: string | null;
  automation_status: string | null;
  created_at: string;
  events?: EventOption | null;
  post_media?: PostMediaRow[];
  post_platforms?: PlatformRow[];
};

const PLATFORM_META: Record<
  PlatformName,
  { label: string; note: string; live: boolean }
> = {
  telegram: {
    label: "Telegram",
    note: "LIVE · text, photo, video, albums",
    live: true,
  },
  twitter: {
    label: "X",
    note: "LIVE · OAuth 2.0 · text, up to 4 photos, 1 video/GIF",
    live: true,
  },
  instagram: {
    label: "Instagram",
    note: "LIVE · photos, Reels, 2–10 item carousels",
    live: true,
  },
  bluesky: {
    label: "Bluesky",
    note: "LIVE in v25.3 · text + up to 4 images",
    live: true,
  },
  snapchat: {
    label: "Snapchat",
    note: "Draft/Approved only · integration postponed",
    live: false,
  },
};

const PLATFORMS = Object.keys(PLATFORM_META) as PlatformName[];

function platformLabel(platform: PlatformName) {
  return PLATFORM_META[platform].label;
}

function toIso(local: string) {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function latestMetric(platform: PlatformRow) {
  return [...(platform.post_metrics ?? [])].sort((a, b) => {
    const left = new Date(a.captured_at ?? 0).getTime();
    const right = new Date(b.captured_at ?? 0).getTime();
    return right - left;
  })[0];
}

function aggregateMetrics(post: PostRow) {
  let reach = 0;
  let engagements = 0;
  let views = 0;

  for (const platform of post.post_platforms ?? []) {
    const metric = latestMetric(platform);
    if (!metric) continue;

    reach += metric.reach ?? metric.impressions ?? 0;
    engagements +=
      (metric.likes ?? 0) +
      (metric.comments ?? 0) +
      (metric.shares ?? 0) +
      (metric.saves ?? 0);
    views += metric.video_views ?? 0;
  }

  return { reach, engagements, views };
}

function PreviewCard({
  platform,
  caption,
  media,
}: {
  platform: PlatformName;
  caption: string;
  media: MediaOption[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#07101b] p-4">
      <div className="flex items-center justify-between gap-3">
        <strong>{platformLabel(platform)}</strong>
        <span className="text-[10px] font-black uppercase tracking-[.16em] text-slate-600">
          Preview
        </span>
      </div>

      {media.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {media.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="aspect-square overflow-hidden rounded-xl bg-black/30"
            >
              {item.kind === "image" ? (
                <img
                  src={item.url}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <video
                  src={item.url}
                  muted
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-3 max-h-36 overflow-hidden whitespace-pre-wrap text-sm text-slate-300">
        {caption || "Caption preview will appear here."}
      </p>
    </div>
  );
}

export function PostManager({
  initialPosts,
  events,
  media,
  initialEventId,
  initialMediaId,
}: {
  initialPosts: PostRow[];
  events: EventOption[];
  media: MediaOption[];
  initialEventId: string;
  initialMediaId: string;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [statusMessage, setStatusMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [eventId, setEventId] = useState(initialEventId);
  const [includeDeploymentLink, setIncludeDeploymentLink] = useState(false);
  const [title, setTitle] = useState("");
  const [masterCaption, setMasterCaption] = useState("");
  const [postStatus, setPostStatus] = useState<
    "draft" | "approved" | "scheduled"
  >("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformName[]>([
    "telegram",
  ]);
  const [captionOverrides, setCaptionOverrides] = useState<
    Partial<Record<PlatformName, string>>
  >({});
  const [mediaIds, setMediaIds] = useState<string[]>(
    initialMediaId ? [initialMediaId] : []
  );

  const eventMedia = useMemo(
    () =>
      media.filter(
        (item) =>
          !eventId ||
          item.event_id === eventId ||
          mediaIds.includes(item.id)
      ),
    [media, eventId, mediaIds]
  );

  const selectedMedia = mediaIds
    .map((id) => media.find((item) => item.id === id))
    .filter(Boolean) as MediaOption[];

  const selectedEvent =
    events.find((event) => event.id === eventId) ?? null;

  const deploymentSuffix =
    includeDeploymentLink && selectedEvent
      ? `\n\n${deploymentDocumentLabel(selectedEvent)}: ${deploymentDocumentUrl(
          selectedEvent,
        )}`
      : "";

  function finalCaption(platform: PlatformName) {
    return `${
      captionOverrides[platform]?.trim() || masterCaption.trim()
    }${deploymentSuffix}`;
  }

  function graphemeLength(value: string) {
    const Segmenter = (Intl as any).Segmenter;

    if (Segmenter) {
      return Array.from(
        new Segmenter(undefined, { granularity: "grapheme" }).segment(value),
      ).length;
    }

    return Array.from(value).length;
  }

  const scheduleIssues = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (postStatus !== "scheduled") {
      return { errors, warnings };
    }

    const liveSelected = selectedPlatforms.filter(
      (platform) => PLATFORM_META[platform].live,
    );

    if (!liveSelected.length) {
      errors.push(
        "Choose at least one live provider before scheduling. Telegram, X, and Instagram are live in v25.2.",
      );
    }

    for (const platform of selectedPlatforms) {
      if (!PLATFORM_META[platform].live) {
        warnings.push(
          `${PLATFORM_META[platform].label} will stay staged as Approved while the live provider(s) publish. Its caption/media variant is preserved for the upcoming provider release.`,
        );
      }
    }

    if (selectedPlatforms.includes("telegram")) {
      const telegramCaption = finalCaption("telegram");

      if (telegramCaption.length > 4096) {
        errors.push(
          `Telegram text is ${telegramCaption.length} characters; maximum is 4096.`,
        );
      }

      if (selectedMedia.length > 10) {
        errors.push(
          `Telegram accepts at most 10 media items in one v25.2 publishing job.`,
        );
      }

      if (selectedMedia.length > 0 && telegramCaption.length > 1024) {
        warnings.push(
          "Telegram media captions are limited to 1024 characters. Dusk will publish the media first and your full caption as a separate message.",
        );
      }
    }

    if (selectedPlatforms.includes("twitter")) {
      const xCaption = finalCaption("twitter");
      const xLimit = 280;
      if (xCaption.length > xLimit) {
        errors.push(
          `X caption is ${xCaption.length} characters. v25.2 defaults to ${xLimit}; set X_MAX_POST_CHARS in Vercel only if the connected posting account supports a higher API limit.`,
        );
      }
      const xVideos = selectedMedia.filter((item) => item.kind === "video");
      const xGifs = selectedMedia.filter((item) => item.mime_type?.toLowerCase() === "image/gif");
      const xStillImages = selectedMedia.filter((item) => item.kind === "image" && !xGifs.includes(item));
      if (xVideos.length > 1) errors.push("X accepts at most one video per Post.");
      if (xGifs.length > 1) errors.push("X accepts at most one animated GIF per Post.");
      if ((xVideos.length || xGifs.length) && selectedMedia.length > 1) {
        errors.push("X cannot mix a video or animated GIF with other attached media in one Post.");
      }
      if (xStillImages.length > 4) errors.push("X accepts at most four photos per Post.");
    }
    if (selectedPlatforms.includes("instagram")) {
      const instagramCaption = finalCaption("instagram");

      if (!selectedMedia.length) {
        errors.push("Instagram requires at least one photo or video.");
      }

      if (selectedMedia.length > 10) {
        errors.push("Instagram carousels support at most 10 media items.");
      }

      if (instagramCaption.length > 2200) {
        errors.push(
          `Instagram caption is ${instagramCaption.length} characters; maximum is 2200.`,
        );
      }

      const unsupportedImages = selectedMedia.filter((item) => {
        if (item.kind !== "image") return false;
        const mime = item.mime_type?.toLowerCase();
        if (mime) return mime !== "image/jpeg" && mime !== "image/jpg";
        return !/\.(jpe?g)(?:\?|#|$)/i.test(item.url);
      });

      if (unsupportedImages.length) {
        errors.push(
          `Instagram API feed publishing requires JPEG images. Convert: ${unsupportedImages
            .map((item) => item.title)
            .join(", ")}.`,
        );
      }

      if (selectedMedia.length === 1 && selectedMedia[0]?.kind === "video") {
        warnings.push(
          "Instagram will publish the single video as a Reel and share it to the feed.",
        );
      }
    }

    if (selectedPlatforms.includes("bluesky")) {
      const blueskyCaption = finalCaption("bluesky");
      const length = graphemeLength(blueskyCaption);

      if (length > 300) {
        errors.push(
          `Bluesky text is ${length} graphemes; maximum is 300.`,
        );
      }

      if (selectedMedia.length > 4) {
        errors.push("Bluesky supports at most four images per post.");
      }

      if (selectedMedia.some((item) => item.kind === "video")) {
        errors.push(
          "Bluesky video publishing is not enabled in v25.3. Use text and up to four images.",
        );
      }
    }

    return { errors, warnings };
  }, [
    postStatus,
    selectedPlatforms,
    captionOverrides.telegram,
    captionOverrides.twitter,
    captionOverrides.instagram,
    captionOverrides.bluesky,
    masterCaption,
    selectedMedia,
    includeDeploymentLink,
    selectedEvent,
  ]);

  const grouped = useMemo(() => {
    const buckets: Record<PostStatus, PostRow[]> = {
      draft: [],
      approved: [],
      scheduled: [],
      published: [],
      failed: [],
    };

    for (const post of posts) {
      const key = buckets[post.status] ? post.status : "draft";
      buckets[key].push(post);
    }

    return buckets;
  }, [posts]);

  async function refresh() {
    const response = await fetch("/api/admin/posts", { cache: "no-store" });
    const body = await response.json();

    if (response.ok) setPosts(body.posts ?? []);
    else setStatusMessage(body.error ?? "Could not refresh Social Ops.");
  }

  function resetComposer() {
    setEditingId(null);
    setIncludeDeploymentLink(false);
    setTitle("");
    setMasterCaption("");
    setPostStatus("draft");
    setScheduledAt("");
    setSelectedPlatforms(["telegram"]);
    setCaptionOverrides({});
    setMediaIds([]);
  }

  function editPost(post: PostRow) {
    setEditingId(post.id);
    setEventId(post.event_id ?? "");
    setIncludeDeploymentLink(Boolean(post.include_deployment_link));
    setTitle(post.title);
    setMasterCaption(post.master_caption);
    setPostStatus(
      ["draft", "approved", "scheduled"].includes(post.status)
        ? (post.status as "draft" | "approved" | "scheduled")
        : "draft"
    );
    setScheduledAt(toLocalInput(post.scheduled_at));
    setSelectedPlatforms(
      (post.post_platforms ?? []).map((platform) => platform.platform)
    );
    setCaptionOverrides(
      Object.fromEntries(
        (post.post_platforms ?? []).map((platform) => [
          platform.platform,
          platform.platform_caption_override ?? "",
        ])
      )
    );
    setMediaIds(
      [...(post.post_media ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((join) => join.media?.id)
        .filter(Boolean) as string[]
    );
    setStatusMessage(`Editing ${post.title}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function togglePlatform(platform: PlatformName) {
    setSelectedPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  }

  function toggleMedia(id: string) {
    setMediaIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function moveMedia(id: string, direction: -1 | 1) {
    setMediaIds((current) => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPlatforms.length) {
      setStatusMessage("Choose at least one platform.");
      return;
    }

    if (postStatus === "scheduled" && scheduleIssues.errors.length) {
      setStatusMessage(scheduleIssues.errors.join(" "));
      return;
    }

    const scheduleIso =
      postStatus === "scheduled" ? toIso(scheduledAt) : null;

    if (postStatus === "scheduled" && !scheduleIso) {
      setStatusMessage("Choose a valid scheduled date/time.");
      return;
    }

    const payload = {
      ...(editingId ? { action: "update", id: editingId } : {}),
      title,
      masterCaption,
      eventId: eventId || null,
      includeDeploymentLink,
      scheduledAt: scheduleIso,
      status: postStatus,
      platforms: selectedPlatforms.map((platform) => ({
        platform,
        captionOverride: captionOverrides[platform]?.trim() || null,
      })),
      mediaIds,
    };

    setStatusMessage(
      editingId ? "Updating publishing plan..." : "Saving publishing plan..."
    );

    const response = await fetch("/api/admin/posts", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();

    if (!response.ok) {
      setStatusMessage(body.detail ?? body.error ?? "Could not save post.");
      return;
    }

    const result =
      postStatus === "scheduled"
        ? "Scheduled. Make can pick it up only after the scheduled time."
        : postStatus === "approved"
          ? "Approved, but not scheduled. Nothing can publish yet."
          : "Draft saved. Nothing can publish.";

    resetComposer();
    setStatusMessage(result);
    await refresh();
  }

  async function transition(
    post: PostRow,
    nextStatus: "draft" | "approved" | "scheduled"
  ) {
    const schedule =
      nextStatus === "scheduled"
        ? new Date(Date.now() + 5 * 60_000).toISOString()
        : null;

    const response = await fetch("/api/admin/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "transition",
        id: post.id,
        status: nextStatus,
        scheduledAt: schedule,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatusMessage(body.detail ?? body.error ?? "Status update failed.");
      return;
    }

    setStatusMessage(
      nextStatus === "scheduled"
        ? `${post.title} queued for five minutes from now.`
        : `${post.title} moved to ${nextStatus}.`
    );
    await refresh();
  }

  async function retry(postId: string, platformId?: string) {
    const response = await fetch("/api/admin/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "retry",
        id: postId,
        platformId,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatusMessage(body.detail ?? body.error ?? "Retry failed.");
      return;
    }

    setStatusMessage("Failed job re-queued for Make.");
    await refresh();
  }

  async function remove(post: PostRow) {
    if (!window.confirm(`Delete draft "${post.title}"?`)) return;

    const response = await fetch("/api/admin/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: post.id }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatusMessage(body.detail ?? body.error ?? "Delete failed.");
      return;
    }

    setStatusMessage("Draft deleted.");
    await refresh();
  }

  return (
    <div className="space-y-8">
      <section className="panel">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="eyebrow">Dusk Industries Social Command Center</div>
            <h1 className="text-4xl font-black tracking-[-.04em]">
              {editingId ? "Edit Publishing Plan" : "Compose Publishing Plan"}
            </h1>
            <p className="mt-3 max-w-3xl text-slate-400">
              Draft here, approve deliberately, schedule intentionally. In v25.3
              Telegram, X, Instagram, and Bluesky are live. Scheduled
              live-provider jobs can leave Dusk Industries when the Make
              dispatcher runs; Snapchat is postponed.
            </p>
          </div>

          {editingId ? (
            <button
              className="button-secondary"
              type="button"
              onClick={resetComposer}
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <form
          onSubmit={save}
          className="mt-7 grid gap-7 xl:grid-cols-[1.1fr_.9fr]"
        >
          <div className="space-y-5">
            <label className="form-label">
              Internal title
              <input
                className="form-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Kimball Farms photo dump"
                required
              />
            </label>

            <div>
              <label className="form-label">
                Related deployment
                <select
                  className="form-input"
                  value={eventId}
                  onChange={(event) => {
                    const nextEventId = event.target.value;
                    setEventId(nextEventId);
                    setMediaIds([]);
                    if (!nextEventId) setIncludeDeploymentLink(false);
                  }}
                >
                  <option value="">No event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {new Date(event.start_at).toLocaleDateString()} ·{" "}
                      {event.title}
                    </option>
                  ))}
                </select>
              </label>

              <label
                className={`mt-3 flex items-start gap-3 rounded-xl border p-3 ${
                  eventId
                    ? "cursor-pointer border-dusk-aqua/20 bg-dusk-aqua/5"
                    : "cursor-not-allowed border-white/5 bg-white/[0.015] opacity-45"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={includeDeploymentLink}
                  disabled={!eventId}
                  onChange={(event) =>
                    setIncludeDeploymentLink(event.target.checked)
                  }
                />
                <span>
                  <strong className="block text-sm">
                    Add{" "}
                    {selectedEvent
                      ? deploymentDocumentLabel(selectedEvent)
                      : "deployment document"}{" "}
                    link to the post
                  </strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    Dusk appends the canonical `/chaos/...` URL to every
                    selected platform caption at publish time.
                  </span>
                </span>
              </label>
            </div>

            <label className="form-label">
              Master caption
              <textarea
                className="form-input min-h-44"
                value={masterCaption}
                onChange={(event) => setMasterCaption(event.target.value)}
                placeholder="The canonical caption we agree on together..."
                required
              />
            </label>

            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <div className="text-sm font-black">Media</div>
                  <div className="text-xs text-slate-500">
                    Select evidence, then order the carousel below.
                  </div>
                </div>
                <span className="tag !mt-0">{mediaIds.length} selected</span>
              </div>

              <div className="grid max-h-[330px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                {eventMedia.map((item) => {
                  const selected = mediaIds.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleMedia(item.id)}
                      className={`overflow-hidden rounded-2xl border text-left transition ${
                        selected
                          ? "border-dusk-aqua/60 bg-dusk-aqua/10"
                          : "border-white/10 bg-white/[0.02]"
                      }`}
                    >
                      <div className="aspect-square overflow-hidden bg-black/30">
                        {item.kind === "image" ? (
                          <img
                            src={item.url}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <video
                            src={item.url}
                            muted
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="p-2 text-xs font-bold">{item.title}</div>
                    </button>
                  );
                })}
              </div>

              {selectedMedia.length ? (
                <div className="mt-3 space-y-2">
                  {selectedMedia.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2"
                    >
                      <span className="truncate text-sm">
                        {index + 1}. {item.title}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          className="rounded-lg border border-white/10 px-2 py-1 disabled:opacity-30"
                          onClick={() => moveMedia(item.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === selectedMedia.length - 1}
                          className="rounded-lg border border-white/10 px-2 py-1 disabled:opacity-30"
                          onClick={() => moveMedia(item.id, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <div className="eyebrow">Destinations</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {PLATFORMS.map((platform) => {
                  const selected = selectedPlatforms.includes(platform);
                  const meta = PLATFORM_META[platform];

                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => togglePlatform(platform)}
                      className={`rounded-2xl border p-4 text-left ${
                        selected
                          ? "border-dusk-aqua/50 bg-dusk-aqua/10"
                          : "border-dusk-line bg-white/[0.025]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong>{meta.label}</strong>
                        <span
                          className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${
                            meta.live
                              ? "border-dusk-aqua/30 text-dusk-aqua"
                              : "border-white/10 text-slate-600"
                          }`}
                        >
                          {meta.live ? "LIVE" : "STAGED"}
                        </span>
                      </div>
                      <span className="mt-1 block text-xs text-slate-500">
                        {meta.note}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedPlatforms.map((platform) => (
              <label key={platform} className="form-label">
                {platformLabel(platform)} caption override
                <textarea
                  className="form-input min-h-24"
                  value={captionOverrides[platform] ?? ""}
                  onChange={(event) =>
                    setCaptionOverrides((current) => ({
                      ...current,
                      [platform]: event.target.value,
                    }))
                  }
                  placeholder="Leave blank to use the master caption"
                />
              </label>
            ))}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-label">
                Approval state
                <select
                  className="form-input"
                  value={postStatus}
                  onChange={(event) =>
                    setPostStatus(
                      event.target.value as
                        | "draft"
                        | "approved"
                        | "scheduled"
                    )
                  }
                >
                  <option value="draft">Draft — cannot publish</option>
                  <option value="approved">
                    Approved — cannot publish yet
                  </option>
                  <option value="scheduled">
                    Scheduled — Make eligible
                  </option>
                </select>
              </label>

              <label className="form-label">
                Schedule · local time
                <input
                  className="form-input"
                  type="datetime-local"
                  value={scheduledAt}
                  disabled={postStatus !== "scheduled"}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </label>
            </div>

            {postStatus === "scheduled" &&
            (scheduleIssues.errors.length || scheduleIssues.warnings.length) ? (
              <div className="space-y-2">
                {scheduleIssues.errors.map((issue) => (
                  <div
                    key={issue}
                    className="rounded-xl border border-dusk-pink/25 bg-dusk-pink/5 p-3 text-sm text-dusk-pink"
                  >
                    {issue}
                  </div>
                ))}
                {scheduleIssues.warnings.map((issue) => (
                  <div
                    key={issue}
                    className="rounded-xl border border-dusk-gold/20 bg-dusk-gold/5 p-3 text-sm text-slate-300"
                  >
                    {issue}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="rounded-2xl border border-dusk-gold/20 bg-dusk-gold/5 p-4 text-sm text-slate-300">
              <strong>Safety rail:</strong> Draft and Approved records never
              publish. In v25.3, Telegram, X, Instagram, and Bluesky can become
              Scheduled and dispatchable. Snapchat remains staged/postponed.
            </div>

            <button
              className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              disabled={postStatus === "scheduled" && scheduleIssues.errors.length > 0}
            >
              {editingId
                ? "Update publishing plan"
                : postStatus === "scheduled"
                  ? "Schedule live publishing"
                  : "Save publishing plan"}
            </button>

            {statusMessage ? (
              <p className="text-sm text-slate-400">{statusMessage}</p>
            ) : null}
          </div>
        </form>

        {selectedPlatforms.length ? (
          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="eyebrow">Cross-platform preview</div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {selectedPlatforms.map((platform) => (
                <PreviewCard
                  key={platform}
                  platform={platform}
                  caption={finalCaption(platform)}
                  media={selectedMedia}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <div className="eyebrow">Publishing pipeline</div>
        <h2 className="text-3xl font-black">Social Operations Board</h2>

        <div className="mt-5 grid gap-5 xl:grid-cols-5">
          {(
            [
              "draft",
              "approved",
              "scheduled",
              "published",
              "failed",
            ] as PostStatus[]
          ).map((column) => (
            <div key={column} className="min-w-0">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-black capitalize">{column}</h3>
                <span className="tag !mt-0">{grouped[column].length}</span>
              </div>

              <div className="space-y-3">
                {grouped[column].map((post) => {
                  const metrics = aggregateMetrics(post);
                  const orderedMedia = [...(post.post_media ?? [])]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((join) => join.media)
                    .filter(Boolean) as MediaOption[];

                  return (
                    <article key={post.id} className="card !p-4">
                      {orderedMedia[0] ? (
                        <div className="mb-3 aspect-video overflow-hidden rounded-xl bg-black/30">
                          {orderedMedia[0].kind === "image" ? (
                            <img
                              src={orderedMedia[0].url}
                              alt={orderedMedia[0].title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <video
                              src={orderedMedia[0].url}
                              muted
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-1.5">
                        {(post.post_platforms ?? []).map((platform) => (
                          <span
                            key={platform.id}
                            className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${
                              platform.status === "failed"
                                ? "border-dusk-pink/30 bg-dusk-pink/10 text-dusk-pink"
                                : platform.status === "published"
                                  ? "border-dusk-aqua/30 bg-dusk-aqua/10 text-dusk-aqua"
                                  : "border-white/10 bg-white/[0.03] text-slate-400"
                            }`}
                          >
                            {platformLabel(platform.platform)} ·{" "}
                            {platform.status}
                          </span>
                        ))}
                      </div>

                      <h4 className="mt-3 font-black">{post.title}</h4>

                      {post.events ? (
                        <a
                          href={`/chaos/${post.events.slug}`}
                          target="_blank"
                          className="mt-1 block text-xs font-bold text-dusk-aqua"
                        >
                          {post.events.title} ↗
                        </a>
                      ) : null}

                      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-slate-400">
                        {post.master_caption}
                      </p>

                      {post.scheduled_at ? (
                        <p className="mt-2 text-[11px] text-slate-600">
                          {new Date(post.scheduled_at).toLocaleString()}
                        </p>
                      ) : null}

                      {(post.post_platforms ?? []).some(
                        (platform) =>
                          platform.provider_account || platform.attempt_count > 0,
                      ) ? (
                        <div className="mt-2 space-y-1 text-[10px] text-slate-600">
                          {(post.post_platforms ?? []).map((platform) => (
                            <div key={`${platform.id}-receipt`}>
                              {platformLabel(platform.platform)}
                              {platform.provider_account
                                ? ` · ${platform.provider_account}`
                                : ""}
                              {platform.attempt_count
                                ? ` · ${platform.attempt_count} attempt${platform.attempt_count === 1 ? "" : "s"}`
                                : ""}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {post.status === "published" ? (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-xl bg-white/[0.03] p-2">
                            <div className="text-[9px] uppercase text-slate-600">
                              Reach
                            </div>
                            <strong className="text-dusk-aqua">
                              {metrics.reach || "—"}
                            </strong>
                          </div>
                          <div className="rounded-xl bg-white/[0.03] p-2">
                            <div className="text-[9px] uppercase text-slate-600">
                              Eng.
                            </div>
                            <strong className="text-dusk-pink">
                              {metrics.engagements || "—"}
                            </strong>
                          </div>
                        </div>
                      ) : null}

                      {(post.post_platforms ?? []).some(
                        (platform) => platform.last_error
                      ) ? (
                        <div className="mt-3 rounded-xl border border-dusk-pink/20 bg-dusk-pink/5 p-2 text-xs text-dusk-pink">
                          {(post.post_platforms ?? [])
                            .filter((platform) => platform.last_error)
                            .map((platform) => (
                              <div key={platform.id}>
                                {platformLabel(platform.platform)}:{" "}
                                {platform.last_error}
                              </div>
                            ))}
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {!["published", "failed"].includes(post.status) ? (
                          <button
                            className="button-secondary"
                            type="button"
                            onClick={() => editPost(post)}
                          >
                            Edit
                          </button>
                        ) : null}

                        {post.status === "draft" ? (
                          <button
                            className="button-secondary"
                            type="button"
                            onClick={() => transition(post, "approved")}
                          >
                            Approve
                          </button>
                        ) : null}

                        {post.status === "approved" ? (
                          <button
                            className="button-secondary"
                            type="button"
                            onClick={() => transition(post, "scheduled")}
                          >
                            Queue +5 min
                          </button>
                        ) : null}

                        {post.status === "failed" ? (
                          <button
                            className="button-primary"
                            type="button"
                            onClick={() => retry(post.id)}
                          >
                            Retry failed
                          </button>
                        ) : null}

                        {post.status === "published"
                          ? (post.post_platforms ?? [])
                              .filter((platform) => platform.post_url)
                              .map((platform) => (
                                <a
                                  key={platform.id}
                                  href={platform.post_url!}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="button-secondary"
                                >
                                  {platformLabel(platform.platform)} ↗
                                </a>
                              ))
                          : null}

                        {["draft", "approved"].includes(post.status) ? (
                          <button
                            className="rounded-xl border border-dusk-pink/30 bg-dusk-pink/10 px-3 py-2 text-xs font-black"
                            type="button"
                            onClick={() => remove(post)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
