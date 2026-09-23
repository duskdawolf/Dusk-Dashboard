import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { SocialPublishJob } from "@/lib/social/types";
import { withDeploymentLink } from "@/lib/social/deployment-link";

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
      provider_response,
      posts!inner (
        id,
        title,
        master_caption,
        include_deployment_link,
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

  const baseCaption =
    data.platform_caption_override || post?.master_caption || "";

  return {
    platformId: data.id,
    postId: data.post_id,
    platform: data.platform as SocialPublishJob["platform"],
    title: post?.title ?? "Untitled social post",
    caption: withDeploymentLink(
      baseCaption,
      post?.events ?? null,
      Boolean(post?.include_deployment_link),
    ),
    scheduledAt: data.scheduled_at,
    includeDeploymentLink: Boolean(post?.include_deployment_link),
    providerState:
      data.provider_response &&
      typeof data.provider_response === "object"
        ? data.provider_response
        : {},
    event: post?.events ?? null,
    media,
  };
}
