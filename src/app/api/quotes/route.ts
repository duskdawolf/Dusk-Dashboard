import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminSupabaseClient,
  supabaseAdminConfigured,
} from "@/lib/supabase/server";

const QuoteSchema = z.object({
  name: z.string().min(1).max(120),
  contact: z.string().min(1).max(240),
  stickerType: z.string().min(1).max(80),
  quantity: z.number().int().positive().max(100000),
  size: z.string().min(1).max(80),
  notes: z.string().max(4000).optional().default(""),
});

export async function POST(request: Request) {
  const parsed = QuoteSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid quote request.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!supabaseAdminConfigured()) {
    return NextResponse.json({
      ok: true,
      mock: true,
      message:
        "Quote validated. Supabase server credentials are not configured yet, so this was not persisted.",
    });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("print_quotes").insert({
    customer_name: parsed.data.name,
    contact: parsed.data.contact,
    sticker_type: parsed.data.stickerType,
    quantity: parsed.data.quantity,
    size: parsed.data.size,
    notes: parsed.data.notes,
    status: "new",
  });

  if (error) {
    return NextResponse.json(
      { error: "Could not save quote request.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Quote request received by Dusk Sticker Factory.",
  });
}
