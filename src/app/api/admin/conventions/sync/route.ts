import { NextResponse } from "next/server";
import { getDashboardUser } from "@/lib/auth";
import { syncWikiFurConventionCatalog } from "@/lib/conventions/catalog";

export async function POST() {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await syncWikiFurConventionCatalog();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not sync WikiFur convention catalog.",
        detail: error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 500 },
    );
  }
}
