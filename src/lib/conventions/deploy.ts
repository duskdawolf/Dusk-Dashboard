import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { catalogLocation, eventQuarter } from "@/lib/conventions/catalog";

const DEFAULT_TASKS = [
  {
    title: "Confirm travel plan",
    task_type: "travel",
    days_before: 21,
    duration_minutes: 30,
  },
  {
    title: "Confirm hotel / lodging",
    task_type: "hotel",
    days_before: 21,
    duration_minutes: 30,
  },
  {
    title: "Confirm registration / badge",
    task_type: "registration",
    days_before: 21,
    duration_minutes: 20,
  },
  {
    title: "Finalize programming / hosting loadout",
    task_type: "programming",
    days_before: 7,
    duration_minutes: 45,
  },
  {
    title: "Print / prepare stickers and giveaways",
    task_type: "production",
    days_before: 5,
    duration_minutes: 90,
  },
  {
    title: "Clean / inspect fursuit and gear",
    task_type: "prep",
    days_before: 3,
    duration_minutes: 60,
  },
  {
    title: "Pack convention gear",
    task_type: "packing",
    days_before: 2,
    duration_minutes: 90,
  },
  {
    title: "Final bag / documents / charger check",
    task_type: "packing",
    days_before: 1,
    duration_minutes: 30,
  },
  {
    title: "Hotel checkout / room sweep",
    task_type: "hotel",
    days_before: 0,
    duration_minutes: 20,
  },
];

function dateAtLocalNoon(date: string) {
  return `${date}T12:00:00Z`;
}

function dueBefore(startDate: string, days: number) {
  const d = new Date(dateAtLocalNoon(startDate));
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(19, 0, 0, 0);
  return d.toISOString();
}

export async function applyLoadoutTemplate(
  conPrepId: string,
  templateSlug: string,
) {
  const supabase = createAdminSupabaseClient();

  const { data: template, error: templateError } = await supabase
    .from("loadout_templates")
    .select("id")
    .eq("slug", templateSlug)
    .is("owner_user_id", null)
    .maybeSingle();

  if (templateError || !template) {
    return { added: 0 };
  }

  const { data: items, error } = await supabase
    .from("loadout_template_items")
    .select("*")
    .eq("template_id", template.id)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const idMap = new Map<string, string>();
  let added = 0;

  for (const item of items ?? []) {
    const parentItemId = item.parent_template_item_id
      ? idMap.get(item.parent_template_item_id) ?? null
      : null;

    const { data: existing } = await supabase
      .from("packing_items")
      .select("id")
      .eq("con_prep_id", conPrepId)
      .eq("label", item.label)
      .maybeSingle();

    if (existing) {
      idMap.set(item.id, existing.id);
      continue;
    }

    const { data: created, error: createError } = await supabase
      .from("packing_items")
      .insert({
        con_prep_id: conPrepId,
        parent_item_id: parentItemId,
        category: item.category,
        label: item.label,
        quantity: item.quantity,
        packed: false,
        sort_order: item.sort_order,
        notes: item.notes,
        source: `template:${templateSlug}`,
        required: true,
      })
      .select("id")
      .single();

    if (createError || !created) {
      throw new Error(
        createError?.message ?? `Could not add ${item.label}.`,
      );
    }

    idMap.set(item.id, created.id);
    added += 1;
  }

  return { added };
}

