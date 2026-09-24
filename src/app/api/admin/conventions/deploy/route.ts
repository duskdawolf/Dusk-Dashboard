import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { ensureProfileRow } from "@/lib/profiles";
import {
  deployCatalogConvention,
  deployManualConvention,
} from "@/lib/conventions/deploy";

const CatalogSchema = z.object({
  mode: z.literal("catalog"),
  catalogId: z.string().uuid(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  loadouts: z.array(z.string()).optional(),
});

const ManualSchema = z.object({
  mode: z.literal("manual"),
  name: z.string().min(2).max(200),
  startDate: z.string().date(),
  endDate: z.string().date(),
  location: z.string().min(2).max(300),
});

const Schema = z.discriminatedUnion("mode", [
  CatalogSchema,
  ManualSchema,
]);

export async function POST(request: Request) {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureProfileRow(user.id, user.role);

  const parsed = Schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid deployment request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result =
      parsed.data.mode === "catalog"
        ? await deployCatalogConvention({
            userId: user.id,
            catalogId: parsed.data.catalogId,
            startDate: parsed.data.startDate,
            endDate: parsed.data.endDate,
            loadouts: parsed.data.loadouts,
          })
        : await deployManualConvention({
            userId: user.id,
            name: parsed.data.name,
            startDate: parsed.data.startDate,
            endDate: parsed.data.endDate,
            location: parsed.data.location,
          });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create deployment.",
      },
      { status: 500 },
    );
  }
}
