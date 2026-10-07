import { NextResponse } from "next/server";
import { z } from "zod";
import { quarterFromIso, slugify } from "@/lib/event-records";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const Payload = z.object({
  conventionEditionId: z.string().uuid().nullable().optional(),
  externalId: z.string().max(240).optional(),
  slug: z.string().max(180).optional(),
  title: z.string().min(1).max(160),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }).nullable().optional(),
  location: z.string().max(240).optional().default(""),
  stateCode: z.string().max(8).optional().default(""),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  description: z.string().max(4000).optional().default(""),
  tag: z.string().max(80).optional().default("Event"),
  eventType: z
    .enum(["convention", "meetup", "hosting", "public"])
    .default("meetup"),
  published: z.boolean().default(true),
});

function authorized(request: Request) {
  const expected = process.env.MAKE_WEBHOOK_SECRET;
  if (!expected) return false;

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = Payload.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const slug =
    input.slug ||
    slugify(input.externalId || `${input.title}-${input.startAt.slice(0, 10)}`);

  const supabase = createAdminSupabaseClient();
  const { data: existing, error: lookupError } = await supabase
    .from("events")
    .select("id,convention_edition_id")
    .eq("slug", slug)
    .maybeSingle();
  if (lookupError)
    return NextResponse.json(
      { error: "Could not look up event" },
      { status: 500 },
    );
  const row = {
    slug,
    title: input.title,
    start_at: input.startAt,
    end_at: input.endAt ?? null,
    location: input.location || null,
    state_code: input.stateCode.trim().toUpperCase() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    description: input.description || null,
    tag: input.tag,
    event_type: input.eventType,
    convention_edition_id:
      input.eventType === "convention"
        ? (input.conventionEditionId ?? existing?.convention_edition_id ?? null)
        : null,
    quarter: quarterFromIso(input.startAt),
    published: input.published,
    external_id: input.externalId ?? null,
  };
  const query = existing
    ? supabase.from("events").update(row).eq("id", existing.id)
    : supabase.from("events").insert(row);
  const { data, error } = await query.select("*").single();

  if (error) {
    return NextResponse.json(
      { error: "Could not upsert event.", detail: error.message },
      { status: error.code?.startsWith("23") ? 400 : 500 },
    );
  }

  return NextResponse.json({ ok: true, event: data });
}
