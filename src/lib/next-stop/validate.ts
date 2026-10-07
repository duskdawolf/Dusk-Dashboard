import type { NextStopPosterText, NextStopValidation } from "./types";
import {
  nextStopOpenAI,
  nextStopValidationModel,
} from "./openai";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    passed: { type: "boolean" },
    missingText: {
      type: "array",
      items: { type: "string" },
    },
    incorrectText: {
      type: "array",
      items: { type: "string" },
    },
    factualErrors: {
      type: "array",
      items: { type: "string" },
    },
    notes: { type: "string" },
  },
  required: [
    "passed",
    "missingText",
    "incorrectText",
    "factualErrors",
    "notes",
  ],
} as const;

export async function validateNextStopPoster(args: {
  image: Buffer;
  text: NextStopPosterText;
  attempt: number;
}): Promise<NextStopValidation> {
  const client = nextStopOpenAI();
  const model = nextStopValidationModel();
  const imageUrl = `data:image/webp;base64,${args.image.toString("base64")}`;

  const strictInstructions =
    args.text.mode === "strict"
      ? [
          "STRICT MODE:",
          "All required visible strings must appear with the same wording. Line wrapping and typography may differ, but words must not be paraphrased, abbreviated, renamed, omitted, or replaced.",
          "If a required line is missing or visibly misspelled/changed, passed must be false.",
          "Do not fail merely because capitalization style is visually decorative if the actual letters/words are still the same.",
          "",
          "REQUIRED VISIBLE LINES:",
          ...args.text.exactVisibleLines.map((line) => `- ${line}`),
        ].join("\n")
      : [
          "CREATIVE MODE:",
          "Copy may be rewritten for design, so do not compare exact labels/phrasing.",
          "Instead verify every factual item below is preserved accurately and no contradictory/invented fact is visible.",
        ].join("\n");

  const response = await client.responses.create({
    model,
    store: false,
    input: [
      {
        role: "system",
        content:
          "You are a production QA reviewer for a generated social poster. Read the visible poster text carefully. Be practical: validate actual visible wording/facts, not artistic style. Return JSON only.",
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              strictInstructions,
              "",
              "FACT LEDGER:",
              ...args.text.factLedger.map((fact) => `- ${fact}`),
              "",
              "Check the supplied finished poster. Set passed=false for missing required strict wording, changed facts, wrong times/dates/locations/names, or invented factual claims.",
            ].join("\n"),
          },
          {
            type: "input_image",
            image_url: imageUrl,
            detail: "high",
          },
        ] as never,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "next_stop_poster_validation",
        strict: true,
        schema,
      },
    },
  });

  const parsed = JSON.parse(response.output_text);

  return {
    passed: Boolean(parsed.passed),
    mode: args.text.mode,
    missingText: Array.isArray(parsed.missingText)
      ? parsed.missingText.map(String)
      : [],
    incorrectText: Array.isArray(parsed.incorrectText)
      ? parsed.incorrectText.map(String)
      : [],
    factualErrors: Array.isArray(parsed.factualErrors)
      ? parsed.factualErrors.map(String)
      : [],
    notes: String(parsed.notes ?? ""),
    attempt: args.attempt,
    model,
  };
}

export function validationCorrection(validation: NextStopValidation) {
  return [
    ...(validation.missingText.length
      ? [`Missing required text: ${validation.missingText.join(" | ")}`]
      : []),
    ...(validation.incorrectText.length
      ? [`Incorrect/changed text: ${validation.incorrectText.join(" | ")}`]
      : []),
    ...(validation.factualErrors.length
      ? [`Factual errors: ${validation.factualErrors.join(" | ")}`]
      : []),
    validation.notes ? `Validator notes: ${validation.notes}` : "",
    "Make these corrections precisely. Do not introduce new wording/facts while correcting them.",
  ]
    .filter(Boolean)
    .join("\n");
}
