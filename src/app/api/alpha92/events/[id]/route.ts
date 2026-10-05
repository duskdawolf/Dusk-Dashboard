import { NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import {
  eventIsPast,
  requireOwnedEvent,
} from "@/lib/alpha92/event-lifecycle";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const event = await requireOwnedEvent(id, user.id);
    const supabase = createAlpha7SupabaseAdmin();

    const [
      prepRes,
      caseRes,
      mediaRes,
      subEventRes,
      costRes,
    ] = await Promise.all([
      supabase
        .from("con_preps")
        .select("*")
        .eq("event_id", id)
        .maybeSingle(),
      supabase
        .from("case_studies")
        .select("*")
        .eq("event_id", id)
        .maybeSingle(),
      supabase
        .from("event_media")
        .select("*,media:media_id(*)")
        .eq("event_id", id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("deployment_sub_events")
        .select("*")
        .eq("event_id", id)
        .order("starts_at", { ascending: true }),
      supabase
        .from("cost_entries")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: true }),
    ]);

    for (const result of [
      prepRes,
      caseRes,
      mediaRes,
      subEventRes,
      costRes,
    ]) {
      if (result.error) throw result.error;
    }

    return NextResponse.json({
      event,
      lifecycle: eventIsPast(event) ? "past" : "upcoming",
      prep: prepRes.data,
      caseStudy: caseRes.data,
      media: mediaRes.data ?? [],
      subEvents: subEventRes.data ?? [],
      costs: costRes.data ?? [],
    });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
