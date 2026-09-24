import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const CreateSchema = z.object({
  conPrepId: z.string().uuid(),
  parentTaskId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(300),
  taskType: z.string().min(1).max(80).default("prep"),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const UpdateSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(["todo", "scheduled", "doing", "done", "skipped"]),
});

async function syncParent(parentId: string | null) {
  if (!parentId) return;
  const supabase = createAdminSupabaseClient();
  const { data: children } = await supabase
    .from("prep_tasks")
    .select("status")
    .eq("parent_task_id", parentId);

  if (!children?.length) return;

  const complete = children.every((task: { status: string }) =>
    ["done", "skipped"].includes(task.status),
  );

  if (complete) {
    await supabase
      .from("prep_tasks")
      .update({ status: "done" })
      .eq("id", parentId);
  }

  const { data: parent } = await supabase
    .from("prep_tasks")
    .select("parent_task_id")
    .eq("id", parentId)
    .maybeSingle();

  await syncParent(parent?.parent_task_id ?? null);
}

export async function POST(request: Request) {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = CreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid prep task.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("prep_tasks")
    .insert({
      con_prep_id: parsed.data.conPrepId,
      parent_task_id: parsed.data.parentTaskId ?? null,
      title: parsed.data.title,
      task_type: parsed.data.taskType,
      due_at: parsed.data.dueAt ?? null,
      status: "todo",
      source: "manual",
      required: true,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Could not add prep task.", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ task: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = UpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid prep task." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: task } = await supabase
    .from("prep_tasks")
    .select("parent_task_id,con_prep_id")
    .eq("id", parsed.data.taskId)
    .maybeSingle();

  const { error } = await supabase
    .from("prep_tasks")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.taskId);

  if (error) {
    return NextResponse.json(
      { error: "Could not update prep task.", detail: error.message },
      { status: 500 },
    );
  }

  if (parsed.data.status === "done" && task?.con_prep_id) {
    const { data: allTasks } = await supabase
      .from("prep_tasks")
      .select("id,parent_task_id")
      .eq("con_prep_id", task.con_prep_id);

    const descendants: string[] = [];
    const queue = [parsed.data.taskId];

    while (queue.length) {
      const parentId = queue.shift()!;
      for (const candidate of allTasks ?? []) {
        if (
          candidate.parent_task_id === parentId &&
          !descendants.includes(candidate.id)
        ) {
          descendants.push(candidate.id);
          queue.push(candidate.id);
        }
      }
    }

    if (descendants.length) {
      await supabase
        .from("prep_tasks")
        .update({ status: "done" })
        .in("id", descendants);
    }
  }

  await syncParent(task?.parent_task_id ?? null);

  return NextResponse.json({ ok: true });
}
