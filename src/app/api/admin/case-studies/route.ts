import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const Payload = z.object({
  eventId: z.string().uuid(),
  slug: z.string().min(1).max(180),
  title: z.string().min(1).max(200),
  imageUrl: z.string().max(2000).optional().default(""),
  status: z.string().min(1).max(120),
  challenge: z.string().min(1).max(5000),
  solution: z.string().min(1).max(5000),
  outcome: z.string().min(1).max(5000),
  published: z.boolean(),
});

export async function GET() {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ caseStudies: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = Payload.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid case study.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  let imageUrl = input.imageUrl.trim();

  if (!imageUrl) {
    const { data: firstImage } = await supabase
      .from("media")
      .select("url")
      .eq("event_id", input.eventId)
      .eq("kind", "image")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    imageUrl = firstImage?.url ?? "/assets/logo-graffiti.png";
  }

  const row = {
    event_id: input.eventId,
    slug: input.slug,
    title: input.title,
    image_url: imageUrl,
    status: input.status,
    challenge: input.challenge,
    solution: input.solution,
    outcome: input.outcome,
    published: input.published,
    published_at: input.published ? new Date().toISOString() : null,
  };

  const { data: existing } = await supabase
    .from("case_studies")
    .select("id")
    .or(`event_id.eq.${input.eventId},slug.eq.${input.slug}`)
    .limit(1)
    .maybeSingle();

  const operation = existing
    ? supabase.from("case_studies").update(row).eq("id", existing.id)
    : supabase.from("case_studies").insert(row);

  const { data, error } = await operation.select("*").single();

  if (error) {
    return NextResponse.json(
      { error: "Could not save case study.", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ caseStudy: data }, { status: existing ? 200 : 201 });
}
