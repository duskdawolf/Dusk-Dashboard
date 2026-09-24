import Link from "next/link";
import { notFound } from "next/navigation";
import { ConventionDeployment } from "@/components/ConventionDeployment";
import { getDashboardUser } from "@/lib/auth";
import {
  getDeployment,
  syncReadiness,
  ensureOperatorPreferences,
} from "@/lib/con-ops";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ConventionDeploymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getDashboardUser();
  if (!user) return null;

  const { id } = await params;

  try {
    await ensureOperatorPreferences(user.id);
    await syncReadiness(id, user.id);

    const [prep, templatesResult] = await Promise.all([
      getDeployment(id, user.id),
      createAdminSupabaseClient()
        .from("loadout_templates")
        .select("id,slug,name,description,category")
        .eq("active", true)
        .or(`owner_user_id.is.null,owner_user_id.eq.${user.id}`)
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    if (!prep) notFound();

    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/con-prep"
          className="inline-flex text-sm font-black text-dusk-aqua"
        >
          ← Deployment Command
        </Link>

        <ConventionDeployment
          initialPrep={prep as never}
          loadoutTemplates={(templatesResult.data ?? []) as never[]}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="panel">
        <div className="eyebrow">Convention Operations</div>
        <h1 className="text-3xl font-black">
          This deployment could not be loaded.
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }
}
