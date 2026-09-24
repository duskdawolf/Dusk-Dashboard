import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/notifications";
import { platformIsConfigured, platformIsLive } from "@/lib/social/providers";
import { deploymentLinkSuffix } from "@/lib/social/deployment-link";
import { blueskyGraphemeLength } from "@/lib/social/bluesky";

const PlatformSchema = z.enum([
  "telegram",
  "twitter",
  "instagram",
  "bluesky",
  "snapchat",
]);

const PlatformInputSchema = z.object({
  platform: PlatformSchema,
  captionOverride: z.string().max(10000).nullable().optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const CreateSchema = z.object({
  title: z.string().min(1).max(180),
  masterCaption: z.string().min(1).max(10000),
  eventId: z.string().uuid().nullable().optional(),
  includeDeploymentLink: z.boolean().default(false),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  status: z.enum(["draft", "approved", "scheduled"]).default("draft"),
  platforms: z.array(PlatformInputSchema).min(1),
  mediaIds: z.array(z.string().uuid()).default([]),
});

const PatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    title: z.string().min(1).max(180),
    masterCaption: z.string().min(1).max(10000),
    eventId: z.string().uuid().nullable().optional(),
    includeDeploymentLink: z.boolean().default(false),
    scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
    status: z.enum(["draft", "approved", "scheduled"]),
    platforms: z.array(PlatformInputSchema).min(1),
    mediaIds: z.array(z.string().uuid()).default([]),
  }),
  z.object({
    action: z.literal("transition"),
    id: z.string().uuid(),
    status: z.enum(["draft", "approved", "scheduled"]),
    scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  }),
  z.object({
    action: z.literal("retry"),
    id: z.string().uuid(),
    platformId: z.string().uuid().optional(),
  }),
]);

const DeleteSchema = z.object({ id: z.string().uuid() });

async function authorized() {
  return await getDashboardUser();
}

function effectivePlatformSchedule(
  platform: z.infer<typeof PlatformInputSchema>,
  fallback: string | null | undefined,
) {
  return platform.scheduledAt ?? fallback ?? null;
}

function earliestLiveSchedule(
  platforms: z.infer<typeof PlatformInputSchema>[],
  fallback: string | null | undefined,
) {
  const times = platforms
    .filter((item) => platformIsLive(item.platform))
    .map((item) => effectivePlatformSchedule(item, fallback))
    .filter(Boolean) as string[];

  if (!times.length) return fallback ?? null;
  return [...times].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  )[0];
}

function missingLiveSchedules(
  platforms: z.infer<typeof PlatformInputSchema>[],
  fallback: string | null | undefined,
) {
  return platforms
    .filter((item) => platformIsLive(item.platform))
    .filter((item) => !effectivePlatformSchedule(item, fallback))
    .map((item) => item.platform);
}

async function deploymentSuffixForInput(
  eventId: string | null | undefined,
  includeDeploymentLink: boolean,
) {
  if (!includeDeploymentLink || !eventId) return "";

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("events")
    .select("slug,start_at")
    .eq("id", eventId)
    .maybeSingle();

  return data ? deploymentLinkSuffix(data) : "";
}

