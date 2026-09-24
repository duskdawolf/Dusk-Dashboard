import { createAdminSupabaseClient } from "@/lib/supabase/server";

function dueBefore(
  departureAt: string | null | undefined,
  relativeDays: number | null | undefined,
) {
  if (!departureAt || relativeDays == null) return null;

  const date = new Date(departureAt);
  if (Number.isNaN(date.getTime())) return null;

  date.setDate(date.getDate() - relativeDays);
  return date.toISOString();
}

export async function applyTaskTemplate(
  conPrepId: string,
  templateSlug: string,
) {
  const supabase = createAdminSupabaseClient();

  const [{ data: template, error: templateError }, { data: prep }] =
    await Promise.all([
      supabase
        .from("prep_task_templates")
        .select("id")
        .eq("slug", templateSlug)
        .is("owner_user_id", null)
        .maybeSingle(),
      supabase
        .from("con_preps")
        .select("prep_deadline_at")
        .eq("id", conPrepId)
        .maybeSingle(),
    ]);

  if (templateError || !template) {
    throw new Error(
      templateError?.message ?? "Suggested task set was not found.",
    );
  }

  const { data: items, error } = await supabase
    .from("prep_task_template_items")
    .select("*")
    .eq("template_id", template.id)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const idMap = new Map<string, string>();
  let added = 0;

  for (const item of items ?? []) {
    const parentTaskId = item.parent_template_task_id
      ? idMap.get(item.parent_template_task_id) ?? null
      : null;

    const { data: existing } = await supabase
      .from("prep_tasks")
      .select("id")
      .eq("con_prep_id", conPrepId)
      .eq("title", item.title)
      .maybeSingle();

    if (existing) {
      idMap.set(item.id, existing.id);
      continue;
    }

    const { data: created, error: createError } = await supabase
      .from("prep_tasks")
      .insert({
        con_prep_id: conPrepId,
        parent_task_id: parentTaskId,
        title: item.title,
        task_type: item.task_type,
        due_at: dueBefore(
          prep?.prep_deadline_at,
          item.relative_days_before_departure,
        ),
        duration_minutes: item.duration_minutes,
        relative_days_before_departure:
          item.relative_days_before_departure,
        status: "todo",
        sort_order: item.sort_order,
        source: `template:${templateSlug}`,
        required: true,
        notes: item.notes,
      })
      .select("id")
      .single();

    if (createError || !created) {
      throw new Error(
        createError?.message ?? `Could not add task ${item.title}.`,
      );
    }

    idMap.set(item.id, created.id);
    added += 1;
  }

  return { added };
}
