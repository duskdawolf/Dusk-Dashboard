import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  EditionSchema,
  type PublicEdition,
  parseDirectorySource,
  officialEvidenceAllowed,
} from "./model";
import { fetchOfficialSource } from "./fetch-source";

export async function conventionForDeployment(
  client: SupabaseClient,
  body: Record<string, any>,
): Promise<Record<string, any>> {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Invalid deployment");
  const type = body.event_type ?? "public";
  if (!["convention", "meetup", "hosting", "public"].includes(type))
    throw new Error("Invalid event type");
  if (type !== "convention") {
    if (body.convention_edition_id)
      throw new Error(
        "Invalid non-con deployment: only a convention may reference an edition",
      );
    return { ...body, event_type: type, convention_edition_id: null };
  }
  if (typeof body.convention_edition_id !== "string")
    throw new Error("An official Convention Edition is required");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      body.convention_edition_id,
    )
  )
    throw new Error("Invalid Convention Edition ID");
  const { data, error } = await client
    .from("public_convention_editions")
    .select("*")
    .eq("id", body.convention_edition_id)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      "Invalid edition: select a verified official Convention Edition from the directory",
    );
  if (!data.start_at)
    throw new Error(
      "Official start date is required before deploying this edition",
    );
  if (data.status === "cancelled")
    throw new Error(
      "Invalid selection: this edition is cancelled; select another edition",
    );
  return {
    ...body,
    event_type: type,
    convention_edition_id: data.id,
    title: data.name,
    start_at: data.start_at,
    end_at: data.end_at,
    location: data.location,
    event_theme: data.theme,
  };
}

