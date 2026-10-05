import { NextRequest, NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const tag = request.nextUrl.searchParams.get("tag")?.trim() || null;
    const supabase = createAlpha7SupabaseAdmin();

    let eventQuery = supabase
      .from("events")
      .select(
        "id,title,start_at,end_at,location,state_code,tags,tag,suiting_mode,owner_user_id",
      )
      .or(`owner_user_id.eq.${user.id},owner_user_id.is.null`)
      .order("start_at", { ascending: true });

    if (tag) eventQuery = eventQuery.contains("tags", [tag]);

    const { data: events, error: eventError } = await eventQuery;
    if (eventError) throw eventError;

    const ids = (events ?? []).map((event) => event.id);
    if (!ids.length) return NextResponse.json({ items: [], tag });

    const { data: preps, error: prepError } = await supabase
      .from("con_preps")
      .select("id,event_id,status,readiness_score,owner_user_id")
      .in("event_id", ids);

    if (prepError) throw prepError;

    const prepMap = new Map(
      (preps ?? [])
        .filter((prep) => !prep.owner_user_id || prep.owner_user_id === user.id)
        .map((prep) => [prep.event_id, prep]),
    );

    return NextResponse.json({
      tag,
      items: (events ?? [])
        .map((event) => ({ event, prep: prepMap.get(event.id) ?? null }))
        .filter((item) => item.prep),
    });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
