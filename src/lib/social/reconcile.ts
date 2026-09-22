import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { platformIsLive } from "@/lib/social/providers";

export async function reconcileSocialPost(postId: string) {
  const supabase = createAdminSupabaseClient();

  const { data: platforms } = await supabase
    .from("post_platforms")
    .select("platform,status")
    .eq("post_id", postId);

  if (!platforms?.length) return;

  const live = platforms.filter((row) =>
    platformIsLive(row.platform),
  );
  const staged = platforms.filter(
    (row) => !platformIsLive(row.platform),
  );

  const liveStatuses = live.map((row) => row.status);
  const stagedOutstanding = staged.some(
    (row) => row.status !== "published",
  );

  if (!live.length) {
    const anyApproved = platforms.some(
      (row) => row.status === "approved",
    );

    await supabase
      .from("posts")
      .update({
        status: anyApproved ? "approved" : "draft",
        automation_status: "not_ready",
      })
      .eq("id", postId);
    return;
  }

  const allLivePublished = liveStatuses.every(
    (status) => status === "published",
  );
  const anyLiveFailed = liveStatuses.some(
    (status) => status === "failed",
  );
  const anyLivePublishing = liveStatuses.some(
    (status) => status === "publishing",
  );
  const anyLiveScheduled = liveStatuses.some(
    (status) => status === "scheduled",
  );

  if (allLivePublished) {
    await supabase
      .from("posts")
      .update({
        status: "published",
        automation_status: stagedOutstanding
          ? "published_with_staged_destinations"
          : "published",
      })
      .eq("id", postId);
    return;
  }

  if (anyLiveFailed) {
    await supabase
      .from("posts")
      .update({
        status: "failed",
        automation_status:
          liveStatuses.some(
            (status) =>
              status === "published" ||
              status === "scheduled" ||
              status === "publishing",
          )
            ? "partial_failure"
            : "needs_attention",
      })
      .eq("id", postId);
    return;
  }

  if (anyLivePublishing) {
    await supabase
      .from("posts")
      .update({
        status: "scheduled",
        automation_status: "publishing",
      })
      .eq("id", postId);
    return;
  }

  if (anyLiveScheduled) {
    await supabase
      .from("posts")
      .update({
        status: "scheduled",
        automation_status: "ready_for_make",
      })
      .eq("id", postId);
    return;
  }

  await supabase
    .from("posts")
    .update({
      status: "approved",
      automation_status: "not_ready",
    })
    .eq("id", postId);
}
