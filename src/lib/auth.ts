import { redirect } from "next/navigation";
import { getAdminEmails } from "@/lib/supabase/config";
import {
  createAdminSupabaseClient,
  createUserSupabaseClient,
  supabaseAdminConfigured,
  supabasePublicConfigured,
} from "@/lib/supabase/server";

export type DashboardUser = {
  id: string;
  email: string;
  role: "editor" | "admin";
};

export async function getDashboardUser(): Promise<DashboardUser | null> {
  if (!supabasePublicConfigured() || !supabaseAdminConfigured()) {
    return null;
  }

  const userClient = await createUserSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const email = user.email.toLowerCase();
  const configuredAdmins = getAdminEmails();

  if (configuredAdmins.includes(email)) {
    return { id: user.id, email, role: "admin" };
  }

  const adminClient = createAdminSupabaseClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin" || profile?.role === "editor") {
    return { id: user.id, email, role: profile.role };
  }

  return null;
}

export async function requireDashboardUser() {
  if (!supabasePublicConfigured() || !supabaseAdminConfigured()) {
    redirect("/login?setup=1");
  }

  const userClient = await createUserSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const dashboardUser = await getDashboardUser();

  if (!dashboardUser) {
    redirect("/login?unauthorized=1");
  }

  return dashboardUser;
}
