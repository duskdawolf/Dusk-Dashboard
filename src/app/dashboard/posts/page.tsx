import { PostManager } from "@/components/PostManager";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Posts · Dusk Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPostsPage() {
  const supabase = createAdminSupabaseClient();

  const [{ data: posts, error }, { data: events }] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "*, post_platforms(*, post_metrics(*))"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id,title")
      .order("start_at", { ascending: false }),
  ]);

  if (error) {
    return (
      <div className="panel">
        <strong>Posts migration is not ready yet.</strong>
        <p className="mt-2 text-sm text-slate-400">{error.message}</p>
      </div>
    );
  }

  return (
    <PostManager
      initialPosts={(posts ?? []) as never[]}
      events={(events ?? []) as { id: string; title: string }[]}
    />
  );
}
