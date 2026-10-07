import { randomUUID } from "node:crypto";
import { toFile } from "openai";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import {
  downloadBrandAssetBuffer,
  getBrandConfig,
} from "@/lib/alpha71/brand-assets";
import type { BrandAsset, BrandConfig } from "@/lib/alpha71/types";
import { generateNextStopCopy } from "./copy";
import { buildSourceHash } from "./hash";
import {
  nextStopBackgroundImageModel,
  nextStopFinalImageModel,
  nextStopOpenAI,
} from "./openai";
import { buildNextStopPosterText } from "./poster-content";
import {
  buildBackgroundPrompt,
  buildFinalPosterPrompt,
  NEXT_STOP_IMAGE_SIZE,
} from "./prompt";
import {
  validateNextStopPoster,
  validationCorrection,
} from "./validate";
import type {
  GeneratedAsset,
  GeneratedBackgroundAsset,
  NextStopCopy,
  NextStopValidation,
  RouteContext,
} from "./types";

type OpenAIImageFile = Awaited<ReturnType<typeof toFile>>;

function quality(): "low" | "medium" | "high" | "auto" {
  const value = String(
    process.env.OPENAI_NEXT_STOP_IMAGE_QUALITY ?? "high",
  ).toLowerCase();

  if (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "auto"
  ) {
    return value;
  }

  return "high";
}

function selectedReferenceAssets(
  brandConfig: BrandConfig | null,
): BrandAsset[] {
  if (!brandConfig?.settings?.use_brand_assets_in_next_stop) return [];

  return [
    brandConfig.primaryMascot,
    brandConfig.secondaryMascot,
    brandConfig.logo,
  ].filter((asset): asset is BrandAsset => Boolean(asset));
}

async function brandFiles(assets: BrandAsset[]) {
  const files: OpenAIImageFile[] = [];

  for (const [index, asset] of assets.entries()) {
    const bytes = await downloadBrandAssetBuffer(asset.storage_path);
    const original =
      (asset.metadata?.original_name as string | undefined) ??
      `brand-reference-${index + 1}.png`;

    files.push(
      await toFile(bytes, original, {
        type: asset.mime_type,
      }),
    );
  }

  return files;
}

async function backgroundRequest(
  route: RouteContext,
  copy: NextStopCopy,
  userId?: string | null,
) {
  const brandConfig = userId ? await getBrandConfig(userId) : null;
  const references = selectedReferenceAssets(brandConfig);
  const prompt = buildBackgroundPrompt(route, copy, brandConfig);
  const client = nextStopOpenAI();
  const model = nextStopBackgroundImageModel();

  let encoded: string | undefined;

  if (references.length) {
    const files = await brandFiles(references);

    const result = await client.images.edit({
      model,
      image: files,
      prompt,
      size: NEXT_STOP_IMAGE_SIZE,
      quality: quality(),
      output_format: "webp",
      output_compression: 90,
      n: 1,
    });

    encoded = result.data?.[0]?.b64_json;
  } else {
    const result = await client.images.generate({
      model,
      prompt,
      size: NEXT_STOP_IMAGE_SIZE,
      quality: quality(),
      output_format: "webp",
      output_compression: 90,
      n: 1,
    });

    encoded = result.data?.[0]?.b64_json;
  }

  if (!encoded) {
    throw new Error("OpenAI returned no background image data.");
  }

  return {
    background: Buffer.from(encoded, "base64"),
    prompt,
    imageModel: model,
    referenceLabels: references.map((asset) => asset.label),
  };
}

