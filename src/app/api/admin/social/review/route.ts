import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { ensureProfileRow } from "@/lib/profiles";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { buildSocialReviewContext } from "@/lib/social/review-context";
import {
  copilotUsageMetadata,
  normalizeCopilotUsage,
} from "@/lib/copilot/usage";

export const maxDuration = 60;

const PlatformSchema = z.enum(["telegram", "twitter", "instagram", "bluesky"]);

const SubmissionSchema = z.object({
  postId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(180),
  masterCaption: z.string().min(1).max(10000),
  eventId: z.string().uuid().nullable().optional(),
  includeDeploymentLink: z.boolean(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  platforms: z.array(
    z.object({
      platform: PlatformSchema,
      captionOverride: z.string().max(10000).nullable().optional(),
      scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
    }),
  ).min(1),
  mediaIds: z.array(z.string().uuid()).default([]),
});

const RequestSchema = z.object({
  submission: SubmissionSchema,
  threadId: z.string().uuid().nullable().optional(),
  question: z.string().max(4000).nullable().optional(),
  existingReview: z.record(z.string(), z.unknown()).nullable().optional(),
});

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    reachAssessment: { type: "string" },
    dataBasis: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["dusk", "mixed", "web", "general"] },
        confidence: { type: "string", enum: ["low", "moderate", "high"] },
        explanation: { type: "string" },
        internalSamples: { type: "integer" },
      },
      required: ["mode", "confidence", "explanation", "internalSamples"],
      additionalProperties: false,
    },
    wording: {
      type: "object",
      properties: {
        assessment: { type: "string" },
        recommendedMasterCaption: { type: "string" },
        reason: { type: "string" },
      },
      required: ["assessment", "recommendedMasterCaption", "reason"],
      additionalProperties: false,
    },
    platformReviews: {
      type: "array",
      items: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            enum: ["telegram", "twitter", "instagram", "bluesky"],
          },
          verdict: { type: "string" },
          recommendedCaption: { type: "string" },
          recommendedScheduledAt: { type: ["string", "null"] },
          timingRationale: { type: "string" },
          timingBasis: { type: "string", enum: ["dusk", "web", "general"] },
          confidence: { type: "string", enum: ["low", "moderate", "high"] },
          mediaAdvice: { type: "string" },
          includeDeploymentLink: { type: "boolean" },
          deploymentLinkRationale: { type: "string" },
        },
        required: [
          "platform",
          "verdict",
          "recommendedCaption",
          "recommendedScheduledAt",
          "timingRationale",
          "timingBasis",
          "confidence",
          "mediaAdvice",
          "includeDeploymentLink",
          "deploymentLinkRationale",
        ],
        additionalProperties: false,
      },
    },
    media: {
      type: "object",
      properties: {
        assessment: { type: "string" },
        recommendedOrder: { type: "array", items: { type: "string" } },
        rationale: { type: "string" },
      },
      required: ["assessment", "recommendedOrder", "rationale"],
      additionalProperties: false,
    },
    quickWins: { type: "array", items: { type: "string" } },
    chatReply: { type: "string" },
    webUsed: { type: "boolean" },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
        },
        required: ["title", "url"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "summary",
    "reachAssessment",
    "dataBasis",
    "wording",
    "platformReviews",
    "media",
    "quickWins",
    "chatReply",
    "webUsed",
    "sources",
  ],
  additionalProperties: false,
} as const;

function webSearchCount(response: any) {
  return (response?.output ?? []).filter(
    (item: any) => item?.type === "web_search_call",
  ).length;
}

