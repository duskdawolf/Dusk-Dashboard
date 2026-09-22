import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { quarterFromIso, slugify } from "@/lib/event-records";
import {
  createAdminSupabaseClient,
  supabaseAdminConfigured,
} from "@/lib/supabase/server";

const EventTypeSchema = z.enum(["convention", "meetup", "hosting", "public"]);

const EventCreateSchema = z.object({
  title: z.string().min(1).max(160),
  slug: z.string().max(180).optional().default(""),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }).nullable().optional(),
  location: z.string().max(240).optional().default(""),
  stateCode: z.string().max(8).optional().default(""),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  description: z.string().max(4000).optional().default(""),
  tag: z.string().max(80).optional().default("Event"),
  eventType: EventTypeSchema.default("meetup"),
  published: z.boolean().default(true),
});

const EventUpdateSchema = EventCreateSchema.partial().extend({
  id: z.string().uuid(),
});

const EventDeleteSchema = z.object({
  id: z.string().uuid(),
});

async function authorize() {
  const user = await getDashboardUser();
  if (!user) {
    return null;
  }

  if (!supabaseAdminConfigured()) {
    return null;
  }

  return user;
}

export async function GET() {
  const user = await authorize();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("start_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Could not load events.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(request: Request) {
  const user = await authorize();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = EventCreateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const slug = input.slug || slugify(`${input.title}-${input.startAt.slice(0, 10)}`);

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: input.title,
      slug,
      start_at: input.startAt,
      end_at: input.endAt || null,
      location: input.location || null,
      state_code: input.stateCode.trim().toUpperCase() || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      description: input.description || null,
      tag: input.tag || "Event",
      event_type: input.eventType,
      quarter: quarterFromIso(input.startAt),
      published: input.published,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Could not create event.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ event: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await authorize();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = EventUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event update.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id, ...input } = parsed.data;
  const patch: Record<string, unknown> = {};

  if (input.title !== undefined) patch.title = input.title;
  if (input.slug !== undefined && input.slug) patch.slug = input.slug;
  if (input.startAt !== undefined) {
    patch.start_at = input.startAt;
    patch.quarter = quarterFromIso(input.startAt);
  }
  if (input.endAt !== undefined) patch.end_at = input.endAt || null;
  if (input.location !== undefined) patch.location = input.location || null;
  if (input.stateCode !== undefined) {
    patch.state_code = input.stateCode.trim().toUpperCase() || null;
  }
  if (input.latitude !== undefined) patch.latitude = input.latitude;
  if (input.longitude !== undefined) patch.longitude = input.longitude;
  if (input.description !== undefined) patch.description = input.description || null;
  if (input.tag !== undefined) patch.tag = input.tag || "Event";
  if (input.eventType !== undefined) patch.event_type = input.eventType;
  if (input.published !== undefined) patch.published = input.published;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Could not update event.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ event: data });
}

export async function DELETE(request: Request) {
  const user = await authorize();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = EventDeleteSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid delete request." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    return NextResponse.json(
      { error: "Could not delete event.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
