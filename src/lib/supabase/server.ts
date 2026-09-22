import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabasePublishableKey,
  getSupabaseSecretKey,
  getSupabaseUrl,
  supabaseAdminConfigured,
  supabasePublicConfigured,
} from "@/lib/supabase/config";

export { supabaseAdminConfigured, supabasePublicConfigured };

export async function createUserSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies.
          // Auth callbacks and Route Handlers can; this is safe to ignore here.
        }
      },
    },
  });
}

export function createAdminSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();

  if (!url || !key) {
    throw new Error("Supabase server secret environment variables are not configured.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Backwards-compatible alias used by the repository layer.
export function createServerSupabaseClient() {
  return createAdminSupabaseClient();
}

export function supabaseConfigured() {
  return supabaseAdminConfigured();
}
