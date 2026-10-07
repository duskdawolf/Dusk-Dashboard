import { NextResponse } from "next/server";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const supabase = createAlpha7SupabaseAdmin();

  const { data: caseStudy, error: caseError } = await supabase
    .from("case_studies")
    .select("id,event_id,published")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (caseError || !caseStudy?.event_id) {
    return NextResponse.json({ items: [] }, { status: 404 });
  }

  const { data: parent } = await supabase
    .from("events")
    .select("id")
    .eq("id", caseStudy.event_id)
    .eq("published", true)
    .maybeSingle();
  if (!parent) return NextResponse.json({ items: [] }, { status: 404 });

  const { data, error } = await supabase
    .from("event_media")
    .select(
      "id,caption_override,sort_order,featured,media:media_id!inner(id,title,kind,url,alt_text,caption,published)",
    )
    .eq("event_id", caseStudy.event_id)
    .eq("media.published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
