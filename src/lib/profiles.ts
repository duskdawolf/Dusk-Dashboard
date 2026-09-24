import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function ensureProfileRow(
  userId: string,
  role: "viewer" | "editor" | "admin" = "admin",
) {
  const supabase = createAdminSupabaseClient();

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", userId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      role,
    })
    .select("id,role")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? "Could not initialize the Dusk operator profile.",
    );
  }

  return data;
}
