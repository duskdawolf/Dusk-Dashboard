import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ensureConventionCatalog } from "@/lib/conventions/catalog";

export function deploymentDocumentType(startAt?: string | null) {
  if (!startAt) return "Deployment";
  return new Date(startAt).getTime() > Date.now()
    ? "Tactical Deployment Plan"
    : "Incident Report";
}

export async function getConventionCatalog() {
  await ensureConventionCatalog();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("convention_catalog")
    .select("*")
    .eq("active", true)
    .order("attendance_rank", {
      ascending: true,
      nullsFirst: false,
    })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((item: any) => ({
    ...item,
    data_authority:
      item.verification_status === "official"
        ? "official"
        : item.verification_status === "wikifur"
          ? "wikifur"
          : "manual",
    wikifur_rank: item.attendance_rank ?? null,
    wikifur_url:
      item.verification_status === "wikifur"
        ? item.source_url
        : null,
    wikifur_location_text: [
      item.city,
      item.region,
      item.country,
    ]
      .filter(Boolean)
      .join(", "),
  }));
}

export async function getDeploymentList(userId: string) {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("con_preps")
    .select(`
      *,
      events(*),
      convention_catalog(*),
      packing_items(*),
      prep_tasks(*),
      travel_segments(*),
      hotel_stays(*),
      con_registrations(*),
      cost_entries(*)
    `)
    .or(`owner_user_id.eq.${userId},owner_user_id.is.null`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getDeployment(
  prepId: string,
  userId: string,
) {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("con_preps")
    .select(`
      *,
      events(*),
      convention_catalog(*),
      packing_items(*),
      prep_tasks(*),
      travel_segments(*),
      hotel_stays(*),
      con_registrations(*),
      cost_entries(*)
    `)
    .eq("id", prepId)
    .or(`owner_user_id.eq.${userId},owner_user_id.is.null`)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export function computeReadiness(prep: any) {
  const packing = (prep?.packing_items ?? []).filter(
    (item: any) => item.required !== false,
  );
  const leafPacking = packing.filter(
    (item: any) =>
      !packing.some(
        (candidate: any) =>
          candidate.parent_item_id === item.id,
      ),
  );

  const tasks = (prep?.prep_tasks ?? []).filter(
    (task: any) => task.required !== false,
  );
  const leafTasks = tasks.filter(
    (task: any) =>
      !tasks.some(
        (candidate: any) =>
          candidate.parent_task_id === task.id,
      ),
  );

  const signals: Array<{ done: boolean; weight: number }> = [];

  for (const item of leafPacking) {
    signals.push({ done: Boolean(item.packed), weight: 1 });
  }

  for (const task of leafTasks) {
    signals.push({
      done: ["done", "skipped"].includes(task.status),
      weight: 1,
    });
  }

  signals.push({
    done: (prep?.travel_segments ?? []).length > 0,
    weight: 3,
  });
  signals.push({
    done: (prep?.hotel_stays ?? []).length > 0,
    weight: 2,
  });
  signals.push({
    done: (prep?.con_registrations ?? []).some(
      (registration: any) =>
        registration.status === "paid" ||
        registration.status === "confirmed",
    ),
    weight: 2,
  });

  const total = signals.reduce(
    (sum, signal) => sum + signal.weight,
    0,
  );
  const completed = signals.reduce(
    (sum, signal) =>
      sum + (signal.done ? signal.weight : 0),
    0,
  );

  return total
    ? Math.round((completed / total) * 100)
    : 0;
}

export async function syncReadiness(
  prepId: string,
  userId?: string,
) {
  const supabase = createAdminSupabaseClient();

  const { data: prep, error } = await supabase
    .from("con_preps")
    .select(`
      id,owner_user_id,
      packing_items(id,packed,required,parent_item_id),
      prep_tasks(id,status,required,parent_task_id),
      travel_segments(id),
      hotel_stays(id),
      con_registrations(id,status)
    `)
    .eq("id", prepId)
    .maybeSingle();

  if (error || !prep) return 0;

  if (
    userId &&
    prep.owner_user_id &&
    prep.owner_user_id !== userId
  ) {
    return 0;
  }

  const score = computeReadiness(prep);

  await supabase
    .from("con_preps")
    .update({ readiness_score: score })
    .eq("id", prepId);

  return score;
}

export async function ensureOperatorPreferences(userId: string) {
  const supabase = createAdminSupabaseClient();

  const { data } = await supabase
    .from("operator_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return data;

  const { data: created, error } = await supabase
    .from("operator_preferences")
    .insert({
      user_id: userId,
      timezone: "America/New_York",
      airport_arrival_minutes: 90,
      safety_buffer_minutes: 15,
      sticker_rate_per_hour: 50,
      work_schedule: {
        monday: [["06:00", "14:30"]],
        tuesday: [["06:00", "14:30"]],
        wednesday: [["06:00", "14:30"]],
        thursday: [["06:00", "14:30"]],
        friday: [["06:00", "14:30"]],
        sunday: [["11:30", "20:00"]],
      },
      printing_windows: [
        { weekday: 2, start: "15:00", end: "22:00" },
        { weekday: 3, start: "15:00", end: "22:00" },
      ],
      default_loadouts: ["con-core", "fullsuit", "hotel"],
      ai_preferences: {},
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return created;
}
