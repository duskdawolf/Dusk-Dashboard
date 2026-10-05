import { randomUUID } from "node:crypto";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import { generateNextStopCopy } from "./copy";
import { composeNextStopPoster } from "./compose";
import { buildSourceHash } from "./hash";
import { nextStopImageModel, nextStopOpenAI } from "./openai";
import { buildBackgroundPrompt, NEXT_STOP_IMAGE_SIZE } from "./prompt";
import type { GeneratedAsset, NextStopCopy, RouteContext } from "./types";

export async function generateNextStopAsset(
  route: RouteContext,
  existingCopy?: NextStopCopy | null,
): Promise<GeneratedAsset> {
  const copy = existingCopy ?? await generateNextStopCopy(route);
  const prompt = buildBackgroundPrompt(route, copy);
  const client = nextStopOpenAI();
  const model = nextStopImageModel();

  const result = await client.images.generate({
    model,
    prompt,
    size: NEXT_STOP_IMAGE_SIZE,
    quality: (process.env.OPENAI_NEXT_STOP_IMAGE_QUALITY as "low"|"medium"|"high"|"auto"|undefined) ?? "medium",
    output_format: "webp",
    output_compression: 88,
    n: 1,
  });

  const encoded = result.data?.[0]?.b64_json;
  if (!encoded) throw new Error("Image generation returned no image data.");

  const poster = await composeNextStopPoster({
    background: Buffer.from(encoded, "base64"),
    route,
    copy,
  });

  const supabase = createAlpha7SupabaseAdmin();
  const imagePath = `${route.current.id}/${Date.now()}-${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("next-stop-assets")
    .upload(imagePath, poster, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
  if (error) throw error;

  const { data } = supabase.storage.from("next-stop-assets").getPublicUrl(imagePath);
  return {
    imageUrl: data.publicUrl,
    imagePath,
    sourceHash: buildSourceHash(route),
    copy,
    prompt,
    imageModel: model,
    imageSize: NEXT_STOP_IMAGE_SIZE,
  };
}
