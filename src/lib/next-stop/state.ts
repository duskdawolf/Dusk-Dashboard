import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import { buildSourceHash } from "./hash";
import { getRouteContext } from "./route-context";
import type { NextStopCopy, NextStopState, RawEvent } from "./types";

export async function getNextStopState(eventId: string): Promise<NextStopState> {
  const route = await getRouteContext(eventId);
  const hash = buildSourceHash(route);
  const raw = route.current.raw as RawEvent;

  const storedHash =
    typeof raw.next_stop_source_hash === "string" ? raw.next_stop_source_hash : null;
  const imageUrl =
    typeof raw.next_stop_asset_url === "string" ? raw.next_stop_asset_url : null;

  const stale = Boolean(imageUrl && storedHash && storedHash !== hash);

  return {
    route,
    sourceHash: hash,
    storedSourceHash: storedHash,
    status: stale
      ? "stale"
      : ((raw.next_stop_asset_status as NextStopState["status"]) ?? "not_generated"),
    stale,
    imageUrl,
    generatedAt:
      typeof raw.next_stop_generated_at === "string"
        ? raw.next_stop_generated_at
        : null,
    copy:
      raw.next_stop_copy && typeof raw.next_stop_copy === "object"
        ? (raw.next_stop_copy as NextStopCopy)
        : null,
  };
}

export async function setNextStopStatus(
  eventId: string,
  status: NextStopState["status"],
) {
  const supabase = createAlpha7SupabaseAdmin();
  const { error } = await supabase
    .from("events")
    .update({ next_stop_asset_status: status })
    .eq("id", eventId);
  if (error) throw error;
}
