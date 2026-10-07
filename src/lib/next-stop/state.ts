import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import { buildSourceHash } from "./hash";
import { getRouteContext } from "./route-context";
import type {
  NextStopCopy,
  NextStopPosterText,
  NextStopState,
  NextStopValidation,
  RawEvent,
} from "./types";

function time(value: string | null) {
  return value ? new Date(value).valueOf() : Number.NaN;
}

export async function getNextStopState(
  eventId: string,
): Promise<NextStopState> {
  const route = await getRouteContext(eventId);
  const hash = buildSourceHash(route);
  const raw = route.current.raw as RawEvent;

  const storedHash =
    typeof raw.next_stop_source_hash === "string"
      ? raw.next_stop_source_hash
      : null;

  const imageUrl =
    typeof raw.next_stop_asset_url === "string"
      ? raw.next_stop_asset_url
      : null;

  const backgroundUrl =
    typeof raw.next_stop_background_asset_url === "string"
      ? raw.next_stop_background_asset_url
      : null;

  const backgroundPath =
    typeof raw.next_stop_background_asset_path === "string"
      ? raw.next_stop_background_asset_path
      : null;

  const generatedAt =
    typeof raw.next_stop_generated_at === "string"
      ? raw.next_stop_generated_at
      : null;

  const backgroundGeneratedAt =
    typeof raw.next_stop_background_generated_at === "string"
      ? raw.next_stop_background_generated_at
      : null;

  const staleByHash =
    Boolean(imageUrl && (!storedHash || storedHash !== hash));

  const staleByBackground =
    Boolean(
      imageUrl &&
        backgroundUrl &&
        Number.isFinite(time(backgroundGeneratedAt)) &&
        Number.isFinite(time(generatedAt)) &&
        time(backgroundGeneratedAt) > time(generatedAt),
    );

  const stale = staleByHash || staleByBackground;

  return {
    route,
    sourceHash: hash,
    storedSourceHash: storedHash,
    status: stale
      ? "stale"
      : ((raw.next_stop_asset_status as NextStopState["status"]) ??
          "not_generated"),
    stale,
    imageUrl,
    generatedAt,
    copy:
      raw.next_stop_copy && typeof raw.next_stop_copy === "object"
        ? (raw.next_stop_copy as NextStopCopy)
        : null,

    backgroundUrl,
    backgroundPath,
    backgroundStatus:
      (raw.next_stop_background_asset_status as
        NextStopState["backgroundStatus"]) ?? "not_generated",
    backgroundGeneratedAt,

    allowAiWording: raw.next_stop_allow_ai_wording === true,
    finalPrompt:
      typeof raw.next_stop_final_prompt === "string"
        ? raw.next_stop_final_prompt
        : null,
    textPayload:
      raw.next_stop_text_payload &&
      typeof raw.next_stop_text_payload === "object"
        ? (raw.next_stop_text_payload as NextStopPosterText)
        : null,
    validationStatus:
      (raw.next_stop_validation_status as
        NextStopState["validationStatus"]) ?? "not_run",
    validation:
      raw.next_stop_validation_json &&
      typeof raw.next_stop_validation_json === "object"
        ? (raw.next_stop_validation_json as NextStopValidation)
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

export async function setNextStopBackgroundStatus(
  eventId: string,
  status: NextStopState["backgroundStatus"],
) {
  const supabase = createAlpha7SupabaseAdmin();
  const { error } = await supabase
    .from("events")
    .update({ next_stop_background_asset_status: status })
    .eq("id", eventId);

  if (error) throw error;
}

export async function setNextStopAllowAiWording(
  eventId: string,
  allow: boolean,
) {
  const supabase = createAlpha7SupabaseAdmin();

  const { error } = await supabase
    .from("events")
    .update({
      next_stop_allow_ai_wording: allow,
      next_stop_asset_status: "stale",
      next_stop_validation_status: "not_run",
      next_stop_validation_json: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) throw error;
}
