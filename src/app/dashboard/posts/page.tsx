import { PostManager } from "@/components/PostManager";
import { SocialProviderPanel } from "@/components/SocialProviderPanel";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Social Ops · Dusk Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string; mediaId?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminSupabaseClient();

  const [
    { data: posts, error },
    { data: events },
    { data: media },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(`
        *,
        events(id,slug,title,start_at,location),
        post_media(
          id,
          sort_order,
          media(id,title,kind,url,mime_type,alt_text,caption,event_id)
        ),
        post_platforms(*, post_metrics(*))
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id,title,slug,start_at")
      .order("start_at", { ascending: false }),
    supabase
      .from("media")
      .select("id,title,kind,url,mime_type,event_id,published,sort_order")
      .eq("published", true)
      .order("event_id", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  if (error) {
    return (
      <div className="panel">
        <strong>Social Ops is not ready yet.</strong>
        <p className="mt-2 text-sm text-slate-400">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SocialProviderPanel />
      <PostManager
        initialPosts={(posts ?? []) as never[]}
        events={(events ?? []) as never[]}
        media={(media ?? []) as never[]}
        initialEventId={params.eventId ?? ""}
        initialMediaId={params.mediaId ?? ""}
      />
    </div>
  );
}
