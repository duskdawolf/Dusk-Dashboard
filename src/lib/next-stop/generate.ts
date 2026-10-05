import { randomUUID } from 'node:crypto';
import { createSupabaseAdmin } from './supabase-admin';
import { generateNextStopCopy } from './copy';
import { buildBackgroundPrompt, NEXT_STOP_IMAGE_SIZE } from './prompt';
import { imageModel, openaiClient } from './openai';
import { composeNextStopPoster } from './compose';
import { buildSourceHash } from './hash';
import type { GeneratedAsset, NextStopCopy, RouteContext } from './types';

const BUCKET = 'next-stop-assets';

type ImageQuality = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto';

async function generateBackground(prompt: string) {
  const client = openaiClient();
  const model = imageModel();
  const quality = (process.env.OPENAI_NEXT_STOP_IMAGE_QUALITY as ImageQuality | undefined) ?? 'medium';

  const result = await client.images.generate({
    model,
    prompt,
    size: NEXT_STOP_IMAGE_SIZE,
    quality,
    output_format: 'webp',
    output_compression: 88,
    n: 1,
  });

  const encoded = result.data?.[0]?.b64_json;
  if (!encoded) throw new Error('OpenAI image generation returned no image data.');

  return { buffer: Buffer.from(encoded, 'base64'), model };
}

export async function generateNextStopAsset(
  route: RouteContext,
  existingCopy?: NextStopCopy | null,
): Promise<GeneratedAsset> {
  const supabase = createSupabaseAdmin();
  const sourceHash = buildSourceHash(route);
  const copy = existingCopy ?? await generateNextStopCopy(route);
  const prompt = buildBackgroundPrompt(route, copy);
  const { buffer: background, model } = await generateBackground(prompt);
  const finalImage = await composeNextStopPoster({ background, route, copy });

  const imagePath = `${route.current.id}/${Date.now()}-${randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(imagePath, finalImage, {
      contentType: 'image/webp', cacheControl: '31536000', upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(imagePath);
  if (!publicUrl.publicUrl) throw new Error('Could not build public Next Stop asset URL.');

  return {
    imageUrl: publicUrl.publicUrl,
    imagePath,
    sourceHash,
    copy,
    prompt,
    imageModel: model,
    imageSize: NEXT_STOP_IMAGE_SIZE,
  };
}
