import { NextResponse } from "next/server";
import { getDashboardUser } from "@/lib/auth";
import { getDeployment, syncReadiness } from "@/lib/con-ops";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  try {
    await syncReadiness(id);
    const prep = await getDeployment(id, user.id);

    if (!prep) {
      return NextResponse.json({ error: "Deployment not found." }, { status: 404 });
    }

    return NextResponse.json({ prep });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not load deployment.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
