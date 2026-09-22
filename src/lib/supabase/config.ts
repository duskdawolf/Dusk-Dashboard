export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
}

export function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

export function getSupabaseSecretKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  );
}

export function supabasePublicConfigured() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function supabaseAdminConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseSecretKey());
}

export function getAdminEmails() {
  const raw =
    process.env.DUSK_ADMIN_EMAILS ??
    process.env.DUSK_ADMIN_EMAIL ??
    "";

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
