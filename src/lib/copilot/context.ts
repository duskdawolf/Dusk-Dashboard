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

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function loadCopilotContext(args: {
  userId: string;
  contextType: CopilotContextType;
  conPrepId?: string | null;
  postId?: string | null;
}) {
  const supabase = createAdminSupabaseClient();

  const preferences = await ensurePreferences(args.userId);

  if (args.contextType === "deployment" && args.conPrepId) {
    const { data: prep } = await supabase
      .from("con_preps")
      .select(`
        *,
        events(*),
        packing_items(*),
        prep_tasks(*),
        travel_segments(*),
        hotel_stays(*),
        con_registrations(*),
        cost_entries(*)
      `)
      .eq("id", args.conPrepId)
      .or(`owner_user_id.eq.${args.userId},owner_user_id.is.null`)
      .maybeSingle();

    return {
      contextType: "deployment" as const,
      preferences,
      deployment: prep,
    };
  }

  if (args.contextType === "social") {
    if (args.postId) {
      const { data: post } = await supabase
        .from("posts")
        .select(`
          *,
          events(*),
          post_media(*, media(*)),
          post_platforms(*, post_metrics(*))
        `)
        .eq("id", args.postId)
        .maybeSingle();

      return {
        contextType: "social" as const,
        preferences,
        post,
      };
    }

    const { data: posts } = await supabase
      .from("posts")
      .select(`
        id,title,master_caption,status,scheduled_at,event_id,automation_status,
        events(id,title,start_at,slug),
        post_platforms(
          id,platform,status,scheduled_at,last_error,attempt_count,post_url,
          post_metrics(captured_at,impressions,reach,likes,comments,shares,saves,clicks,video_views)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(12);

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
        events(id,title,start_at,location,slug),
        prep_tasks(id,title,status,due_at),
        packing_items(id,label,packed,parent_item_id)
      `)
      .eq("owner_user_id", args.userId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("posts")
      .select(`
        id,title,status,scheduled_at,automation_status,
        post_platforms(
          id,platform,status,scheduled_at,last_error,
          post_metrics(captured_at,impressions,reach,likes,comments,shares,saves,clicks,video_views)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return {
    contextType: "global" as const,
    preferences,
    deployments: preps ?? [],
    recentPosts: posts ?? [],
  };
}