function validateScheduledPayload(
  input: {
    masterCaption: string;
    platforms: z.infer<typeof PlatformInputSchema>[];
    mediaIds: string[];
  },
  captionSuffix = "",
) {
  const errors: string[] = [];
  const livePlatforms = input.platforms.filter((platform) =>
    platformIsLive(platform.platform),
  );

  if (!livePlatforms.length) {
    errors.push(
      "At least one selected destination must have a live provider before this post can be Scheduled.",
    );
  }

  for (const platform of livePlatforms) {
    if (!platformIsConfigured(platform.platform)) {
      errors.push(
        `${platform.platform} is live but not configured in Vercel.`,
      );
    }

    if (platform.platform === "telegram") {
      const caption =
        `${platform.captionOverride?.trim() || input.masterCaption.trim()}${captionSuffix}`;

      if (caption.length > 4096) {
        errors.push(
          `Telegram text is ${caption.length} characters; maximum is 4096.`,
        );
      }

      if (input.mediaIds.length > 10) {
        errors.push(
          "Telegram supports at most 10 media items in a v25.2 publishing job.",
        );
      }
    }

    if (platform.platform === "twitter") {
      const caption =
        `${platform.captionOverride?.trim() || input.masterCaption.trim()}${captionSuffix}`;
      const xLimit = Number(process.env.X_MAX_POST_CHARS || 280);

      if (caption.length > xLimit) {
        errors.push(
          `X text is ${caption.length} characters; Dusk's configured X limit is ${xLimit}.`,
        );
      }

      if (input.mediaIds.length > 4) {
        errors.push(
          "X supports at most four attached photos; video/GIF posts must use a single media item.",
        );
      }
    }

    if (platform.platform === "instagram") {
      const caption =
        `${platform.captionOverride?.trim() || input.masterCaption.trim()}${captionSuffix}`;

      if (!input.mediaIds.length) {
        errors.push("Instagram requires at least one photo or video.");
      }

      if (input.mediaIds.length > 10) {
        errors.push("Instagram carousels support at most 10 media items.");
      }

      if (caption.length > 2200) {
        errors.push(
          `Instagram caption is ${caption.length} characters; maximum is 2200.`,
        );
      }
    }

    if (platform.platform === "bluesky") {
      const caption =
        `${platform.captionOverride?.trim() || input.masterCaption.trim()}${captionSuffix}`;
      const length = blueskyGraphemeLength(caption);

      if (length > 300) {
        errors.push(
          `Bluesky text is ${length} graphemes; maximum is 300.`,
        );
      }

      if (input.mediaIds.length > 4) {
        errors.push(
          "Bluesky supports at most four images in a v25.3 publishing job.",
        );
      }
    }
  }

  return errors;
}

async function blueskyMediaErrors(
  platforms: Array<{ platform: string }>,
  mediaIds: string[],
) {
  if (!platforms.some((item) => item.platform === "bluesky")) {
    return [];
  }

  if (!mediaIds.length) return [];

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("media")
    .select("id,kind")
    .in("id", mediaIds);

  if (error) return [error.message];

  return (data ?? []).some((item) => item.kind === "video")
    ? [
        "Bluesky video publishing is not enabled in v25.3. Remove video from the Bluesky publishing plan or leave Bluesky staged.",
      ]
    : [];
}

async function validateExistingPostForScheduling(postId: string) {
  const supabase = createAdminSupabaseClient();

  const { data: post, error } = await supabase
    .from("posts")
    .select(`
      id,
      master_caption,
      include_deployment_link,
      events(slug,start_at),
      post_media(id),
      post_platforms(platform, platform_caption_override, status)
    `)
    .eq("id", postId)
    .maybeSingle();

  if (error || !post) {
    return [error?.message ?? "Social post not found."];
  }

  const platforms = (post.post_platforms ?? [])
    .filter((row: any) => row.status !== "published")
    .map((row: any) => ({
      platform: row.platform,
      captionOverride: row.platform_caption_override,
    }));
  const mediaIds = (post.post_media ?? []).map((row: any) => row.id);

  const errors = validateScheduledPayload(
    {
      masterCaption: post.master_caption ?? "",
      mediaIds,
      platforms,
    },
    post.include_deployment_link && post.events
      ? deploymentLinkSuffix(post.events as any)
      : "",
  );

  errors.push(...(await blueskyMediaErrors(platforms, mediaIds)));
  return errors;
}

async function replacePostMedia(postId: string, mediaIds: string[]) {
  const supabase = createAdminSupabaseClient();
  await supabase.from("post_media").delete().eq("post_id", postId);

  if (!mediaIds.length) return null;

  const { error } = await supabase.from("post_media").insert(
    mediaIds.map((mediaId, index) => ({
      post_id: postId,
      media_id: mediaId,
      sort_order: index,
    }))
  );

  return error;
}

