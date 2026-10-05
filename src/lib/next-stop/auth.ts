import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function adminEmails() {
  return new Set(
    (process.env.DUSK_ADMIN_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireDuskAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error('Supabase public environment variables are not configured.');
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {}
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) throw new Error('UNAUTHORIZED');

  const allowed = adminEmails();
  if (allowed.size > 0 && !allowed.has(user.email.toLowerCase())) {
    throw new Error('FORBIDDEN');
  }

  return user;
}