export async function deployCatalogConvention(args: {
  userId: string;
  catalogId: string;
  startDate?: string | null;
  endDate?: string | null;
  loadouts?: string[];
}) {
  const supabase = createAdminSupabaseClient();

  const { data: catalog, error: catalogError } = await supabase
    .from("convention_catalog")
    .select("*")
    .eq("id", args.catalogId)
    .single();

  if (catalogError || !catalog) {
    throw new Error(catalogError?.message ?? "Convention not found.");
  }

  const startDate = args.startDate || catalog.start_date;
  const endDate = args.endDate || catalog.end_date || startDate;

  if (!startDate || !endDate) {
    throw new Error(
      "This WikiFur catalog entry does not have current dates yet. Supply the convention dates to deploy it.",
    );
  }

  // A catalog series can be redeployed in another year. Use occurrence year in
  // the event slug and keep the catalog series separate.
  const year = Number(startDate.slice(0, 4));
  const eventSlug = `${catalog.series_slug || catalog.slug}-${year}`;

  const { data: existingEvent } = await supabase
    .from("events")
    .select("id,slug")
    .eq("slug", eventSlug)
    .maybeSingle();

  let eventId = existingEvent?.id ?? null;

  if (!eventId) {
    const location = catalogLocation(catalog);

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        slug: eventSlug,
        owner_user_id: args.userId,
        title: `${catalog.name.replace(/\s+\d{4}$/, "")} ${year}`,
        start_at: catalog.starts_at || dateAtLocalNoon(startDate),
        end_at: catalog.ends_at || `${endDate}T23:59:00Z`,
        location,
        description:
          "Tactical Deployment Plan created from the Dusk Convention Catalog.",
        tag: "Convention",
        event_type: "convention",
        quarter: eventQuarter(startDate),
        state_code:
          catalog.country === "USA" && catalog.region?.length <= 3
            ? catalog.region
            : null,
        published: true,
      })
      .select("id")
      .single();

    if (eventError || !event) {
      throw new Error(
        eventError?.message ?? "Could not create deployment event.",
      );
    }

    eventId = event.id;
  }

  const { data: existingPrep } = await supabase
    .from("con_preps")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  let prepId = existingPrep?.id ?? null;

  if (!prepId) {
    const { data: prep, error: prepError } = await supabase
      .from("con_preps")
      .insert({
        event_id: eventId,
        owner_user_id: args.userId,
        catalog_id: catalog.id,
        status: "planning",
        prep_deadline_at: catalog.starts_at || dateAtLocalNoon(startDate),
        readiness_score: 10,
        ai_summary:
          "Deployment created. Travel, hotel, registration, packing, and programming details still need review.",
      })
      .select("id")
      .single();

    if (prepError || !prep) {
      throw new Error(
        prepError?.message ?? "Could not create Con Ops deployment.",
      );
    }

    prepId = prep.id;

    const taskRows = DEFAULT_TASKS.map((task, index) => ({
      con_prep_id: prepId,
      title: task.title,
      task_type: task.task_type,
      due_at: dueBefore(startDate, task.days_before),
      duration_minutes: task.duration_minutes,
      status: "todo",
      sort_order: index * 10,
      source: "deployment-default",
      required: true,
      relative_days_before_departure: task.days_before,
    }));

    const { error: taskError } = await supabase
      .from("prep_tasks")
      .insert(taskRows);

    if (taskError) throw new Error(taskError.message);
  }

  let defaultLoadouts = ["con-core", "fullsuit", "hotel"];

  if (!args.loadouts?.length) {
    const { data: preferences } = await supabase
      .from("operator_preferences")
      .select("default_loadouts")
      .eq("user_id", args.userId)
      .maybeSingle();

    if (
      Array.isArray(preferences?.default_loadouts) &&
      preferences.default_loadouts.length
    ) {
      defaultLoadouts = preferences.default_loadouts.filter(
        (item: unknown): item is string => typeof item === "string",
      );
    }
  }

  const loadouts =
    args.loadouts?.length
      ? args.loadouts
      : defaultLoadouts;

  let packingAdded = 0;
  for (const loadout of loadouts) {
    const result = await applyLoadoutTemplate(prepId, loadout);
    packingAdded += result.added;
  }

  return {
    eventId,
    prepId,
    eventSlug,
    packingAdded,
    tacticalDeploymentUrl: `/chaos/${eventSlug}`,
  };
}

export async function deployManualConvention(args: {
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
}) {
  const supabase = createAdminSupabaseClient();
  const slugBase = args.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const year = args.startDate.slice(0, 4);
  const slug = `${slugBase}-${year}`;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .upsert(
      {
        slug,
        owner_user_id: args.userId,
        title: `${args.name} ${year}`,
        start_at: dateAtLocalNoon(args.startDate),
        end_at: `${args.endDate}T23:59:00Z`,
        location: args.location,
        description: "Manual Tactical Deployment Plan.",
        tag: "Convention",
        event_type: "convention",
        quarter: eventQuarter(args.startDate),
        published: true,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (eventError || !event) {
    throw new Error(
      eventError?.message ?? "Could not create manual convention.",
    );
  }

  const { data: existingPrep } = await supabase
    .from("con_preps")
    .select("id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingPrep) {
    return {
      eventId: event.id,
      prepId: existingPrep.id,
      eventSlug: slug,
      tacticalDeploymentUrl: `/chaos/${slug}`,
    };
  }

  const { data: prep, error: prepError } = await supabase
    .from("con_preps")
    .insert({
      event_id: event.id,
      owner_user_id: args.userId,
      status: "planning",
      prep_deadline_at: dateAtLocalNoon(args.startDate),
      readiness_score: 10,
    })
    .select("id")
    .single();

  if (prepError || !prep) {
    throw new Error(
      prepError?.message ?? "Could not create manual deployment.",
    );
  }

  for (const loadout of ["con-core", "fullsuit", "hotel"]) {
    await applyLoadoutTemplate(prep.id, loadout);
  }

  const taskRows = DEFAULT_TASKS.map((task, index) => ({
    con_prep_id: prep.id,
    title: task.title,
    task_type: task.task_type,
    due_at: dueBefore(args.startDate, task.days_before),
    duration_minutes: task.duration_minutes,
    status: "todo",
    sort_order: index * 10,
    source: "deployment-default",
    required: true,
    relative_days_before_departure: task.days_before,
  }));

  await supabase.from("prep_tasks").insert(taskRows);

  return {
    eventId: event.id,
    prepId: prep.id,
    eventSlug: slug,
    tacticalDeploymentUrl: `/chaos/${slug}`,
  };
}
