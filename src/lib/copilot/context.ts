import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type CopilotContextType = "global" | "deployment" | "social";

async function ensurePreferences(userId: string) {
  const supabase = createAdminSupabaseClient();

  const { data: existing } = await supabase
    .from("operator_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("operator_preferences")
    .insert({
      user_id: userId,
      timezone: "America/New_York",
      airport_arrival_minutes: 90,
      safety_buffer_minutes: 15,
      sticker_rate_per_hour: 50,
      work_schedule: {
        monday: [{ start: "06:00", end: "14:30" }],
        tuesday: [{ start: "06:00", end: "14:30" }],
        wednesday: [{ start: "06:00", end: "14:30" }],
        thursday: [{ start: "06:00", end: "14:30" }],
        friday: [{ start: "06:00", end: "14:30" }],
        saturday: [],
        sunday: [{ start: "11:30", end: "20:00" }],
      },
      printing_windows: [
        { weekday: "tuesday", start: "15:00", end: "22:00" },
        { weekday: "wednesday", start: "15:00", end: "22:00" },
      ],
      default_loadouts: ["con-core", "fullsuit", "hotel"],
      ai_preferences: {
        deployment_tone: "chaotic but operationally precise",
        require_action_review: true,
      },
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

function compactPreferences(preferences: any) {
  if (!preferences) return null;

  return {
    timezone: preferences.timezone,
    airportArrivalMinutes: preferences.airport_arrival_minutes,
    safetyBufferMinutes: preferences.safety_buffer_minutes,
    stickerRatePerHour: preferences.sticker_rate_per_hour,
    printingWindows: preferences.printing_windows,
    defaultLoadouts: preferences.default_loadouts,
  };
}

function compactDeployment(prep: any) {
  if (!prep) return null;

  const packing = prep.packing_items ?? [];
  const tasks = prep.prep_tasks ?? [];
  const travel = prep.travel_segments ?? [];
  const hotels = prep.hotel_stays ?? [];
  const registrations = prep.con_registrations ?? [];
  const costs = prep.cost_entries ?? [];

  const topLevelPacking = packing.filter((item: any) => !item.parent_item_id);
  const openTasks = tasks.filter(
    (task: any) => !["done", "skipped"].includes(task.status),
  );

  return {
    id: prep.id,
    status: prep.status,
    readinessScore: prep.readiness_score,
    deadline: prep.prep_deadline_at,
    event: prep.events
      ? {
          id: prep.events.id,
          title: prep.events.title,
          slug: prep.events.slug,
          startAt: prep.events.start_at,
          endAt: prep.events.end_at,
          location: prep.events.location,
          eventType: prep.events.event_type,
        }
      : null,
    packing: {
      total: packing.length,
      packed: packing.filter((item: any) => item.packed).length,
      topLevelItems: topLevelPacking.slice(0, 30).map((item: any) => ({
        label: item.label,
        packed: item.packed,
        category: item.category,
      })),
      existingLabels: packing.slice(0, 60).map((item: any) => item.label),
    },
    tasks: {
      total: tasks.length,
      complete: tasks.filter((task: any) =>
        ["done", "skipped"].includes(task.status),
      ).length,
      open: openTasks.slice(0, 24).map((task: any) => ({
        title: task.title,
        type: task.task_type,
        dueAt: task.due_at,
        parentTaskId: task.parent_task_id,
      })),
      existingTitles: tasks.slice(0, 60).map((task: any) => task.title),
    },
    travel: travel.slice(0, 6).map((segment: any) => ({
      kind: segment.kind,
      direction: segment.direction,
      origin: segment.origin,
      destination: segment.destination,
      departAt: segment.depart_at,
      arriveAt: segment.arrive_at,
      provider: segment.provider,
    })),
    hotel: hotels[0]
      ? {
          hotelName: hotels[0].hotel_name,
          address: hotels[0].address,
          checkInAt: hotels[0].check_in_at,
          checkoutAt: hotels[0].checkout_at,
          costCents: hotels[0].cost_cents,
        }
      : null,
    registration: registrations[0]
      ? {
          badgeName: registrations[0].badge_name,
          status: registrations[0].status,
          costCents: registrations[0].cost_cents,
        }
      : null,
    budget: {
      entries: costs.length,
      totalCents: costs.reduce(
        (sum: number, item: any) => sum + Number(item.amount_cents ?? 0),
        0,
      ),
      unpaidOrPlanned: costs
        .filter((item: any) => item.cost_status !== "paid")
        .slice(0, 10)
        .map((item: any) => ({
          category: item.category,
          description: item.description,
          amountCents: item.amount_cents,
          status: item.cost_status,
        })),
    },
  };
}

function compactPost(post: any) {
  if (!post) return null;

  return {
    id: post.id,
    title: post.title,
    status: post.status,
    scheduledAt: post.scheduled_at,
    masterCaption: post.master_caption,
    includeDeploymentLink: post.include_deployment_link,
    event: post.events
      ? {
          id: post.events.id,
          title: post.events.title,
          slug: post.events.slug,
          startAt: post.events.start_at,
        }
      : null,
    media: (post.post_media ?? []).slice(0, 10).map((row: any) => ({
      title: row.media?.title,
      kind: row.media?.kind,
      mimeType: row.media?.mime_type,
      altText: row.media?.alt_text,
    })),
    platforms: (post.post_platforms ?? []).map((row: any) => ({
      platform: row.platform,
      status: row.status,
      scheduledAt: row.scheduled_at,
      captionOverride: row.platform_caption_override,
      lastError: row.last_error,
      latestMetrics: (row.post_metrics ?? [])
        .slice()
        .sort(
          (a: any, b: any) =>
            new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime(),
        )[0] ?? null,
    })),
  };
}

export async function loadCopilotContext(args: {
  userId: string;
  contextType: CopilotContextType;
  conPrepId?: string | null;
  postId?: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  const preferences = compactPreferences(await ensurePreferences(args.userId));

  if (args.contextType === "deployment" && args.conPrepId) {
    const { data: prep } = await supabase
      .from("con_preps")
      .select(`
        id,status,readiness_score,prep_deadline_at,
        events(id,title,slug,start_at,end_at,location,event_type),
        packing_items(id,parent_item_id,category,label,quantity,packed),
        prep_tasks(id,parent_task_id,title,status,due_at,task_type),
        travel_segments(*),
        hotel_stays(*),
        con_registrations(*),
        cost_entries(category,description,amount_cents,cost_status)
      `)
      .eq("id", args.conPrepId)
      .or(`owner_user_id.eq.${args.userId},owner_user_id.is.null`)
      .maybeSingle();

    return {
      contextType: "deployment" as const,
      selectedDeploymentId: args.conPrepId,
      preferences,
      deployment: compactDeployment(prep),
    };
  }

  if (args.contextType === "social") {
    if (args.postId) {
      const { data: post } = await supabase
        .from("posts")
        .select(`
          id,title,status,scheduled_at,master_caption,include_deployment_link,
          events(id,title,slug,start_at),
          post_media(*, media(title,kind,mime_type,alt_text)),
          post_platforms(
            id,platform,status,scheduled_at,platform_caption_override,last_error,
            post_metrics(captured_at,impressions,reach,likes,comments,shares,saves,clicks,video_views)
          )
        `)
        .eq("id", args.postId)
        .maybeSingle();

      return {
        contextType: "social" as const,
        selectedPostId: args.postId,
        preferences,
        post: compactPost(post),
      };
    }

    const { data: posts } = await supabase
      .from("posts")
      .select(`
        id,title,status,scheduled_at,automation_status,
        events(id,title,start_at,slug),
        post_platforms(id,platform,status,scheduled_at,last_error)
      `)
      .order("created_at", { ascending: false })
      .limit(6);

    return {
      contextType: "social" as const,
      preferences,
      recentPosts: posts ?? [],
    };
  }

  const [{ data: preps }, { data: posts }] = await Promise.all([
    supabase
      .from("con_preps")
      .select(`
        id,status,readiness_score,prep_deadline_at,
        events(id,title,start_at,end_at,location,slug)
      `)
      .eq("owner_user_id", args.userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("posts")
      .select(`
        id,title,status,scheduled_at,automation_status,
        post_platforms(id,platform,status,last_error)
      `)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    contextType: "global" as const,
    preferences,
    deployments: preps ?? [],
    recentPosts: posts ?? [],
  };
}
