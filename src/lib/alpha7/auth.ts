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
          // Read-only render context.
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

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const parts = [
      typeof value.message === "string" ? value.message : null,
      typeof value.details === "string" ? value.details : null,
      typeof value.hint === "string" ? value.hint : null,
      typeof value.code === "string" ? `(${value.code})` : null,
    ].filter(Boolean);

    if (parts.length) return parts.join(" — ");
  }

  if (typeof error === "string") return error;
  return "Unknown error";
}

export function alpha7ErrorResponse(error: unknown) {
  const message = readableError(error);

  if (message === "UNAUTHORIZED") return { status: 401, message: "Unauthorized" };
  if (message === "FORBIDDEN") return { status: 403, message: "Forbidden" };

  const code =
    error && typeof error === "object"
      ? String((error as Record<string, unknown>).code ?? "")
      : "";

  if (
    code.startsWith("23") ||
    code.startsWith("PGRST") ||
    /required|invalid|constraint|null value|violates/i.test(message)
  ) {
    return { status: 400, message };
  }

  return { status: 500, message };
}
