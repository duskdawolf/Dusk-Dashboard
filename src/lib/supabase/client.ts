import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/config";

export function createBrowserSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    throw new Error("Supabase browser environment variables are not configured.");
  }

  return createBrowserClient(url, key);
}
