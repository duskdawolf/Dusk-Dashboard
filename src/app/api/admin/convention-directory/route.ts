import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  EditionSchema,
  safePublicUrl,
  officialEvidenceAllowed,
} from "@/lib/convention-directory/model";

const url = z
  .string()
  .refine((v) => Boolean(safePublicUrl(v)), "Public HTTPS URL required");
const Input = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("series"),
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(240),
      slug: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(200),
      official_url: url,
      ingest_url: url.nullable(),
      ingest_format: z.enum(["jsonld", "directory-json"]),
      auto_refresh: z.boolean(),
      discovery_url: url.nullable().optional(),
      discovery_format: z.enum(["jsonld", "directory-json"]).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("edition"),
      seriesId: z.string().uuid(),
      sourceUrl: url,
      facts: EditionSchema,
      confirmedOfficial: z.literal(true),
      candidateId: z.string().uuid().nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("media"),
      id: z.string().uuid(),
      target: z.enum(["series_logo", "edition_logo", "edition_banner"]),
      mediaId: z.string().uuid().nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal("link"),
      eventId: z.string().uuid(),
      editionId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("hotel_visibility"),
      editionId: z.string().uuid(),
      publicHotels: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("candidate"),
      candidateId: z.string().uuid(),
      status: z.enum(["resolved", "dismissed"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("official_source"),
      seriesId: z.string().uuid(),
      url,
      kind: z.enum(["website", "social"]),
      confirmedOfficial: z.literal(true),
    })
    .strict(),
]);

export async function GET() {
  const user = await getDashboardUser();
  if (user?.role !== "admin")
    return NextResponse.json(
      { error: "Administrator required" },
      { status: 403 },
    );
  const db = createAdminSupabaseClient();
  const results = await Promise.all([
    db
      .from("convention_series")
      .select(
        "id,slug,name,official_url,ingest_url,ingest_format,discovery_url,discovery_format,auto_refresh,last_attempt_at,last_success_at,last_error,logo_media_id",
      )
      .order("name")
      .limit(500),
    db.from("convention_editions").select("*").order("name").limit(1000),
    db
      .from("convention_directory_runs")
      .select("id,series_id,edition_id,outcome,message,created_at,source_url")
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("events")
      .select("id,title,convention_edition_id,event_type")
      .or(`owner_user_id.eq.${user.id},owner_user_id.is.null`)
      .eq("event_type", "convention")
      .limit(500),
    db.from("convention_edition_hotels").select("*").limit(3000),
    db.from("convention_edition_sources").select("*").limit(3000),
    db
      .from("convention_directory_candidates")
      .select("*")
      .eq("status", "pending")
      .order("discovered_at", { ascending: false })
      .limit(100),
    db
      .from("convention_series_official_sources")
      .select("id,series_id,url,kind,verified_at")
      .limit(1000),
  ]);
  if (results.some((r) => r.error))
    return NextResponse.json(
      { error: "Directory unavailable. Apply the Alpha v31.2 migration." },
      { status: 503 },
    );
  return NextResponse.json(
    Object.fromEntries(
      [
        "series",
        "editions",
        "runs",
        "events",
        "hotels",
        "sources",
        "candidates",
        "officialSources",
      ].map((key, i) => [key, results[i].data]),
    ),
  );
}

