import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const Payload = z.object({
  conPrepId: z.string().uuid(),
  category: z.string().min(1).max(120),
  vendor: z.string().max(180).optional().default(""),
  description: z.string().max(500).optional().default(""),
  amountCents: z.number().int().nonnegative(),
  costStatus: z.enum(["estimated", "planned", "paid", "reimbursed"]).default("planned"),
});

export async function POST(request: Request) {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = Payload.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid cost.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  const { data: prep } = await supabase
    .from("con_preps")
    .select("event_id")
    .eq("id", input.conPrepId)
    .single();

  const { data, error } = await supabase
    .from("cost_entries")
    .insert({
      con_prep_id: input.conPrepId,
      event_id: prep?.event_id ?? null,
      owner_user_id: user.id,
      category: input.category,
      vendor: input.vendor || null,
      description: input.description || null,
      amount_cents: input.amountCents,
      currency: "USD",
      source: "manual",
      cost_status: input.costStatus,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Could not save cost.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ cost: data }, { status: 201 });
}
