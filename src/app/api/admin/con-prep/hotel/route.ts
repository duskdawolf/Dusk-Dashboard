import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const Payload = z.object({
  conPrepId: z.string().uuid(),
  hotelName: z.string().min(1).max(240),
  address: z.string().max(500).optional().default(""),
  confirmationCode: z.string().max(160).optional().default(""),
  checkinAt: z.string().datetime({ offset: true }).nullable().optional(),
  checkoutAt: z.string().datetime({ offset: true }).nullable().optional(),
  costCents: z.number().int().nonnegative().nullable().optional(),
});

export async function POST(request: Request) {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = Payload.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid hotel record.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("hotel_stays")
    .insert({
      con_prep_id: input.conPrepId,
      hotel_name: input.hotelName,
      address: input.address || null,
      confirmation_code: input.confirmationCode || null,
      checkin_at: input.checkinAt ?? null,
      checkout_at: input.checkoutAt ?? null,
      cost_cents: input.costCents ?? null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Could not save hotel stay.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ hotel: data });
}
