import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    start_at: { type: ["string", "null"] },
    end_at: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    state_code: { type: ["string", "null"] },
    event_theme: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    official_url: { type: ["string", "null"] },
  },
  required: [
    "title",
    "start_at",
    "end_at",
    "location",
    "state_code",
    "event_theme",
    "description",
    "official_url",
  ],
} as const;

export async function POST(request: NextRequest) {
  try {
    await requireAlpha7Admin();
    const body = await request.json();
    const query = String(body.query ?? "").trim();

    if (!query) {
      return NextResponse.json(
        { error: "Enter a convention name." },
        { status: 400 },
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model:
        process.env.OPENAI_DEPLOYMENT_DISCOVERY_MODEL ?? "gpt-5.5",
      tools: [{ type: "web_search" }],
      tool_choice: "required",
      input:
        `Find the official/current information for this furry convention or event: "${query}". ` +
        "Prefer the official convention website. Return only facts clearly supported by current sources. " +
        "Dates must be ISO-8601 timestamps when known; do not invent times. " +
        "For location, prefer venue + city/state if confirmed. Theme may be null.",
      text: {
        format: {
          type: "json_schema",
          name: "deployment_discovery",
          strict: true,
          schema,
        },
      },
    });

    const found = JSON.parse(response.output_text);
    const sources: Array<{ title: string; url: string }> = [];

    for (const item of response.output as any[]) {
      if (item.type !== "message") continue;
      for (const content of item.content ?? []) {
        for (const annotation of content.annotations ?? []) {
          if (
            annotation.type === "url_citation" &&
            annotation.url
          ) {
            sources.push({
              title: annotation.title ?? annotation.url,
              url: annotation.url,
            });
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      found,
      sources: Array.from(
        new Map(sources.map((source) => [source.url, source])).values(),
      ).slice(0, 6),
    });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
