import { NextRequest, NextResponse } from "next/server";
import { requireAlpha7Admin, alpha7ErrorResponse } from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const conPrepId = request.nextUrl.searchParams.get("conPrepId");
    if (!conPrepId) {
      return NextResponse.json({ error: "conPrepId is required" }, { status: 400 });
    }

    const supabase = createAlpha7SupabaseAdmin();
    const { data, error } = await supabase
      .from("copilot_actions")
      .select("*")
      .eq("user_id", user.id)
      .eq("con_prep_id", conPrepId)
      .in("action_type", [
        "upsert_hotel",
        "upsert_travel",
        "upsert_registration",
        "upsert_cost",
        "update_event",
        "update_con_prep",
      ])
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
