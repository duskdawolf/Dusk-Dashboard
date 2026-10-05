import { randomUUID } from "node:crypto";
import { toFile } from "openai";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import { downloadBrandAssetBuffer, getBrandConfig } from "@/lib/alpha71/brand-assets";
import { generateNextStopCopy } from "./copy";
import { composeNextStopPoster } from "./compose";
import { buildSourceHash } from "./hash";
import { nextStopImageModel, nextStopOpenAI } from "./openai";
import { buildBackgroundPrompt, NEXT_STOP_IMAGE_SIZE } from "./prompt";
import type { GeneratedAsset, GeneratedBackgroundAsset, NextStopCopy, RouteContext } from "./types";

async function requestBackground(route: RouteContext, copy: NextStopCopy, userId?: string | null) {
  const brandConfig = userId ? await getBrandConfig(userId) : null;
  const prompt = buildBackgroundPrompt(route, copy, brandConfig);
  const client = nextStopOpenAI();
  const model = nextStopImageModel();
  const quality = (process.env.OPENAI_NEXT_STOP_IMAGE_QUALITY as "low"|"medium"|"high"|"xhigh"|"max"|"auto"|undefined) ?? "medium";

  let encoded: string | undefined;
  const useReference = Boolean(brandConfig?.settings?.use_brand_assets_in_next_stop && brandConfig.primaryMascot);

  if (useReference && brandConfig?.primaryMascot) {
    const referenceBuffer = await downloadBrandAssetBuffer(brandConfig.primaryMascot.storage_path);
    const referenceFile = await toFile(
      referenceBuffer,
      (brandConfig.primaryMascot.metadata?.original_name as string | undefined) ?? "dusk-reference.png",
      { type: brandConfig.primaryMascot.mime_type },
    );

    const result = await client.images.edit({
      model,
      image: referenceFile,
      prompt: [
        prompt,
        "",
        "REFERENCE IMAGE ROLE:",
        "The supplied image is the canonical visual reference for Dusk.",
        brandConfig.settings?.composite_mascot
          ? "IMPORTANT: the application will composite the exact official Dusk art into the final card. Do not draw a second giant Dusk mascot. Instead, harmonize the scene with the mascot and leave the configured hero area supportive and readable."
          : "Depict Dusk in the background art while preserving the recognizable identity from the reference.",
      ].join("\n"),
      size: NEXT_STOP_IMAGE_SIZE,
      quality,
      output_format: "webp",
      output_compression: 88,
      n: 1,
    });
    encoded = result.data?.[0]?.b64_json;
  } else {
    const result = await client.images.generate({
      model,
      prompt,
      size: NEXT_STOP_IMAGE_SIZE,
      quality,
      output_format: "webp",
      output_compression: 88,
      n: 1,
    });
    encoded = result.data?.[0]?.b64_json;
  }

  if (!encoded) throw new Error("OpenAI returned no image data.");
  return { background: Buffer.from(encoded, "base64"), prompt, imageModel: model, brandConfig };
}

async function uploadImage(eventId: string, prefix: string, buffer: Buffer) {
  const supabase = createAlpha7SupabaseAdmin();
  const imagePath = `${eventId}/${prefix}-${Date.now()}-${randomUUID()}.webp`;
  const { error } = await supabase.storage.from("next-stop-assets").upload(imagePath, buffer, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("next-stop-assets").getPublicUrl(imagePath);
  return { imagePath, imageUrl: data.publicUrl };
}

export async function generateNextStopBackgroundAsset(route: RouteContext, existingCopy?: NextStopCopy | null, userId?: string | null): Promise<GeneratedBackgroundAsset> {
  const copy = existingCopy ?? await generateNextStopCopy(route);
  const generated = await requestBackground(route, copy, userId);
  const uploaded = await uploadImage(route.current.id, "background", generated.background);
  return {
    background: generated.background,
    backgroundUrl: uploaded.imageUrl,
    backgroundPath: uploaded.imagePath,
    prompt: generated.prompt,
    imageModel: generated.imageModel,
    imageSize: NEXT_STOP_IMAGE_SIZE,
    copy,
  };
}

export async function renderNextStopFromBackground(route: RouteContext, background: Buffer, existingCopy?: NextStopCopy | null, userId?: string | null): Promise<GeneratedAsset> {
  const copy = existingCopy ?? await generateNextStopCopy(route);
  const brandConfig = userId ? await getBrandConfig(userId) : null;
  const prompt = buildBackgroundPrompt(route, copy, brandConfig);
  const poster = await composeNextStopPoster({ background, route, copy, brandConfig });
  const uploaded = await uploadImage(route.current.id, "poster", poster);
  return {
    imageUrl: uploaded.imageUrl,
    imagePath: uploaded.imagePath,
    sourceHash: buildSourceHash(route),
    copy,
    prompt,
    imageModel: nextStopImageModel(),
    imageSize: NEXT_STOP_IMAGE_SIZE,
  };
}

export async function loadStoredBackground(path: string) {
  const supabase = createAlpha7SupabaseAdmin();
  const { data, error } = await supabase.storage.from("next-stop-assets").download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}