async function finalPosterRequest(args: {
  route: RouteContext;
  copy: NextStopCopy;
  background: Buffer;
  allowAiWording: boolean;
}) {
  const client = nextStopOpenAI();
  const model = nextStopFinalImageModel();
  const text = buildNextStopPosterText({
    route: args.route,
    copy: args.copy,
    allowAiWording: args.allowAiWording,
  });

  const backgroundFile = await toFile(
    args.background,
    "saved-next-stop-background.webp",
    { type: "image/webp" },
  );

  async function render(correction?: string | null) {
    const prompt = buildFinalPosterPrompt({
      route: args.route,
      copy: args.copy,
      text,
      correction,
    });

    const result = await client.images.edit({
      model,
      image: backgroundFile,
      prompt,
      size: NEXT_STOP_IMAGE_SIZE,
      quality: quality(),
      output_format: "webp",
      output_compression: 92,
      n: 1,
    });

    const encoded = result.data?.[0]?.b64_json;
    if (!encoded) {
      throw new Error("OpenAI returned no finished poster image data.");
    }

    return {
      poster: Buffer.from(encoded, "base64"),
      prompt,
    };
  }

  const first = await render();
  let validation: NextStopValidation;

  try {
    validation = await validateNextStopPoster({
      image: first.poster,
      text,
      attempt: 1,
    });
  } catch (error) {
    validation = {
      passed: false,
      mode: text.mode,
      missingText: [],
      incorrectText: [],
      factualErrors: [],
      notes:
        error instanceof Error
          ? `Validation error: ${error.message}`
          : "Validation error",
      attempt: 1,
      model: "validation-error",
    };
  }

  if (validation.passed) {
    return {
      poster: first.poster,
      prompt: first.prompt,
      model,
      text,
      validation,
    };
  }

  const second = await render(validationCorrection(validation));

  try {
    const secondValidation = await validateNextStopPoster({
      image: second.poster,
      text,
      attempt: 2,
    });

    return {
      poster: second.poster,
      prompt: second.prompt,
      model,
      text,
      validation: secondValidation,
    };
  } catch (error) {
    return {
      poster: second.poster,
      prompt: second.prompt,
      model,
      text,
      validation: {
        passed: false,
        mode: text.mode,
        missingText: validation.missingText,
        incorrectText: validation.incorrectText,
        factualErrors: validation.factualErrors,
        notes:
          error instanceof Error
            ? `${validation.notes} Second validation error: ${error.message}`
            : `${validation.notes} Second validation error.`,
        attempt: 2,
        model: "validation-error",
      },
    };
  }
}

async function uploadImage(
  eventId: string,
  prefix: string,
  buffer: Buffer,
) {
  const supabase = createAlpha7SupabaseAdmin();
  const imagePath =
    `${eventId}/${prefix}-${Date.now()}-${randomUUID()}.webp`;

  const { error } = await supabase.storage
    .from("next-stop-assets")
    .upload(imagePath, buffer, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("next-stop-assets")
    .getPublicUrl(imagePath);

  return {
    imagePath,
    imageUrl: data.publicUrl,
  };
}

export async function generateNextStopBackgroundAsset(
  route: RouteContext,
  existingCopy?: NextStopCopy | null,
  userId?: string | null,
): Promise<GeneratedBackgroundAsset> {
  const copy = existingCopy ?? (await generateNextStopCopy(route));
  const generated = await backgroundRequest(route, copy, userId);
  const uploaded = await uploadImage(
    route.current.id,
    "background-v30",
    generated.background,
  );

  return {
    background: generated.background,
    backgroundUrl: uploaded.imageUrl,
    backgroundPath: uploaded.imagePath,
    prompt: generated.prompt,
    imageModel: generated.imageModel,
    imageSize: NEXT_STOP_IMAGE_SIZE,
    copy,
    referenceLabels: generated.referenceLabels,
  };
}

export async function renderNextStopFromBackground(
  route: RouteContext,
  background: Buffer,
  existingCopy?: NextStopCopy | null,
  _userId?: string | null,
  allowAiWording = false,
): Promise<GeneratedAsset> {
  const copy = existingCopy ?? (await generateNextStopCopy(route));

  // Alpha v30 intentionally sends ONLY the saved background to the final
  // image-edit request. Brand reference files are not resent here.
  const generated = await finalPosterRequest({
    route,
    copy,
    background,
    allowAiWording,
  });

  const uploaded = await uploadImage(
    route.current.id,
    "poster-v30",
    generated.poster,
  );

  return {
    imageUrl: uploaded.imageUrl,
    imagePath: uploaded.imagePath,
    sourceHash: buildSourceHash(route),
    copy,
    prompt: generated.prompt,
    imageModel: generated.model,
    imageSize: NEXT_STOP_IMAGE_SIZE,
    textPayload: generated.text,
    validation: generated.validation,
  };
}

export async function loadStoredBackground(path: string) {
  const supabase = createAlpha7SupabaseAdmin();
  const { data, error } = await supabase.storage
    .from("next-stop-assets")
    .download(path);

  if (error) throw error;

  return Buffer.from(await data.arrayBuffer());
}
