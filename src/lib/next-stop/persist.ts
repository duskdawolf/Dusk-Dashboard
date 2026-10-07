import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import type {
  GeneratedAsset,
  GeneratedBackgroundAsset,
  NextStopCopy,
  RouteContext,
} from "./types";

export async function persistNextStop(
  route: RouteContext,
  asset: GeneratedAsset,
) {
  const supabase = createAlpha7SupabaseAdmin();
  const validationStatus = asset.validation.passed ? "passed" : "failed";

  const { error: historyError } = await supabase
    .from("event_generated_assets")
    .insert({
      event_id: route.current.id,
      owner_user_id: route.current.ownerUserId,
      asset_type: "next_stop",
      status: "generated",
      image_path: asset.imagePath,
      image_url: asset.imageUrl,
      copy_json: asset.copy,
      prompt_text: asset.prompt,
      source_hash: asset.sourceHash,
      image_model: asset.imageModel,
      image_size: asset.imageSize,
      metadata: {
        generator: "alpha-v30-openai-full-poster",
        renderer: "openai-image-edit",
        wording_mode: asset.textPayload.mode,
        validation: asset.validation,
      },
    });

  if (historyError) throw historyError;

  const { error } = await supabase
    .from("events")
    .update({
      next_stop_asset_url: asset.imageUrl,
      next_stop_asset_status: "generated",
      next_stop_generated_at: new Date().toISOString(),
      next_stop_copy: asset.copy,
      next_stop_source_hash: asset.sourceHash,
      next_stop_final_prompt: asset.prompt,
      next_stop_text_payload: asset.textPayload,
      next_stop_validation_status: validationStatus,
      next_stop_validation_json: asset.validation,
      updated_at: new Date().toISOString(),
    })
    .eq("id", route.current.id);

  if (error) throw error;
}

export async function persistNextStopBackground(
  route: RouteContext,
  asset: GeneratedBackgroundAsset,
) {
  const supabase = createAlpha7SupabaseAdmin();

  const { error: historyError } = await supabase
    .from("event_generated_assets")
    .insert({
      event_id: route.current.id,
      owner_user_id: route.current.ownerUserId,
      asset_type: "next_stop_background",
      status: "generated",
      image_path: asset.backgroundPath,
      image_url: asset.backgroundUrl,
      copy_json: asset.copy,
      prompt_text: asset.prompt,
      source_hash: null,
      image_model: asset.imageModel,
      image_size: asset.imageSize,
      metadata: {
        generator: "alpha-v30-background",
        reference_labels: asset.referenceLabels,
      },
    });

  if (historyError) throw historyError;

  const { error } = await supabase
    .from("events")
    .update({
      next_stop_background_asset_url: asset.backgroundUrl,
      next_stop_background_asset_path: asset.backgroundPath,
      next_stop_background_asset_status: "generated",
      next_stop_background_generated_at: new Date().toISOString(),
      next_stop_background_prompt: asset.prompt,
      next_stop_background_image_model: asset.imageModel,
      next_stop_copy: asset.copy,
      next_stop_asset_status: "stale",
      next_stop_validation_status: "not_run",
      next_stop_validation_json: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", route.current.id);

  if (error) throw error;
}

export async function saveNextStopCopy(
  eventId: string,
  copy: NextStopCopy,
) {
  const supabase = createAlpha7SupabaseAdmin();

  const { error } = await supabase
    .from("events")
    .update({
      next_stop_copy: copy,
      next_stop_asset_status: "stale",
      next_stop_validation_status: "not_run",
      next_stop_validation_json: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) throw error;
}