async function replacePlatforms(
  postId: string,
  platforms: z.infer<typeof PlatformInputSchema>[],
  status: "draft" | "approved" | "scheduled",
  scheduledAt: string | null,
) {
  const supabase = createAdminSupabaseClient();

  const { data: existing } = await supabase
    .from("post_platforms")
    .select("id,platform,status")
    .eq("post_id", postId);

  const keep = new Set(platforms.map((item) => item.platform));
  const removable = (existing ?? []).filter(
    (row) => !keep.has(row.platform) && row.status !== "published"
  );

  if (removable.length) {
    await supabase
      .from("post_platforms")
      .delete()
      .in("id", removable.map((row) => row.id));
  }

  for (const platform of platforms) {
    const current = (existing ?? []).find(
      (row) => row.platform === platform.platform
    );

    const live = platformIsLive(platform.platform);

    const platformStatus =
      current?.status === "published"
        ? "published"
        : status === "scheduled"
          ? live
            ? "scheduled"
            : "approved"
          : status === "approved"
            ? "approved"
            : "draft";

    const payload = {
      post_id: postId,
      platform: platform.platform,
      platform_caption_override: platform.captionOverride || null,
      status: platformStatus,
      scheduled_at:
        status === "scheduled" && live
          ? effectivePlatformSchedule(platform, scheduledAt)
          : null,
      last_error: null,
    };

    if (current) {
      const { error } = await supabase
        .from("post_platforms")
        .update(payload)
        .eq("id", current.id);
      if (error) return error;
    } else {
      const { error } = await supabase.from("post_platforms").insert(payload);
      if (error) return error;
    }
  }

  return null;
}

const POST_SELECT = `
  *,
  events(id,slug,title,start_at,location),
  post_media(
    id,
    sort_order,
    media(id,title,kind,url,mime_type,alt_text,caption,event_id)
  ),
  post_platforms(
    *,
    post_metrics(*)
  )
`;

export async function GET() {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load posts.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ posts: data ?? [] });
}

