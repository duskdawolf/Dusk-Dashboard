import { ConOpsManager } from "@/components/ConOpsManager";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ensureConventionCatalog } from "@/lib/conventions/catalog";
import { requireDashboardUser } from "@/lib/auth";
import { ensureProfileRow } from "@/lib/profiles";

export const metadata = {
  title: "Convention Ops · Dusk Dashboard",
};

export const dynamic = "force-dynamic";

export default async function ConventionOpsPage() {
  const user = await requireDashboardUser();
  await ensureProfileRow(user.id, user.role);
  const supabase = createAdminSupabaseClient();

  let catalogError: string | null = null;

  try {
    await ensureConventionCatalog();
  } catch (error) {
    catalogError =
      error instanceof Error ? error.message : "Convention catalog unavailable.";
  }

  const [
    { data: preps, error: prepError },
    { data: conventions, error: conventionError },
    { data: loadouts, error: loadoutError },
  ] = await Promise.all([
    supabase
      .from("con_preps")
      .select(`
        *,
        events(id,title,slug,start_at,end_at,location,event_type),
        packing_items(*),
        prep_tasks(*),
        travel_segments(*),
        hotel_stays(*),
        con_registrations(*),
        cost_entries(*)
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("convention_catalog")
      .select("*")
      .eq("active", true)
      .order("attendance_rank", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabase
      .from("loadout_templates")
      .select("id,slug,name,description,category")
      .eq("active", true)
      .order("category")
      .order("name"),
  ]);

  const error =
    prepError?.message ||
    conventionError?.message ||
    loadoutError?.message ||
    catalogError;

  return (
    <ConOpsManager
      initialPreps={(preps ?? []) as never[]}
      conventions={(conventions ?? []) as never[]}
      loadouts={(loadouts ?? []) as never[]}
      userId={user.id}
      initialError={error ?? ""}
    />
  );
}
