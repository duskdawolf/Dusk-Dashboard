import OpenAI from "openai";

let client: OpenAI | null = null;

export function nextStopOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return client;
}

export function nextStopCopyModel() {
  return (
    process.env.OPENAI_NEXT_STOP_COPY_MODEL ??
    process.env.OPENAI_COPILOT_MODEL ??
    "gpt-5.6-luna"
  );
}

export function nextStopBackgroundImageModel() {
  return (
    process.env.OPENAI_NEXT_STOP_BACKGROUND_MODEL ??
    process.env.OPENAI_NEXT_STOP_IMAGE_MODEL ??
    "gpt-image-2.5-flare"
  );
}

export function nextStopFinalImageModel() {
  return (
    process.env.OPENAI_NEXT_STOP_FINAL_MODEL ??
    "gpt-image-2.5-sunburst"
  );
}

export function nextStopValidationModel() {
  return (
    process.env.OPENAI_NEXT_STOP_VALIDATION_MODEL ??
    process.env.OPENAI_COPILOT_VISION_MODEL ??
    process.env.OPENAI_COPILOT_MODEL ??
    "gpt-5.6-luna"
  );
}
