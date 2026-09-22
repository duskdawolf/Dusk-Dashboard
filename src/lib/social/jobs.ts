import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { SocialPublishJob } from "@/lib/social/types";

export async function loadSocialPublishJob(
  platformId: string,
): Promise<SocialPublishJob | null> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("post_platforms")
    .select(`
      id,
      post_id,
      platform,
      platform_caption_override,
      scheduled_at,
      posts!inner (
        id,
        title,
        master_caption,
        events (
          id,
          slug,
          title,
          location,
          start_at
        ),
        post_media (
          sort_order,
          media (
            id,
            title,
            kind,
            url,
            mime_type,
            alt_text,
            caption
          )
        )
      )
    `)
    .eq("id", platformId)
    .maybeSingle();

  if (error || !data) return null;

  const post: any = data.posts;
  const media = [...(post?.post_media ?? [])]
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((join: any) => join.media)
    .filter(Boolean);

  return {
    platformId: data.id,
    postId: data.post_id,
    platform: data.platform as SocialPublishJob["platform"],
    title: post?.title ?? "Untitled social post",
    caption:
      data.platform_caption_override || post?.master_caption || "",
    scheduledAt: data.scheduled_at,
    event: post?.events ?? null,
    media,
  };
}
