import { NextResponse } from "next/server";
import { getDashboardUser } from "@/lib/auth";
import { disconnectX, getXProviderStatus } from "@/lib/social/x";

export async function GET() {
  const user = await getDashboardUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ provider: await getXProviderStatus(user.id) });
}

export async function DELETE() {
  const user = await getDashboardUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try { await disconnectX(user.id); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not disconnect X." }, { status: 500 }); }
}
