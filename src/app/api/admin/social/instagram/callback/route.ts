import { NextResponse } from "next/server";
import { getDashboardUser } from "@/lib/auth";
import {
  exchangeInstagramAuthorizationCode,
  saveInstagramConnection,
} from "@/lib/social/instagram";

export async function GET(request: Request) {
  const user = await getDashboardUser();
  const url = new URL(request.url);

  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const rawCode = url.searchParams.get("code");
  const code = rawCode?.replace(/#_$/, "") ?? null;
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");
  const errorDescription =
    url.searchParams.get("error_description");

  const stateCookie =
    request.headers
      .get("cookie")
      ?.match(
        /(?:^|;\s*)dusk_instagram_oauth_state=([^;]+)/,
      )?.[1] ?? null;

  const redirect = (message?: string) => {
    const target = new URL("/dashboard/posts", url.origin);

    if (message) {
      target.searchParams.set("instagramError", message);
    } else {
      target.searchParams.set("instagramConnected", "1");
    }

    const response = NextResponse.redirect(target);
    response.cookies.delete("dusk_instagram_oauth_state");
    return response;
  };

  if (error) {
    return redirect(
      errorDescription ||
        errorReason ||
        error ||
        "Instagram authorization was denied.",
    );
  }

  if (
    !code ||
    !state ||
    !stateCookie ||
    state !== decodeURIComponent(stateCookie)
  ) {
    return redirect(
      "Instagram authorization state could not be verified. Start the connection again.",
    );
  }

  try {
    const token = await exchangeInstagramAuthorizationCode(code);
    await saveInstagramConnection(user.id, token);
    return redirect();
  } catch (exchangeError) {
    return redirect(
      exchangeError instanceof Error
        ? exchangeError.message
        : "Instagram authorization failed.",
    );
  }
}
