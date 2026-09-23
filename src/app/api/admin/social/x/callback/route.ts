import { NextRequest, NextResponse } from "next/server";
import { getDashboardUser } from "@/lib/auth";
import { exchangeXAuthorizationCode, saveXConnection } from "@/lib/social/x";

export async function GET(request: NextRequest) {
  const user = await getDashboardUser();
  const url = request.nextUrl;
  if (!user) return NextResponse.redirect(new URL("/login", url.origin));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");
  const expectedState = request.cookies.get("dusk_x_oauth_state")?.value ?? null;
  const verifier = request.cookies.get("dusk_x_pkce_verifier")?.value ?? null;

  function finish(message?: string) {
    const target = new URL("/dashboard/posts", url.origin);
    if (message) target.searchParams.set("xError", message); else target.searchParams.set("xConnected", "1");
    const response = NextResponse.redirect(target);
    response.cookies.delete("dusk_x_oauth_state");
    response.cookies.delete("dusk_x_pkce_verifier");
    return response;
  }

  if (oauthError) return finish(oauthErrorDescription || oauthError);
  if (!code || !state || !expectedState || !verifier || state !== expectedState) {
    return finish("X authorization state could not be verified. Start the connection again.");
  }

  try {
    const tokens = await exchangeXAuthorizationCode(code, verifier);
    await saveXConnection(user.id, tokens);
    return finish();
  } catch (error) {
    return finish(error instanceof Error ? error.message : "X authorization failed.");
  }
}