async function createReviewThread(args: {
  userId: string;
  postId?: string | null;
  existingThreadId?: string | null;
}) {
  const supabase = createAdminSupabaseClient();

  if (args.existingThreadId) {
    const { data } = await supabase
      .from("copilot_threads")
      .select("id")
      .eq("id", args.existingThreadId)
      .eq("user_id", args.userId)
      .eq("context_type", "social")
      .maybeSingle();
    if (data) return data.id;
  }

  const { data, error } = await supabase
    .from("copilot_threads")
    .insert({
      user_id: args.userId,
      context_type: "social",
      post_id: args.postId ?? null,
      title: "Chaos Social Review",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create Social Review thread.");
  }

  return data.id;
}

function instructions(webAvailable: boolean) {
  return `You are Chaos Copilot™ performing a pre-publication Social Ops review.

Your job is to critique and improve THIS submission for likely reach while preserving the operator's voice and intent.

PRIORITY OF EVIDENCE:
1. Dusk-specific historical performance supplied in context.
2. If Dusk data is sparse and web search is available, current reputable online guidance.
3. General platform-aware reasoning only when neither is strong enough.

RULES:
- Never pretend generic online advice came from Dusk's own metrics.
- Never claim a posting time is proven optimal when sample sizes are small.
- Explicitly label timingBasis as dusk, web, or general.
- dataBasis.mode must honestly describe the overall review: dusk, mixed, web, or general.
- If web guidance is used, say so plainly in dataBasis.explanation and timing rationale, set webUsed=true, and include source URLs in sources.
- Preserve the author's personality. Optimize clarity, hook, platform fit, and scanability rather than sanding the voice into generic marketing copy.
- Respect the supplied platform constraints.
- Review only the selected platforms.
- recommendedScheduledAt should be a concrete ISO 8601 timestamp when useful; otherwise null.
- Treat media IDs as opaque identifiers. recommendedOrder may only contain IDs from the supplied submission.
- Recommend deployment links only where they help the specific post.
- This review NEVER publishes anything. It only produces suggestions.
- Do not manufacture metrics, studies, platform rules, or trends.
- ${webAvailable ? "Web search is available because Dusk-specific history is sparse. Use it only where current external evidence would materially improve the review." : "Web search is disabled because Dusk has enough internal history for this review."}

Return a complete structured review.`;
}

export async function POST(request: Request) {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureProfileRow(user.id, user.role);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Chaos Social Review is not configured. Add OPENAI_API_KEY in Vercel." },
      { status: 503 },
    );
  }

  const parsed = RequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Social Review request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const context = await buildSocialReviewContext({
      userId: user.id,
      submission: parsed.data.submission,
    });

    const allowWeb =
      Boolean(context.performance.needsExternalFallback) &&
      process.env.CHAOS_SOCIAL_WEB_FALLBACK !== "off";

    const threadId = await createReviewThread({
      userId: user.id,
      postId: parsed.data.submission.postId ?? null,
      existingThreadId: parsed.data.threadId ?? null,
    });

    const supabase = createAdminSupabaseClient();
    const question =
      parsed.data.question?.trim() ||
      "Review this submission for wording, timing, platform fit, media use, and likely reach.";

    await supabase.from("copilot_messages").insert({
      thread_id: threadId,
      role: "user",
      content: question,
      metadata: {
        kind: "social_review_request",
        followup: Boolean(parsed.data.question),
      },
    });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model =
      process.env.OPENAI_SOCIAL_REVIEW_MODEL?.trim() ||
      process.env.OPENAI_COPILOT_MODEL?.trim() ||
      "gpt-5.6-luna";

    const tools = allowWeb
      ? [{ type: "web_search" as const, search_context_size: "low" as const }]
      : [];

    const response: any = await openai.responses.create(({
      model,
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 2400,
      prompt_cache_options: { mode: "explicit" },
      instructions: instructions(allowWeb),
      ...(tools.length ? { tools, tool_choice: "auto" as const } : {}),
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "chaos_social_review",
          strict: true,
          schema: REVIEW_SCHEMA,
        },
      },
      input: [
        {
          role: "developer" as const,
          content: "Dusk Social Review context:\n" + JSON.stringify(context),
        },
        ...(parsed.data.existingReview
          ? [{
              role: "developer" as const,
              content:
                "Current review state to revise in light of the user's follow-up:\n" +
                JSON.stringify(parsed.data.existingReview),
            }]
          : []),
        { role: "user" as const, content: question },
      ],
      metadata: {
        dusk_thread_id: threadId,
        context_type: "social_review",
        web_fallback_available: String(allowWeb),
      },
    } as any));

    let review: any;
    try {
      review = JSON.parse(String(response.output_text || "{}"));
    } catch {
      throw new Error("Chaos returned an unreadable Social Review. Try Review again.");
    }

    const webCalls = webSearchCount(response);
    if (!webCalls) {
      review.webUsed = false;
      review.sources = [];
    } else {
      review.webUsed = true;
      if (!Array.isArray(review.sources)) review.sources = [];
    }

    const usage = normalizeCopilotUsage(response, model, {
      webSearchCalls: webCalls,
    });

    await supabase.from("copilot_messages").insert({
      thread_id: threadId,
      role: "assistant",
      content: String(review.summary || "Social Review completed.").slice(0, 4000),
      metadata: {
        kind: "social_review",
        usage: copilotUsageMetadata(usage),
        review: {
          data_basis: review.dataBasis,
          web_used: Boolean(review.webUsed),
          sources: Array.isArray(review.sources) ? review.sources : [],
        },
        optimization: {
          store: false,
          reasoning_effort: "low",
          prompt_cache_mode: "explicit_no_breakpoint",
          search_context_size: allowWeb ? "low" : null,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      threadId,
      review,
      performance: {
        internalSamples: context.performance.internalSamples,
        sparsePlatforms: context.performance.sparsePlatforms,
        webFallbackAvailable: allowWeb,
        webUsed: Boolean(review.webUsed),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chaos Social Review failed." },
      { status: 500 },
    );
  }
}