export async function POST(request: Request) {
  const user = await authorized();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = CreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid post.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;

  if (input.status === "scheduled") {
    const captionSuffix = await deploymentSuffixForInput(
      input.eventId,
      input.includeDeploymentLink,
    );
    const scheduleErrors = validateScheduledPayload(
      input,
      captionSuffix,
    );
    scheduleErrors.push(
      ...(await blueskyMediaErrors(input.platforms, input.mediaIds)),
    );

    if (scheduleErrors.length) {
      return NextResponse.json(
        {
          error: "This publishing plan is not ready to schedule.",
          detail: scheduleErrors.join(" "),
        },
        { status: 400 },
      );
    }
  }

  if (input.status === "scheduled") {
    const missing = missingLiveSchedules(input.platforms, input.scheduledAt);
    if (missing.length) {
      return NextResponse.json(
        {
          error: "A scheduled post needs a time for every live platform.",
          detail: `Missing schedule: ${missing.join(", ")}. Set a base time or platform override.`,
        },
        { status: 400 },
      );
    }
  }

  const supabase = createAdminSupabaseClient();

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      owner_user_id: user.id,
      event_id: input.eventId ?? null,
      include_deployment_link: input.includeDeploymentLink,
      title: input.title,
      master_caption: input.masterCaption,
      status: input.status,
      scheduled_at:
        input.status === "scheduled"
          ? earliestLiveSchedule(input.platforms, input.scheduledAt)
          : null,
      approved_at:
        input.status === "approved" || input.status === "scheduled"
          ? new Date().toISOString()
          : null,
      automation_status:
        input.status === "scheduled" ? "ready_for_make" : "not_ready",
    })
    .select("*")
    .single();

  if (error || !post) {
    return NextResponse.json(
      { error: "Could not create post.", detail: error?.message },
      { status: 500 }
    );
  }

  const mediaError = await replacePostMedia(post.id, input.mediaIds);
  if (mediaError) {
    await supabase.from("posts").delete().eq("id", post.id);
    return NextResponse.json(
      { error: "Could not attach media.", detail: mediaError.message },
      { status: 500 }
    );
  }

  const platformError = await replacePlatforms(
    post.id,
    input.platforms,
    input.status,
    input.scheduledAt ?? null
  );

  if (platformError) {
    await supabase.from("posts").delete().eq("id", post.id);
    return NextResponse.json(
      { error: "Could not save platform records.", detail: platformError.message },
      { status: 500 }
    );
  }

  if (input.status === "approved") {
    await notifyAdmins({
      topicKey: "social.approved",
      title: `Post approved: ${input.title}`,
      message: "The post is approved but not scheduled, so it still cannot publish.",
      targetUrl: "/dashboard/posts",
      actionLabel: "Open Social Ops",
      postId: post.id,
      eventId: input.eventId ?? null,
      dedupeKey: `social.approved:${post.id}`,
      dedupeMinutes: 60,
    });
  } else if (input.status === "scheduled") {
    await notifyAdmins({
      topicKey: "social.scheduled",
      title: `Post scheduled: ${input.title}`,
      message: input.scheduledAt
        ? `Scheduled for ${new Date(input.scheduledAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ET.`
        : "The post is scheduled.",
      targetUrl: "/dashboard/posts",
      actionLabel: "Open Social Ops",
      postId: post.id,
      eventId: input.eventId ?? null,
      dedupeKey: `social.scheduled:${post.id}:${input.scheduledAt ?? "now"}`,
      dedupeMinutes: 30,
    });
  }

  return NextResponse.json({ post }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = PatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid post update.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  if (input.action === "retry") {
    let query = supabase
      .from("post_platforms")
      .update({
        status: "scheduled",
        scheduled_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("post_id", input.id)
      .eq("status", "failed");

    if (input.platformId) query = query.eq("id", input.platformId);

    const { error } = await query;
    if (error) {
      return NextResponse.json(
        { error: "Could not retry publishing.", detail: error.message },
        { status: 500 }
      );
    }

    await supabase
      .from("posts")
      .update({
        status: "scheduled",
        scheduled_at: new Date().toISOString(),
        automation_status: "ready_for_make",
      })
      .eq("id", input.id);

    await notifyAdmins({
      topicKey: "social.scheduled",
      title: "Failed social job re-queued",
      message: "The failed platform job was returned to the publishing queue for another attempt.",
      targetUrl: "/dashboard/posts",
      actionLabel: "Open Social Ops",
      postId: input.id,
      dedupeKey: `social.retry:${input.id}:${Math.floor(Date.now() / 300000)}`,
      dedupeMinutes: 5,
    });

    return NextResponse.json({ ok: true });
  }

  if (input.action === "transition") {
    if (input.status === "scheduled") {
      const scheduleErrors = await validateExistingPostForScheduling(input.id);

      if (scheduleErrors.length) {
        return NextResponse.json(
          {
            error: "This publishing plan is not ready to schedule.",
            detail: scheduleErrors.join(" "),
          },
          { status: 400 },
        );
      }
    }

    if (input.status === "scheduled" && !input.scheduledAt) {
      return NextResponse.json(
        { error: "A scheduled post needs a scheduled time." },
        { status: 400 }
      );
    }

    const scheduledAt =
      input.status === "scheduled" ? input.scheduledAt ?? null : null;

    const { error } = await supabase
      .from("posts")
      .update({
        status: input.status,
        scheduled_at: scheduledAt,
        approved_at:
          input.status === "approved" || input.status === "scheduled"
            ? new Date().toISOString()
            : null,
        automation_status:
          input.status === "scheduled" ? "ready_for_make" : "not_ready",
      })
      .eq("id", input.id);

    if (error) {
      return NextResponse.json(
        { error: "Could not change post status.", detail: error.message },
        { status: 500 }
      );
    }

    const { data: platformRows, error: platformLoadError } = await supabase
      .from("post_platforms")
      .select("id,platform,status")
      .eq("post_id", input.id);

    if (platformLoadError) {
      return NextResponse.json(
        {
          error: "Could not load platform queue.",
          detail: platformLoadError.message,
        },
        { status: 500 },
      );
    }

    for (const platformRow of platformRows ?? []) {
      if (platformRow.status === "published") continue;

      const live = platformIsLive(platformRow.platform);

      const nextPlatformStatus =
        input.status === "scheduled"
          ? live
            ? "scheduled"
            : "approved"
          : input.status === "approved"
            ? "approved"
            : "draft";

      const { error: platformError } = await supabase
        .from("post_platforms")
        .update({
          status: nextPlatformStatus,
          scheduled_at:
            input.status === "scheduled" && live ? scheduledAt : null,
          last_error: null,
        })
        .eq("id", platformRow.id);

      if (platformError) {
        return NextResponse.json(
          {
            error: "Could not update platform queue.",
            detail: platformError.message,
          },
          { status: 500 },
        );
      }
    }

    if (input.status === "approved") {
      await notifyAdmins({
        topicKey: "social.approved",
        title: "Social post approved",
        message: "The post is approved and waiting for a schedule.",
        targetUrl: "/dashboard/posts",
        actionLabel: "Open Social Ops",
        postId: input.id,
        dedupeKey: `social.approved:${input.id}`,
        dedupeMinutes: 60,
      });
    } else if (input.status === "scheduled") {
      await notifyAdmins({
        topicKey: "social.scheduled",
        title: "Social post scheduled",
        message: input.scheduledAt
          ? `The post is queued for ${new Date(input.scheduledAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ET.`
          : "The post has entered the publishing queue.",
        targetUrl: "/dashboard/posts",
        actionLabel: "Open Social Ops",
        postId: input.id,
        dedupeKey: `social.scheduled:${input.id}:${input.scheduledAt ?? "now"}`,
        dedupeMinutes: 30,
      });
    }

    return NextResponse.json({ ok: true });
  }

  if (input.status === "scheduled") {
    const captionSuffix = await deploymentSuffixForInput(
      input.eventId,
      input.includeDeploymentLink,
    );
    const scheduleErrors = validateScheduledPayload(
      input,
      captionSuffix,
    );
    scheduleErrors.push(
      ...(await blueskyMediaErrors(input.platforms, input.mediaIds)),
    );

    if (scheduleErrors.length) {
      return NextResponse.json(
        {
          error: "This publishing plan is not ready to schedule.",
          detail: scheduleErrors.join(" "),
        },
        { status: 400 },
      );
    }
  }

  if (input.status === "scheduled") {
    const missing = missingLiveSchedules(input.platforms, input.scheduledAt);
    if (missing.length) {
      return NextResponse.json(
        {
          error: "A scheduled post needs a time for every live platform.",
          detail: `Missing schedule: ${missing.join(", ")}. Set a base time or platform override.`,
        },
        { status: 400 },
      );
    }
  }

  const scheduledAt =
    input.status === "scheduled"
      ? earliestLiveSchedule(input.platforms, input.scheduledAt)
      : null;

  const { error } = await supabase
    .from("posts")
    .update({
      event_id: input.eventId ?? null,
      include_deployment_link: input.includeDeploymentLink,
      title: input.title,
      master_caption: input.masterCaption,
      status: input.status,
      scheduled_at: scheduledAt,
      approved_at:
        input.status === "approved" || input.status === "scheduled"
          ? new Date().toISOString()
          : null,
      automation_status:
        input.status === "scheduled" ? "ready_for_make" : "not_ready",
    })
    .eq("id", input.id);

  if (error) {
    return NextResponse.json(
      { error: "Could not update post.", detail: error.message },
      { status: 500 }
    );
  }

  const mediaError = await replacePostMedia(input.id, input.mediaIds);
  if (mediaError) {
    return NextResponse.json(
      { error: "Could not update post media.", detail: mediaError.message },
      { status: 500 }
    );
  }

  const platformError = await replacePlatforms(
    input.id,
    input.platforms,
    input.status,
    scheduledAt
  );

  if (platformError) {
    return NextResponse.json(
      { error: "Could not update platform records.", detail: platformError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = DeleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid delete request." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: publishedPlatforms } = await supabase
    .from("post_platforms")
    .select("id")
    .eq("post_id", parsed.data.id)
    .eq("status", "published")
    .limit(1);

  if (publishedPlatforms?.length) {
    return NextResponse.json(
      { error: "Published posts stay in the archive and cannot be deleted." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("posts").delete().eq("id", parsed.data.id);

  if (error) {
    return NextResponse.json(
      { error: "Could not delete post.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
