import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { applyLoadoutTemplate } from "@/lib/conventions/deploy";

const Schema = z.object({
  conPrepId: z.string().uuid(),
  templateSlug: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid loadout." }, { status: 400 });
  }

  try {
    const result = await applyLoadoutTemplate(
      parsed.data.conPrepId,
      parsed.data.templateSlug,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not apply loadout." },
      { status: 500 },
    );
  }
}
