import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function quarterFor(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("Invalid start date.");
  return `q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const body = await request.json();

    const title = String(body.title ?? "").trim();
    const startAt = String(body.start_at ?? "").trim();

    if (!title || !startAt) {
      return NextResponse.json(
        { error: "Title and start date are required." },
        { status: 400 },
      );
    }

    const supabase = createAlpha7SupabaseAdmin();
    const slug =
      `${slugify(title) || "event"}-${new Date(startAt).getUTCFullYear()}-${randomUUID().slice(0, 6)}`;

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        slug,
        title,
        start_at: startAt,
        end_at: body.end_at || null,
        location: body.location || null,
        description: body.description || null,
        tag: body.tag || "Convention",
        event_type: body.event_type || "convention",
        quarter: quarterFor(startAt),
        state_code: body.state_code || null,
        published: Boolean(body.published ?? false),
        owner_user_id: user.id,
        route_visible: body.route_visible !== false,
        event_theme: body.event_theme || null,
        find_me_notes: body.find_me_notes || null,
        appearance_mode: body.appearance_mode || null,
        suiting_mode: body.suiting_mode || "not_suiting",
      })
      .select("*")
      .single();

    if (eventError) throw eventError;

    const { data: prep, error: prepError } = await supabase
      .from("con_preps")
      .insert({
        event_id: event.id,
        status: body.status || "planning",
        notes: body.notes || null,
        owner_user_id: user.id,
        readiness_score: 0,
      })
      .select("*")
      .single();

    if (prepError) {
      await supabase.from("events").delete().eq("id", event.id);
      throw prepError;
    }

    return NextResponse.json({ ok: true, event, prep });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
