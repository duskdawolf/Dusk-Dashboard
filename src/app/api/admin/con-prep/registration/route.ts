import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const Payload = z.object({
  conPrepId: z.string().uuid(),
  badgeName: z.string().min(1).max(160),
  status: z.enum(["needed", "ordered", "paid", "confirmed"]),
  costCents: z.number().int().nonnegative().nullable().optional(),
  confirmationCode: z.string().max(160).optional().default(""),
});

export async function POST(request: Request) {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = Payload.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("con_registrations")
    .upsert(
      {
        con_prep_id: input.conPrepId,
        badge_name: input.badgeName,
        status: input.status,
        cost_cents: input.costCents ?? null,
        confirmation_code: input.confirmationCode || null,
      },
      { onConflict: "con_prep_id" }
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Could not save registration.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ registration: data });
}