export async function POST(request: Request) {
  const user = await getDashboardUser();
  if (user?.role !== "admin")
    return NextResponse.json(
      { error: "Administrator required" },
      { status: 403 },
    );
  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      {
        error: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  const input = parsed.data;
  const db = createAdminSupabaseClient();
  try {
    if (input.action === "series") {
      const additional = input.id
        ? await db
            .from("convention_series_official_sources")
            .select("url,kind")
            .eq("series_id", input.id)
        : { data: [], error: null };
      if (additional.error) throw additional.error;
      if (
        input.auto_refresh &&
        (!input.ingest_url ||
          !officialEvidenceAllowed(
            input.official_url,
            additional.data ?? [],
            input.ingest_url,
          ))
      )
        throw new Error(
          "Automatic refresh requires an approved official source",
        );
      const { action: _action, id, ...row } = input;
      const result = id
        ? await db
            .from("convention_series")
            .update({ ...row, maintainer_user_id: user.id })
            .eq("id", id)
            .select("id")
            .single()
        : await db
            .from("convention_series")
            .insert({ ...row, maintainer_user_id: user.id })
            .select("id")
            .single();
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true, id: result.data.id });
    }
    if (input.action === "edition") {
      const { data: series, error } = await db
        .from("convention_series")
        .select("official_url")
        .eq("id", input.seriesId)
        .single();
      if (error) throw error;
      const additional = await db
        .from("convention_series_official_sources")
        .select("url,kind")
        .eq("series_id", input.seriesId);
      if (additional.error) throw additional.error;
      const sources = [
        input.sourceUrl,
        input.facts.website_url,
        ...(input.facts.sources ?? []).map((s) => s.url),
        ...(input.facts.hotels ?? []).map((h) => h.source_url),
      ];
      if (
        sources.some(
          (s) =>
            !officialEvidenceAllowed(
              series.official_url,
              additional.data ?? [],
              s,
            ),
        )
      )
        throw new Error(
          "Verification evidence must come from an approved official website or social account",
        );
      const result = await db.rpc("dusk_directory_apply", {
        p_series: input.seriesId,
        p_facts: input.facts,
        p_source: input.sourceUrl,
        p_manual: true,
        p_candidate: input.candidateId ?? null,
      });
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true, id: result.data });
    }
    if (input.action === "media") {
      if (input.mediaId) {
        const { data, error } = await db
          .from("media")
          .select("id")
          .eq("id", input.mediaId)
          .eq("kind", "image")
          .eq("published", true)
          .or(`owner_user_id.eq.${user.id},owner_user_id.is.null`)
          .maybeSingle();
        if (error) throw error;
        if (!data)
          throw new Error(
            "Choose an owned, published image from the Media Library",
          );
      }
      const result = await db
        .from(
          input.target === "series_logo"
            ? "convention_series"
            : "convention_editions",
        )
        .update({
          [input.target === "edition_banner"
            ? "banner_media_id"
            : "logo_media_id"]: input.mediaId,
        })
        .eq("id", input.id)
        .select("id")
        .single();
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true });
    }
    if (input.action === "hotel_visibility") {
      const result = await db
        .from("convention_editions")
        .update({ public_hotels: input.publicHotels })
        .eq("id", input.editionId)
        .select("id")
        .single();
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true });
    }
    if (input.action === "official_source") {
      if (
        input.kind === "social" &&
        new URL(input.url).pathname.replace(/\//g, "").length === 0
      )
        throw new Error(
          "Approve the specific official social account URL, not the platform homepage",
        );
      const result = await db.from("convention_series_official_sources").upsert(
        {
          series_id: input.seriesId,
          url: input.url,
          kind: input.kind,
          verified_at: new Date().toISOString(),
        },
        { onConflict: "series_id,url" },
      );
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true });
    }
    if (input.action === "candidate") {
      const result = await db
        .from("convention_directory_candidates")
        .update({ status: input.status })
        .eq("id", input.candidateId);
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true });
    }
    const { data: edition } = await db
      .from("public_convention_editions")
      .select("id")
      .eq("id", input.editionId)
      .maybeSingle();
    if (!edition) throw new Error("Select a verified official edition");
    // Correct only the reference. Preserve titles, dates, featured images and plans.
    const result = await db
      .from("events")
      .update({ convention_edition_id: input.editionId })
      .eq("id", input.eventId)
      .eq("event_type", "convention")
      .or(`owner_user_id.eq.${user.id},owner_user_id.is.null`)
      .select("id")
      .single();
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : (error as { message?: string }).message ||
              "Directory update failed",
      },
      { status: 400 },
    );
  }
}
