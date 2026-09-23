import { NextResponse } from "next/server";
import { getDashboardUser } from "@/lib/auth";
import {
  disconnectInstagram,
  getInstagramProviderStatus,
} from "@/lib/social/instagram";

export async function GET() {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    provider: await getInstagramProviderStatus(user.id),
  });
}

export async function DELETE() {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    await disconnectInstagram(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not disconnect Instagram.",
      },
      { status: 500 },
    );
  }
}
