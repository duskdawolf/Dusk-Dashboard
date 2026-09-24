import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { loadSocialPublishJob } from "@/lib/social/jobs";
import { platformIsLive, validateSocialJob } from "@/lib/social/providers";
import { reconcileSocialPost } from "@/lib/social/reconcile";

export type CopilotProposal = {
  actionType: string;
  title: string;
  explanation?: string | null;
  payload: Record<string, unknown>;
  riskLevel?: "normal" | "sensitive";
};

export async function createCopilotAction(args: {
  threadId: string;
  userId: string;
  conPrepId?: string | null;
  postId?: string | null;
  proposal: CopilotProposal;
}) {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("copilot_actions")
    .insert({
      thread_id: args.threadId,
      user_id: args.userId,
      con_prep_id: args.conPrepId ?? null,
      post_id: args.postId ?? null,
      action_type: args.proposal.actionType,
      title: args.proposal.title,
      explanation: args.proposal.explanation ?? null,
      payload: args.proposal.payload,
      risk_level: args.proposal.riskLevel ?? "normal",
      requires_reauth: args.proposal.riskLevel === "sensitive",
      status: "proposed",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create Copilot action.");
  }

  return data;
}

export async function applyCopilotAction(args: {
  actionId: string;
  userId: string;
}) {
  const supabase = createAdminSupabaseClient();

  const { data: action, error } = await supabase
    .from("copilot_actions")
    .select("*")
    .eq("id", args.actionId)
    .eq("user_id", args.userId)
    .maybeSingle();

  if (error || !action) {
    throw new Error(error?.message ?? "Copilot action not found.");
  }

  if (!["proposed", "approved"].includes(action.status)) {
    throw new Error("This Copilot action is no longer pending.");
  }

  await supabase
    .from("copilot_actions")
    .update({
      status: "executing",
      approved_at: new Date().toISOString(),
    })
    .eq("id", action.id);

  try {
    const payload = (action.payload ?? {}) as Record<string, any>;
    let result: Record<string, unknown> = {};

    if (action.action_type === "add_packing_items") {
      if (!action.con_prep_id) throw new Error("No deployment is attached.");

      const items = Array.isArray(payload.items) ? payload.items : [];
      const parentByLabel = new Map<string, string>();
      let added = 0;

      for (const item of items) {
        let parentId: string | null = null;

        if (item.parentLabel) {
          if (parentByLabel.has(item.parentLabel)) {
            parentId = parentByLabel.get(item.parentLabel)!;
          } else {
            const { data: existingParent } = await supabase
              .from("packing_items")
              .select("id")
              .eq("con_prep_id", action.con_prep_id)
              .eq("label", item.parentLabel)
              .maybeSingle();

            parentId = existingParent?.id ?? null;
          }
        }

        const { data: existing } = await supabase
          .from("packing_items")
          .select("id")
          .eq("con_prep_id", action.con_prep_id)
          .eq("label", item.label)
          .maybeSingle();

        if (existing) {
          parentByLabel.set(item.label, existing.id);
          continue;
        }

        const { data: created, error: createError } = await supabase
          .from("packing_items")
          .insert({
            con_prep_id: action.con_prep_id,
            parent_item_id: parentId,
            category: item.category || "General",
            label: item.label,
            quantity: Math.max(1, Number(item.quantity || 1)),
            packed: false,
            source: "chaos-copilot",
            required: item.required !== false,
          })
          .select("id")
          .single();

        if (createError || !created) {
          throw new Error(
            createError?.message ?? `Could not add ${item.label}.`,
          );
        }

        parentByLabel.set(item.label, created.id);
        added += 1;
      }

      result = { added };
    } else if (action.action_type === "add_tasks") {
      if (!action.con_prep_id) throw new Error("No deployment is attached.");

      const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
      const parentByTitle = new Map<string, string>();
      let added = 0;

      for (const task of tasks) {
        let parentId: string | null = null;

        if (task.parentTitle) {
          if (parentByTitle.has(task.parentTitle)) {
            parentId = parentByTitle.get(task.parentTitle)!;
          } else {
            const { data: parent } = await supabase
              .from("prep_tasks")
              .select("id")
              .eq("con_prep_id", action.con_prep_id)
              .eq("title", task.parentTitle)
              .maybeSingle();
            parentId = parent?.id ?? null;
          }
        }

        const { data: existing } = await supabase
          .from("prep_tasks")
          .select("id")
          .eq("con_prep_id", action.con_prep_id)
          .eq("title", task.title)
          .maybeSingle();

        if (existing) {
          parentByTitle.set(task.title, existing.id);
          continue;
        }

        const { data: created, error: createError } = await supabase
          .from("prep_tasks")
          .insert({
            con_prep_id: action.con_prep_id,
            parent_task_id: parentId,
            title: task.title,
            task_type: task.taskType || "prep",
            due_at: task.dueAt || null,
            duration_minutes: task.durationMinutes || null,
            status: "todo",
            source: "chaos-copilot",
            required: task.required !== false,
          })
          .select("id")
          .single();

        if (createError || !created) {
          throw new Error(
            createError?.message ?? `Could not add ${task.title}.`,
          );
        }

        parentByTitle.set(task.title, created.id);
        added += 1;
      }

      result = { added };
    } else if (action.action_type === "social_copy_plan") {
      const postId = action.post_id || payload.postId;
      if (!postId) throw new Error("No Social Ops post is attached.");

      if (typeof payload.masterCaption === "string") {
        const { error: postError } = await supabase
          .from("posts")
          .update({ master_caption: payload.masterCaption })
          .eq("id", postId);

        if (postError) throw new Error(postError.message);
      }

      const variants =
        payload.platformCaptions &&
        typeof payload.platformCaptions === "object"
          ? payload.platformCaptions
          : {};

      for (const [platform, caption] of Object.entries(variants)) {
        if (typeof caption !== "string") continue;
        const { error: platformError } = await supabase
          .from("post_platforms")
          .update({ platform_caption_override: caption })
          .eq("post_id", postId)
          .eq("platform", platform);

        if (platformError) throw new Error(platformError.message);
      }

      result = { updated: true };
    } else if (action.action_type === "social_schedule") {
      const postId = action.post_id || payload.postId;
      if (!postId) throw new Error("No Social Ops post is attached.");
      if (!payload.scheduledAt) throw new Error("No schedule time supplied.");

      const requestedPlatforms = Array.isArray(payload.platforms)
        ? payload.platforms
        : [];

      const { data: platformRows, error: platformLoadError } = await supabase
        .from("post_platforms")
        .select("id,platform,status")
        .eq("post_id", postId)
        .in("platform", requestedPlatforms);

      if (platformLoadError) throw new Error(platformLoadError.message);

      const liveRows = (platformRows ?? []).filter(
        (row: any) =>
          row.status !== "published" &&
          platformIsLive(row.platform),
      );

      if (!liveRows.length) {
        throw new Error(
          "No requested live provider destinations are available to schedule.",
        );
      }

      for (const row of liveRows) {
        const job = await loadSocialPublishJob(row.id);
        if (!job) throw new Error(`Could not load ${row.platform} publishing job.`);

        const validation = validateSocialJob(job);
        if (!validation.valid) {
          throw new Error(
            `${row.platform} cannot be scheduled: ${validation.errors.join(" ")}`,
          );
        }
      }

      for (const row of liveRows) {
        const { error: scheduleError } = await supabase
          .from("post_platforms")
          .update({
            status: "scheduled",
            scheduled_at: payload.scheduledAt,
            last_error: null,
          })
          .eq("id", row.id);

        if (scheduleError) throw new Error(scheduleError.message);
      }

      await supabase
        .from("posts")
        .update({
          status: "scheduled",
          scheduled_at: payload.scheduledAt,
          automation_status: "ready_for_make",
        })
        .eq("id", postId);

      await reconcileSocialPost(postId);

      result = {
        scheduledAt: payload.scheduledAt,
        platforms: liveRows.map((row: any) => row.platform),
      };
    } else if (action.action_type === "publish_now") {
      const postId = action.post_id || payload.postId;
      if (!postId) throw new Error("No Social Ops post is attached.");

      const { data: platformRows, error: platformLoadError } = await supabase
        .from("post_platforms")
        .select("id,platform,status")
        .eq("post_id", postId);

      if (platformLoadError) throw new Error(platformLoadError.message);

      const liveRows = (platformRows ?? []).filter(
        (row: any) =>
          row.status !== "published" &&
          platformIsLive(row.platform),
      );

      if (!liveRows.length) {
        throw new Error("There are no unpublished live destinations on this post.");
      }

      for (const row of liveRows) {
        const job = await loadSocialPublishJob(row.id);
        if (!job) throw new Error(`Could not load ${row.platform} publishing job.`);

        const validation = validateSocialJob(job);
        if (!validation.valid) {
          throw new Error(
            `${row.platform} cannot publish: ${validation.errors.join(" ")}`,
          );
        }
      }

      const publishAt = new Date().toISOString();

      for (const row of liveRows) {
        const { error: scheduleError } = await supabase
          .from("post_platforms")
          .update({
            status: "scheduled",
            scheduled_at: publishAt,
            last_error: null,
          })
          .eq("id", row.id);

        if (scheduleError) throw new Error(scheduleError.message);
      }

      await supabase
        .from("posts")
        .update({
          status: "scheduled",
          scheduled_at: publishAt,
          automation_status: "ready_for_make",
        })
        .eq("id", postId);

      await reconcileSocialPost(postId);

      result = {
        queuedForImmediateDispatch: true,
        scheduledAt: publishAt,
        platforms: liveRows.map((row: any) => row.platform),
      };
    } else {
      throw new Error(`Unsupported Copilot action: ${action.action_type}`);
    }

    await supabase
      .from("copilot_actions")
      .update({
        status: "completed",
        executed_at: new Date().toISOString(),
        result,
        error_message: null,
      })
      .eq("id", action.id);

    return { actionId: action.id, result };
  } catch (error) {
    await supabase
      .from("copilot_actions")
      .update({
        status: "failed",
        error_message:
          error instanceof Error ? error.message : "Action failed.",
      })
      .eq("id", action.id);

    throw error;
  }
}
