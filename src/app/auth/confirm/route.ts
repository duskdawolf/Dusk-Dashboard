import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createUserSupabaseClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function safeNext(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  const fallback = rawType === "recovery" ? "/reset-password" : "/dashboard";
  const next = safeNext(url.searchParams.get("next"), fallback);

  if (!tokenHash || !rawType || !ALLOWED_TYPES.has(rawType as EmailOtpType)) {
    return NextResponse.redirect(
      new URL(
        `/login?recoveryError=${encodeURIComponent(
          "This authentication link is incomplete or invalid.",
        )}`,
        url.origin,
      ),
    );
  }

  const supabase = await createUserSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: rawType as EmailOtpType,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?recoveryError=${encodeURIComponent(error.message)}`,
        url.origin,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
