import OpenAI from 'openai';

let client: OpenAI | null = null;

export function openaiClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured.');
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export function copyModel() {
  return process.env.OPENAI_NEXT_STOP_COPY_MODEL ?? process.env.OPENAI_COPILOT_MODEL ?? 'gpt-5.6-luna';
}

export function imageModel() {
  return process.env.OPENAI_NEXT_STOP_IMAGE_MODEL ?? 'gpt-image-2.5-flare';
}
