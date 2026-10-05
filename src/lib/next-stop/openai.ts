import OpenAI from "openai";

let client: OpenAI | null = null;

export function nextStopOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing.");
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export function nextStopCopyModel() {
  return (
    process.env.OPENAI_NEXT_STOP_COPY_MODEL ??
    process.env.OPENAI_COPILOT_MODEL ??
    "gpt-5.6-luna"
  );
}

export function nextStopImageModel() {
  return process.env.OPENAI_NEXT_STOP_IMAGE_MODEL ?? "gpt-image-2.5-flare";
}
