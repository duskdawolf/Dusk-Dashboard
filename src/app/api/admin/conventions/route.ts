import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  ensureConventionCatalog,
  WIKIFUR_ATTENDANCE_URL,
} from "@/lib/conventions/catalog";

const CreateSchema = z.object({
  name: z.string().min(2).max(200),
  abbreviation: z.string().max(40).nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  timezone: z.string().min(2).max(100).default("America/New_York"),
  location: z.string().max(300).nullable().optional(),
  venueName: z.string().max(240).nullable().optional(),
  venueAddress: z.string().max(400).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function splitLocation(value?: string | null) {
  const parts = (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    city: parts[0] ?? null,
    region:
      parts.length > 1
        ? parts.slice(1).join(", ")
        : null,
  };
}

export async function GET() {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await ensureConventionCatalog();

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("convention_catalog")
      .select("*")
      .eq("active", true)
      .order("attendance_rank", {
        ascending: true,
        nullsFirst: false,
      })
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      conventions: data ?? [],
      sourcePolicy: [
        "official convention website/social",
        "WikiFur",
        "other/manual sources",
      ],
      wikifurSource: WIKIFUR_ATTENDANCE_URL,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not load convention catalog.",
        detail:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = CreateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid convention.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const location = splitLocation(input.location);
  const official = Boolean(input.websiteUrl);
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("convention_catalog")
    .insert({
      slug: slugify(input.name),
      series_slug: slugify(input.name),
      name: input.name,
      abbreviation: input.abbreviation || null,
      edition_year: input.startDate
        ? Number(input.startDate.slice(0, 4))
        : null,
      start_date: input.startDate || null,
      end_date: input.endDate || input.startDate || null,
      timezone: input.timezone,
      date_precision: "date_only",
      city: location.city,
      region: location.region,
      country: "US",
      venue_name: input.venueName || null,
      venue_address: input.venueAddress || null,
      website_url: input.websiteUrl || null,
      verification_status: official ? "official" : "manual",
      source_priority: official ? 10 : 30,
      source_url: input.websiteUrl || null,
      verified_at: official ? new Date().toISOString() : null,
      active: true,
      created_by: user.id,
      metadata: {
        source: official ? "official-manual-entry" : "manual",
      },
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error: "Could not add convention.",
        detail: error?.message ?? "Unknown error.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { convention: data },
    { status: 201 },
  );
}
