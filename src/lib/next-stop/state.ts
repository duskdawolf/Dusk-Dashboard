import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import { buildSourceHash } from "./hash";
import { getRouteContext } from "./route-context";
import type { NextStopCopy, NextStopState, RawEvent } from "./types";

function time(value: string | null) {
  return value ? new Date(value).valueOf() : Number.NaN;
}

export async function getNextStopState(eventId: string): Promise<NextStopState> {
  const route = await getRouteContext(eventId);
  const hash = buildSourceHash(route);
  const raw = route.current.raw as RawEvent;

  const storedHash = typeof raw.next_stop_source_hash === "string" ? raw.next_stop_source_hash : null;
  const imageUrl = typeof raw.next_stop_asset_url === "string" ? raw.next_stop_asset_url : null;
  const backgroundUrl = typeof raw.next_stop_background_asset_url === "string" ? raw.next_stop_background_asset_url : null;
  const backgroundPath = typeof raw.next_stop_background_asset_path === "string" ? raw.next_stop_background_asset_path : null;
  const generatedAt = typeof raw.next_stop_generated_at === "string" ? raw.next_stop_generated_at : null;
  const backgroundGeneratedAt = typeof raw.next_stop_background_generated_at === "string" ? raw.next_stop_background_generated_at : null;

  const staleByHash = Boolean(imageUrl && storedHash && storedHash !== hash);
  const staleByBackground = Boolean(imageUrl && backgroundUrl && Number.isFinite(time(backgroundGeneratedAt)) && Number.isFinite(time(generatedAt)) && time(backgroundGeneratedAt) > time(generatedAt));
  const stale = staleByHash || staleByBackground;

  return {
    route,
    sourceHash: hash,
    storedSourceHash: storedHash,
    status: stale ? "stale" : ((raw.next_stop_asset_status as NextStopState["status"]) ?? "not_generated"),
    stale,
    imageUrl,
    generatedAt,
    copy: raw.next_stop_copy && typeof raw.next_stop_copy === "object" ? (raw.next_stop_copy as NextStopCopy) : null,
    backgroundUrl,
    backgroundPath,
    backgroundStatus: (raw.next_stop_background_asset_status as NextStopState["backgroundStatus"]) ?? "not_generated",
    backgroundGeneratedAt,
  };
}

export async function setNextStopStatus(eventId: string, status: NextStopState["status"]) {
  const supabase = createAlpha7SupabaseAdmin();
  const { error } = await supabase.from("events").update({ next_stop_asset_status: status }).eq("id", eventId);
  if (error) throw error;
}

export async function setNextStopBackgroundStatus(eventId: string, status: NextStopState["backgroundStatus"]) {
  const supabase = createAlpha7SupabaseAdmin();
  const { error } = await supabase.from("events").update({ next_stop_background_asset_status: status }).eq("id", eventId);
  if (error) throw error;
}
