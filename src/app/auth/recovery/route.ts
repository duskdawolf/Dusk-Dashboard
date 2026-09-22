import { NextResponse } from "next/server";
import { createUserSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") || "/reset-password";

  // New v24.4.1 token-hash links can safely work across browsers/devices.
  if (tokenHash && type === "recovery") {
    const confirm = new URL("/auth/confirm", url.origin);
    confirm.searchParams.set("token_hash", tokenHash);
    confirm.searchParams.set("type", "recovery");
    confirm.searchParams.set("next", next);
    return NextResponse.redirect(confirm);
  }

  // Backwards compatibility for already-sent v24.4 PKCE recovery emails.
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createUserSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL(
          `/login?recoveryError=${encodeURIComponent(error.message)}`,
          url.origin,
        ),
      );
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
