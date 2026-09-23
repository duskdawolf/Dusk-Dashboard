import { NextResponse } from "next/server";
import { getDashboardUser } from "@/lib/auth";
import { createXAuthorizationRequest } from "@/lib/social/x";

export async function GET(request: Request) {
  const user = await getDashboardUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  try {
    const authorization = createXAuthorizationRequest();
    const response = NextResponse.redirect(authorization.url);
    const cookie = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 10 * 60, path: "/api/admin/social/x" };
    response.cookies.set("dusk_x_oauth_state", authorization.state, cookie);
    response.cookies.set("dusk_x_pkce_verifier", authorization.verifier, cookie);
    return response;
  } catch (error) {
    return NextResponse.redirect(new URL(`/dashboard/posts?xError=${encodeURIComponent(error instanceof Error ? error.message : "X OAuth setup failed.")}`, request.url));
  }
}