export async function getPublicEdition(
  client: SupabaseClient,
  id?: string | null,
  includeOfficialHotels = false,
): Promise<PublicEdition | null> {
  if (!id) return null;
  const { data, error } = await client
    .from("public_convention_editions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (data && includeOfficialHotels) {
    const hotels = await client
      .from("convention_edition_hotels")
      .select(
        "source_key,name,role,address,booking_url,booking_opens_at,booking_closes_at,block_info,source_url,verified_at",
      )
      .eq("edition_id", id);
    if (hotels.error) throw hotels.error;
    data.hotels = hotels.data;
  }
  return data as PublicEdition | null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => JSON.stringify(key) + ":" + stableJson(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}

async function queueCandidate(
  db: SupabaseClient,
  seriesId: string,
  facts: unknown,
  source: string,
  authority: "official" | "secondary",
  reason: string,
) {
  const parsed = EditionSchema.parse(facts);
  const old = await db
    .from("convention_directory_candidates")
    .select("id,proposed_facts,status")
    .eq("series_id", seriesId)
    .eq("edition_key", parsed.edition_key)
    .eq("source_url", source)
    .maybeSingle();
  if (old.error) throw old.error;
  if (old.data && stableJson(old.data.proposed_facts) === stableJson(parsed))
    return;
  const result = await db.from("convention_directory_candidates").upsert(
    {
      series_id: seriesId,
      edition_key: parsed.edition_key,
      source_url: source,
      authority,
      reason,
      status: "pending",
      proposed_facts: parsed,
    },
    { onConflict: "series_id,edition_key,source_url" },
  );
  if (result.error) throw result.error;
  const notice = await db.rpc("dusk_directory_notify", {
    p_series: seriesId,
    p_edition: null,
    p_kind: "review",
    p_message: `${parsed.name}: ${reason}`,
    p_fingerprint: `${source}:${JSON.stringify(parsed)}`,
  });
  if (notice.error) throw notice.error;
}

export async function refreshSeries(seriesId: string, force = false) {
  const db = createAdminSupabaseClient();
  const { data: token, error: claimError } = await db.rpc(
    "dusk_directory_claim",
    { p_series: seriesId, p_force: force },
  );
  if (claimError) throw claimError;
  if (!token)
    return {
      ok: true,
      status: "unchanged",
      message:
        "Source is not enabled, is already refreshing, or was checked within ten minutes.",
    };
  const { data: series, error } = await db
    .from("convention_series")
    .select("*")
    .eq("id", seriesId)
    .single();
  if (error) throw error;
  try {
    const discover =
      force || Date.parse(series.next_discovery_at) <= Date.now();
    const approved = await db
      .from("convention_series_official_sources")
      .select("url,kind")
      .eq("series_id", seriesId);
    if (approved.error) throw approved.error;
    if (
      !officialEvidenceAllowed(
        series.official_url,
        approved.data ?? [],
        series.ingest_url,
      )
    )
      throw new Error("Ingestion source must be on the approved official host");
    const body = await fetchOfficialSource(series.ingest_url);
    const facts = parseDirectorySource(
      body,
      series.ingest_format,
      series.ingest_url,
    );
    // Validate the entire batch before writing any edition. Source URLs claiming
    // official authority must belong to this administrator-approved series host.
    for (const edition of facts) {
      const urls = [
        edition.website_url,
        ...(edition.sources ?? []).map((s) => s.url),
        ...(edition.hotels ?? []).map((h) => h.source_url),
      ];
      if (
        urls.some(
          (url) =>
            !officialEvidenceAllowed(
              series.official_url,
              approved.data ?? [],
              url,
            ),
        )
      )
        throw new Error(
          "Facts cite a different official host; review the source configuration",
        );
    }
    let count = 0;
    const existing = await db
      .from("convention_editions")
      .select("id,edition_key,edition_year,verification_status,start_at,end_at")
      .eq("series_id", seriesId);
    if (existing.error) throw existing.error;
    const aliases = await db
      .from("convention_edition_aliases")
      .select("source_key,edition_id")
      .eq("series_id", seriesId);
    if (aliases.error) throw aliases.error;
    for (const edition of facts) {
      const parsed = EditionSchema.parse(edition);
      const alias = aliases.data.find(
        (a) => a.source_key === parsed.edition_key,
      );
      const canonical = existing.data.find((e) => e.id === alias?.edition_id);
      if (canonical) parsed.edition_key = canonical.edition_key;
      const sameKey = existing.data.find(
        (e) => e.edition_key === parsed.edition_key,
      );
      const conflicting = existing.data.some(
        (e) =>
          e.edition_key !== parsed.edition_key &&
          e.edition_year &&
          e.edition_year === parsed.edition_year,
      );
      if (
        (sameKey?.edition_year &&
          parsed.edition_year &&
          sameKey.edition_year !== parsed.edition_year) ||
        (!sameKey && conflicting)
      ) {
        await queueCandidate(
          db,
          seriesId,
          { ...parsed, edition_key: edition.edition_key },
          series.ingest_url,
          "official",
          "Occurrence identity conflicts with an existing edition. Review before applying.",
        );
        continue;
      }
      if (!sameKey && !discover) continue;
      if (
        sameKey &&
        !discover &&
        Date.parse(sameKey.end_at || sameKey.start_at || "") < Date.now()
      )
        continue;
      const { error: applyError } = await db.rpc("dusk_directory_apply", {
        p_series: seriesId,
        p_facts: parsed,
        p_source: series.ingest_url,
      });
      if (applyError) throw applyError;
      count++;
    }
    if (discover && series.discovery_url) {
      const discoveryBody = await fetchOfficialSource(series.discovery_url);
      for (const proposal of parseDirectorySource(
        discoveryBody,
        series.discovery_format,
        series.discovery_url,
      )) {
        await queueCandidate(
          db,
          seriesId,
          proposal,
          series.discovery_url,
          "secondary",
          "Secondary-source candidate requires official evidence before selection.",
        );
      }
    }
    // Twice daily upcoming checks, and an independent weekly discovery clock.
    const upcoming = facts.some(
      (e) => e.start_at && Date.parse(e.end_at || e.start_at) >= Date.now(),
    );
    const { error: finishError } = await db
      .from("convention_series")
      .update({
        last_success_at: new Date().toISOString(),
        last_error: null,
        failure_count: 0,
        retry_after: new Date().toISOString(),
        next_refresh_at: new Date(
          Date.now() + (upcoming ? 0.5 : 7) * 86400000,
        ).toISOString(),
        ...(discover
          ? {
              next_discovery_at: new Date(
                Date.now() + 7 * 86400000,
              ).toISOString(),
            }
          : {}),
        lease_token: null,
        lease_until: null,
      })
      .eq("id", seriesId)
      .eq("lease_token", token);
    if (finishError) throw finishError;
    return {
      ok: true,
      status: "verified",
      editions: count,
      message: `Verified ${count} edition(s) from the official source.`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Directory refresh failed";
    await db.from("convention_directory_runs").insert({
      series_id: seriesId,
      source_url: series.ingest_url,
      outcome: "failed",
      message,
    });
    await db.rpc("dusk_directory_notify", {
      p_series: seriesId,
      p_edition: null,
      p_kind: "review",
      p_message: `${series.name}: ${message}`,
      p_fingerprint: message,
    });
    const failures = Math.min(3, Number(series.failure_count || 0) + 1);
    await db
      .from("convention_series")
      .update({
        last_error: message,
        failure_count: failures,
        retry_after: new Date(
          Date.now() + (failures === 3 ? 24 : 2 ** (failures - 1)) * 3600000,
        ).toISOString(),
        lease_token: null,
        lease_until: null,
      })
      .eq("id", seriesId)
      .eq("lease_token", token);
    return { ok: false, status: "failed", message };
  }
}

export async function runDirectorySweep() {
  if (process.env.CONVENTION_DIRECTORY_AUTOMATION !== "true")
    return { ok: true, enabled: false, results: [] };
  const db = createAdminSupabaseClient();
  const { data, error } = await db
    .from("convention_series")
    .select("id")
    .eq("auto_refresh", true)
    .lte("retry_after", new Date().toISOString())
    .or(
      `next_refresh_at.lte.${new Date().toISOString()},next_discovery_at.lte.${new Date().toISOString()}`,
    )
    .order("next_refresh_at")
    .limit(2);
  if (error) throw error;
  const results = await Promise.all(
    (data ?? []).map((s) => refreshSeries(s.id)),
  );
  return { ok: results.every((r) => r.ok), enabled: true, results };
}
