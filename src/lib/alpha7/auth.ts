import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getAdminEmails() {
  return new Set(
    (process.env.DUSK_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireAlpha7Admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Fine in read-only server rendering contexts.
        }
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id || !user.email) {
    throw new Error("UNAUTHORIZED");
  }

  const admins = getAdminEmails();
  if (admins.size && !admins.has(user.email.toLowerCase())) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export function alpha7ErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (message === "UNAUTHORIZED") return { status: 401, message: "Unauthorized" };
  if (message === "FORBIDDEN") return { status: 403, message: "Forbidden" };
  return { status: 500, message };
}
