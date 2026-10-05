import { randomUUID } from "node:crypto";
import { toFile } from "openai";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import {
  downloadBrandAssetBuffer,
  getBrandConfig,
} from "@/lib/alpha71/brand-assets";
import { generateNextStopCopy } from "./copy";
import { composeNextStopPoster } from "./compose";
import { buildSourceHash } from "./hash";
import { nextStopImageModel, nextStopOpenAI } from "./openai";
import { buildBackgroundPrompt, NEXT_STOP_IMAGE_SIZE } from "./prompt";
import type {
  GeneratedAsset,
  NextStopCopy,
  RouteContext,
} from "./types";

async function generateBackground(args: {
  route: RouteContext;
  copy: NextStopCopy;
  userId?: string | null;
}) {
  const brandConfig = args.userId
    ? await getBrandConfig(args.userId)
    : null;

  const prompt = buildBackgroundPrompt(
    args.route,
    args.copy,
    brandConfig,
  );

  const client = nextStopOpenAI();
  const model = nextStopImageModel();

  try {
    let encoded: string | undefined;

    const useReference =
      Boolean(
        brandConfig?.settings?.use_brand_assets_in_next_stop &&
          brandConfig.primaryMascot,
      );

    if (useReference && brandConfig?.primaryMascot) {
      const referenceBuffer = await downloadBrandAssetBuffer(
        brandConfig.primaryMascot.storage_path,
      );

      const referenceFile = await toFile(
        referenceBuffer,
        (brandConfig.primaryMascot.metadata?.original_name as string | undefined) ??
          "dusk-reference.png",
        {
          type: brandConfig.primaryMascot.mime_type,
        },
      );

      const preserveAsOverlay =
        Boolean(brandConfig.settings?.composite_mascot);

      const editPrompt = [
        prompt,
        "",
        "REFERENCE IMAGE ROLE:",
        "The supplied image is the canonical visual reference for Dusk.",
        "Match Dusk's character design, markings, proportions, palette, face, and illustration language closely.",
        preserveAsOverlay
          ? "IMPORTANT: the application will place the exact official Dusk artwork on top of the final poster. Do NOT draw a second full Dusk mascot in the scene. Instead, make the surrounding scene and visual style harmonize with the reference and leave the configured hero area relatively clear."
          : "Include Dusk in the generated scene and preserve the recognizable character identity from the reference as closely as possible.",
        "Do not copy or invent readable text from the reference image.",
      ].join("\n");

      const result = await client.images.edit({
        model,
        image: referenceFile,
        prompt: editPrompt,
        size: NEXT_STOP_IMAGE_SIZE,
        quality:
          (process.env.OPENAI_NEXT_STOP_IMAGE_QUALITY as
            | "low"
            | "medium"
            | "high"
            | "xhigh"
            | "max"
            | "auto"
            | undefined) ?? "medium",
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
        quality:
          (process.env.OPENAI_NEXT_STOP_IMAGE_QUALITY as
            | "low"
            | "medium"
            | "high"
            | "xhigh"
            | "max"
            | "auto"
            | undefined) ?? "medium",
        output_format: "webp",
        output_compression: 88,
        n: 1,
      });

      encoded = result.data?.[0]?.b64_json;
    }

    if (!encoded) {
      throw new Error("OpenAI returned no image data.");
    }

    return {
      background: Buffer.from(encoded, "base64"),
      brandConfig,
      prompt,
      model,
      usedReferenceImage: useReference,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Next Stop artwork generation failed: ${message}`);
  }
}

export async function generateNextStopAsset(
  route: RouteContext,
  existingCopy?: NextStopCopy | null,
  userId?: string | null,
): Promise<GeneratedAsset> {
  const copy =
    existingCopy ?? (await generateNextStopCopy(route));

  const generated = await generateBackground({
    route,
    copy,
    userId,
  });

  const poster = await composeNextStopPoster({
    background: generated.background,
    route,
    copy,
    brandConfig: generated.brandConfig,
  });

  const supabase = createAlpha7SupabaseAdmin();
  const imagePath =
    `${route.current.id}/${Date.now()}-${randomUUID()}.webp`;

  const { error } = await supabase.storage
    .from("next-stop-assets")
    .upload(imagePath, poster, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    throw new Error(`Next Stop upload failed: ${error.message}`);
  }

  const { data } = supabase.storage
    .from("next-stop-assets")
    .getPublicUrl(imagePath);

  return {
    imageUrl: data.publicUrl,
    imagePath,
    sourceHash: buildSourceHash(route),
    copy,
    prompt: generated.prompt,
    imageModel: generated.model,
    imageSize: NEXT_STOP_IMAGE_SIZE,
  };
}
