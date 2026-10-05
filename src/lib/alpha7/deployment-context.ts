import { createAlpha7SupabaseAdmin } from "./supabase-admin";

export async function getAlpha7DeploymentContext(conPrepId: string) {
  const supabase = createAlpha7SupabaseAdmin();

  const { data: prep, error: prepError } = await supabase
    .from("con_preps")
    .select("*")
    .eq("id", conPrepId)
    .single();
  if (prepError) throw prepError;

  const [eventRes, hotelRes, travelRes, registrationRes, costRes] =
    await Promise.all([
      supabase.from("events").select("*").eq("id", prep.event_id).single(),
      supabase.from("hotel_stays").select("*").eq("con_prep_id", conPrepId),
      supabase.from("travel_segments").select("*").eq("con_prep_id", conPrepId),
      supabase.from("con_registrations").select("*").eq("con_prep_id", conPrepId),
      supabase.from("cost_entries").select("*").eq("con_prep_id", conPrepId),
    ]);

  if (eventRes.error) throw eventRes.error;
  if (hotelRes.error) throw hotelRes.error;
  if (travelRes.error) throw travelRes.error;
  if (registrationRes.error) throw registrationRes.error;
  if (costRes.error) throw costRes.error;

  return {
    prep,
    event: eventRes.data,
    hotelStays: hotelRes.data ?? [],
    travelSegments: travelRes.data ?? [],
    registrations: registrationRes.data ?? [],
    costs: costRes.data ?? [],
  };
}

export async function getOrCreateDeploymentThread(args: {
  userId: string;
  conPrepId: string;
  eventId: string;
  eventTitle?: string | null;
}) {
  const supabase = createAlpha7SupabaseAdmin();

  const { data: existing, error } = await supabase
    .from("copilot_threads")
    .select("*")
    .eq("user_id", args.userId)
    .eq("context_type", "deployment")
    .eq("con_prep_id", args.conPrepId)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (existing) return existing;

  const { data, error: insertError } = await supabase
    .from("copilot_threads")
    .insert({
      user_id: args.userId,
      context_type: "deployment",
      con_prep_id: args.conPrepId,
      event_id: args.eventId,
      title: args.eventTitle
        ? `Chaos Copilot — ${args.eventTitle}`
        : "Chaos Copilot — Deployment",
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return data;
}
