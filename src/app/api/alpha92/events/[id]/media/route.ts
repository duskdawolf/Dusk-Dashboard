import { NextRequest, NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import {
  ensureCaseStudy,
  requireOwnedEvent,
} from "@/lib/alpha92/event-lifecycle";

async function syncCaseStudyHero(event: any, userId: string) {
  const supabase = createAlpha7SupabaseAdmin();
  const caseStudy = await ensureCaseStudy({ event, userId });

  const { data: attached, error } = await supabase
    .from("event_media")
    .select("*,media:media_id(*)")
    .eq("event_id", event.id)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  const image = (attached ?? []).find(
    (row: any) => row.media?.kind === "image",
  );

  const { error: updateError } = await supabase
    .from("case_studies")
    .update({ image_url: image?.media?.url ?? "" })
    .eq("id", caseStudy.id);

  if (updateError) throw updateError;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const event = await requireOwnedEvent(id, user.id);
    const body = await request.json();
    const mediaId = String(body.mediaId ?? "");

    if (!mediaId) {
      return NextResponse.json(
        { error: "mediaId is required." },
        { status: 400 },
      );
    }

    const supabase = createAlpha7SupabaseAdmin();

    const { data: media, error: mediaError } = await supabase
      .from("media")
      .select("*")
      .eq("id", mediaId)
      .single();

    if (mediaError) throw mediaError;
    if (media.owner_user_id && media.owner_user_id !== user.id) {
      throw new Error("FORBIDDEN");
    }

    const { data: last } = await supabase
      .from("event_media")
      .select("sort_order")
      .eq("event_id", id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count, error: countError } = await supabase
      .from("event_media")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id);

    if (countError) throw countError;

    const { data, error } = await supabase
      .from("event_media")
      .upsert(
        {
          event_id: id,
          media_id: mediaId,
          caption_override:
            String(body.caption_override ?? "").trim() || null,
          sort_order: Number(last?.sort_order ?? -1) + 1,
          featured: Boolean(body.featured ?? count === 0),
        },
        { onConflict: "event_id,media_id" },
      )
      .select("*,media:media_id(*)")
      .single();

    if (error) throw error;

    if (data.featured) {
      await supabase
        .from("event_media")
        .update({ featured: false })
        .eq("event_id", id)
        .neq("id", data.id);
    }

    await syncCaseStudyHero(event, user.id);

    return NextResponse.json({ ok: true, attachment: data });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const event = await requireOwnedEvent(id, user.id);
    const body = await request.json();
    const attachmentId = String(body.attachmentId ?? "");

    const changes: Record<string, unknown> = {};
    if (body.caption_override !== undefined) {
      changes.caption_override =
        String(body.caption_override).trim() || null;
    }
    if (body.sort_order !== undefined) {
      changes.sort_order = Number(body.sort_order);
    }
    if (body.featured !== undefined) {
      changes.featured = Boolean(body.featured);
    }

    const supabase = createAlpha7SupabaseAdmin();

    if (changes.featured === true) {
      const { error: clearError } = await supabase
        .from("event_media")
        .update({ featured: false })
        .eq("event_id", id);

      if (clearError) throw clearError;
    }

    const { data, error } = await supabase
      .from("event_media")
      .update(changes)
      .eq("id", attachmentId)
      .eq("event_id", id)
      .select("*,media:media_id(*)")
      .single();

    if (error) throw error;

    await syncCaseStudyHero(event, user.id);

    return NextResponse.json({ ok: true, attachment: data });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const event = await requireOwnedEvent(id, user.id);
    const body = await request.json();
    const attachmentId = String(body.attachmentId ?? "");

    const supabase = createAlpha7SupabaseAdmin();
    const { error } = await supabase
      .from("event_media")
      .delete()
      .eq("id", attachmentId)
      .eq("event_id", id);

    if (error) throw error;

    await syncCaseStudyHero(event, user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
