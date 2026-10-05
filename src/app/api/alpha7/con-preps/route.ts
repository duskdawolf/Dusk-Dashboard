import { NextResponse } from "next/server";
import { requireAlpha7Admin, alpha7ErrorResponse } from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

export async function GET() {
  try {
    const user = await requireAlpha7Admin();
    const supabase = createAlpha7SupabaseAdmin();

    let query = supabase
      .from("con_preps")
      .select("id,event_id,status,owner_user_id,created_at")
      .order("created_at", { ascending: false });

    // Alpha remains single-operator, but prefer owned rows while keeping
    // legacy null-owner rows usable.
    const { data: preps, error } = await query;
    if (error) throw error;

    const eventIds = [...new Set((preps ?? []).map((p) => p.event_id))];
    const { data: events, error: eventError } = await supabase
      .from("events")
      .select("id,title,start_at,end_at,location,state_code,next_stop_asset_status,next_stop_asset_url")
      .in("id", eventIds);

    if (eventError) throw eventError;
    const eventMap = new Map((events ?? []).map((event) => [event.id, event]));

    return NextResponse.json({
      items: (preps ?? [])
        .filter((prep) => !prep.owner_user_id || prep.owner_user_id === user.id)
        .map((prep) => ({
          ...prep,
          event: eventMap.get(prep.event_id) ?? null,
        })),
    });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
