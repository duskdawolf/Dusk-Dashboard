import { NextResponse } from "next/server";
import { getDashboardUser } from "@/lib/auth";
import { createInstagramAuthorizationRequest } from "@/lib/social/instagram";

export async function GET(request: Request) {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const authorization = createInstagramAuthorizationRequest();
    const response = NextResponse.redirect(authorization.url);

    response.cookies.set(
      "dusk_instagram_oauth_state",
      authorization.state,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 10 * 60,
        path: "/api/admin/social/instagram",
      },
    );

    return response;
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/posts?instagramError=${encodeURIComponent(
          error instanceof Error
            ? error.message
            : "Instagram OAuth setup failed.",
        )}`,
        request.url,
      ),
    );
  }
}
