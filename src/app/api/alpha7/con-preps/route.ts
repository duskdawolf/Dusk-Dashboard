import { NextResponse } from "next/server";
import { requireAlpha7Admin, alpha7ErrorResponse } from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

function time(value?: string | null) {
  if (!value) return Number.NaN;
  return new Date(value).valueOf();
}

export async function GET() {
  try {
    const user = await requireAlpha7Admin();
    const supabase = createAlpha7SupabaseAdmin();

    const { data: preps, error } = await supabase
      .from("con_preps")
      .select("id,event_id,status,owner_user_id,created_at");

    if (error) throw error;

    const usablePreps = (preps ?? []).filter(
      (prep) => !prep.owner_user_id || prep.owner_user_id === user.id,
    );

    const eventIds = [...new Set(usablePreps.map((prep) => prep.event_id))];

    const { data: events, error: eventError } = await supabase
      .from("events")
      .select(
        "id,title,start_at,end_at,location,state_code,next_stop_asset_status,next_stop_asset_url",
      )
      .in("id", eventIds);

    if (eventError) throw eventError;

    const eventMap = new Map((events ?? []).map((event) => [event.id, event]));
    const now = Date.now();

    const items = usablePreps
      .map((prep) => ({
        ...prep,
        event: eventMap.get(prep.event_id) ?? null,
      }))
      .sort((a, b) => {
        const aStart = time(a.event?.start_at);
        const bStart = time(b.event?.start_at);
        const aEnd = time(a.event?.end_at) || aStart;
        const bEnd = time(b.event?.end_at) || bStart;

        const aActive =
          Number.isFinite(aStart) &&
          aStart <= now &&
          Number.isFinite(aEnd) &&
          aEnd >= now;

        const bActive =
          Number.isFinite(bStart) &&
          bStart <= now &&
          Number.isFinite(bEnd) &&
          bEnd >= now;

        if (aActive !== bActive) return aActive ? -1 : 1;

        const aUpcoming = Number.isFinite(aStart) && aStart > now;
        const bUpcoming = Number.isFinite(bStart) && bStart > now;

        if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;

        if (aUpcoming && bUpcoming) return aStart - bStart;

        // Past events: newest first.
        if (Number.isFinite(aStart) && Number.isFinite(bStart)) {
          return bStart - aStart;
        }

        return 0;
      });

    return NextResponse.json({ items });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
