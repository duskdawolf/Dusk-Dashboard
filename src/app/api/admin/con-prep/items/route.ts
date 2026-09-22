import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const UpdateSchema = z.object({
  itemId: z.string().uuid(),
  packed: z.boolean(),
});

export async function PATCH(request: Request) {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = UpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid packing item." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("packing_items")
    .update({ packed: parsed.data.packed })
    .eq("id", parsed.data.itemId);

  if (error) {
    return NextResponse.json(
      { error: "Could not update packing item.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
