import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  loadCopilotContext,
  type CopilotContextType,
} from "@/lib/copilot/context";
import { createCopilotAction } from "@/lib/copilot/actions";
import { ensureProfileRow } from "@/lib/profiles";

export const maxDuration = 60;

const RequestSchema = z.object({
  message: z.string().min(1).max(12000),
  contextType: z.enum(["global", "deployment", "social"]).default("global"),
  conPrepId: z.string().uuid().nullable().optional(),
  postId: z.string().uuid().nullable().optional(),
  threadId: z.string().uuid().nullable().optional(),
});

const tools: any[] = [
  {
    type: "function",
    name: "propose_packing_items",
    description:
      "Propose packing/checklist items for the current convention deployment. Use parentLabel to create expandable kit/checklist structure.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        explanation: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              category: { type: "string" },
              quantity: { type: "integer", minimum: 1 },
              parentLabel: { type: ["string", "null"] },
              required: { type: "boolean" },
            },
            required: [
              "label",
              "category",
              "quantity",
              "parentLabel",
              "required",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "explanation", "items"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "propose_tasks",
    description:
      "Propose convention prep tasks. Use parentTitle for expandable subtasks. Dates must be ISO 8601 with timezone offset or null.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        explanation: { type: "string" },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              taskType: { type: "string" },
              dueAt: { type: ["string", "null"] },
              durationMinutes: { type: ["integer", "null"] },
              parentTitle: { type: ["string", "null"] },
              required: { type: "boolean" },
            },
            required: [
              "title",
              "taskType",
              "dueAt",
              "durationMinutes",
              "parentTitle",
              "required",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "explanation", "tasks"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "propose_social_copy",
    description:
      "Propose optimized Social Ops copy for a specific existing post. Use actual connected-platform limits and the data supplied in context. Do not fabricate performance evidence.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        explanation: { type: "string" },
        postId: { type: "string" },
        masterCaption: { type: "string" },
        platformCaptions: {
          type: "object",
          properties: {
            telegram: { type: ["string", "null"] },
            twitter: { type: ["string", "null"] },
            instagram: { type: ["string", "null"] },
            bluesky: { type: ["string", "null"] },
          },
          required: ["telegram", "twitter", "instagram", "bluesky"],
          additionalProperties: false,
        },
      },
      required: [
        "title",
        "explanation",
        "postId",
        "masterCaption",
        "platformCaptions",
      ],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "propose_social_schedule",
    description:
      "Propose a scheduled time for an existing Social Ops post. If historical metrics are sparse, explicitly say so rather than pretending the recommendation is evidence-backed.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        explanation: { type: "string" },
        postId: { type: "string" },
        scheduledAt: { type: "string" },
        platforms: {
          type: "array",
          items: {
            type: "string",
            enum: ["telegram", "twitter", "instagram", "bluesky"],
          },
        },
      },
      required: [
        "title",
        "explanation",
        "postId",
        "scheduledAt",
        "platforms",
      ],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "propose_publish_now",
    description:
      "Propose immediate publication of an existing Social Ops post. This is sensitive and requires explicit user approval plus Supabase-backed reauthentication. Never call unless the user clearly asks to publish now.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        explanation: { type: "string" },
        postId: { type: "string" },
      },
      required: ["title", "explanation", "postId"],
      additionalProperties: false,
    },
  },
];

function proposalFromCall(
  name: string,
  args: Record<string, any>,
) {
  if (name === "propose_packing_items") {
    return {
      actionType: "add_packing_items",
      title: args.title,
      explanation: args.explanation,
      payload: { items: args.items },
      riskLevel: "normal" as const,
    };
  }

  if (name === "propose_tasks") {
    return {
      actionType: "add_tasks",
      title: args.title,
      explanation: args.explanation,
      payload: { tasks: args.tasks },
      riskLevel: "normal" as const,
    };
  }

  if (name === "propose_social_copy") {
    return {
      actionType: "social_copy_plan",
      title: args.title,
      explanation: args.explanation,
      payload: {
        postId: args.postId,
        masterCaption: args.masterCaption,
        platformCaptions: args.platformCaptions,
      },
      riskLevel: "normal" as const,
    };
  }

  if (name === "propose_social_schedule") {
    return {
      actionType: "social_schedule",
      title: args.title,
      explanation: args.explanation,
      payload: {
        postId: args.postId,
        scheduledAt: args.scheduledAt,
        platforms: args.platforms,
      },
      riskLevel: "normal" as const,
    };
  }

  if (name === "propose_publish_now") {
    return {
      actionType: "publish_now",
      title: args.title,
      explanation: args.explanation,
      payload: { postId: args.postId },
      riskLevel: "sensitive" as const,
    };
  }

  return null;
}

async function threadFor(args: {
  userId: string;
  contextType: CopilotContextType;
  conPrepId?: string | null;
  postId?: string | null;
  threadId?: string | null;
}) {
  const supabase = createAdminSupabaseClient();

  if (args.threadId) {
    const { data } = await supabase
      .from("copilot_threads")
      .select("*")
      .eq("id", args.threadId)
      .eq("user_id", args.userId)
      .maybeSingle();

    if (data) return data;
  }

  let query = supabase
    .from("copilot_threads")
    .select("*")
    .eq("user_id", args.userId)
    .eq("context_type", args.contextType)
    .eq("archived", false);

  if (args.conPrepId) query = query.eq("con_prep_id", args.conPrepId);
  else query = query.is("con_prep_id", null);

  if (args.postId) query = query.eq("post_id", args.postId);
  else query = query.is("post_id", null);

  const { data: existing } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("copilot_threads")
    .insert({
      user_id: args.userId,
      context_type: args.contextType,
      con_prep_id: args.conPrepId ?? null,
      post_id: args.postId ?? null,
      title:
        args.contextType === "deployment"
          ? "Chaos Copilot · Deployment"
          : args.contextType === "social"
            ? "Chaos Copilot · Social Ops"
            : "Chaos Copilot",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not open Chaos Copilot thread.");
  }

  return data;
}

function instructions(contextType: CopilotContextType) {
  return `You are Chaos Copilot™, the operational AI inside Dusk Industries.

You help the signed-in operator plan furry conventions, packing, travel, tasks, and Social Ops. Be concise, playful when appropriate, but operationally precise.

CRITICAL RULES:
- Treat the supplied Dusk database context as the source of truth for the user's current deployment/post state.
- For convention facts, official convention website/social data outranks WikiFur; WikiFur outranks other sources. Do not silently invent dates, venues, policies, or reservations.
- Never claim a database change has happened just because you proposed it.
- Use proposal tools whenever the user wants packing items, tasks, caption changes, schedules, or publication actions applied.
- Normal proposals require user approval in the UI.
- Publishing immediately is sensitive: use propose_publish_now and explain that reauthentication is required.
- Nested packing/task structure is encouraged for kits: e.g. "Donk Toss Kit" parent with individual components as children.
- For social optimization, distinguish actual historical Dusk metrics from generic reasoning. If the history is insufficient, say confidence is limited.
- Keep platform constraints in mind: Bluesky 300 graphemes in v25.3, Instagram media required / 2200 caption, X configured limit, Telegram media/text behavior.
- ${contextType === "deployment" ? "Prioritize the current convention deployment." : contextType === "social" ? "Prioritize Social Ops wording, timing, media, and platform variants." : "Prioritize the most actionable Dusk operations across deployments and Social Ops."}`;
}

export async function POST(request: Request) {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureProfileRow(user.id, user.role);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Chaos Copilot is not configured yet. Add OPENAI_API_KEY in Vercel.",
      },
      { status: 503 },
    );
  }

  const parsed = RequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Copilot request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  try {
    const thread = await threadFor({
      userId: user.id,
      contextType: input.contextType,
      conPrepId: input.conPrepId,
      postId: input.postId,
      threadId: input.threadId,
    });

    await supabase.from("copilot_messages").insert({
      thread_id: thread.id,
      role: "user",
      content: input.message,
    });

    const { data: history } = await supabase
      .from("copilot_messages")
      .select("role,content")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: false })
      .limit(12);

    const context = await loadCopilotContext({
      userId: user.id,
      contextType: input.contextType,
      conPrepId: input.conPrepId,
      postId: input.postId,
    });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response: any = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-6-astra",
      store: true,
      instructions: instructions(input.contextType),
      tools,
      tool_choice: "auto",
      input: [
        {
          role: "developer",
          content:
            "Current Dusk structured context:\n" +
            JSON.stringify(context, null, 2),
        },
        ...(history ?? [])
          .reverse()
          .map((item: any) => ({
            role: item.role === "assistant" ? "assistant" : "user",
            content: item.content,
          })),
      ],
      metadata: {
        dusk_thread_id: thread.id,
        context_type: input.contextType,
      },
    });

    const actionRows: any[] = [];
    const toolOutputs: any[] = [];

    for (const item of response.output ?? []) {
      if (item.type !== "function_call") continue;

      let args: Record<string, any> = {};
      try {
        args = JSON.parse(item.arguments || "{}");
      } catch {
        args = {};
      }

      const proposal = proposalFromCall(item.name, args);

      if (!proposal) {
        toolOutputs.push({
          type: "function_call_output",
          call_id: item.call_id,
          output: JSON.stringify({
            ok: false,
            error: "Unsupported proposal tool.",
          }),
        });
        continue;
      }

      const action = await createCopilotAction({
        threadId: thread.id,
        userId: user.id,
        conPrepId: input.conPrepId ?? null,
        postId:
          input.postId ??
          (typeof args.postId === "string" ? args.postId : null),
        proposal,
      });

      actionRows.push(action);
      toolOutputs.push({
        type: "function_call_output",
        call_id: item.call_id,
        output: JSON.stringify({
          ok: true,
          proposed_action_id: action.id,
          status: "awaiting_user_approval",
          requires_reauth: action.requires_reauth,
        }),
      });
    }

    let finalResponse = response;

    if (toolOutputs.length) {
      finalResponse = await openai.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-6-astra",
        store: true,
        previous_response_id: response.id,
        instructions: instructions(input.contextType),
        tools,
        input: toolOutputs,
      });
    }

    const assistantText =
      finalResponse.output_text ||
      response.output_text ||
      (actionRows.length
        ? `I prepared ${actionRows.length} proposed action${
            actionRows.length === 1 ? "" : "s"
          } for review.`
        : "I couldn't produce a response for that request.");

    await supabase.from("copilot_messages").insert({
      thread_id: thread.id,
      role: "assistant",
      content: assistantText,
      metadata: {
        openai_response_id: finalResponse.id,
        proposed_action_ids: actionRows.map((action) => action.id),
      },
    });

    return NextResponse.json({
      ok: true,
      threadId: thread.id,
      message: assistantText,
      actions: actionRows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Chaos Copilot failed.",
      },
      { status: 500 },
    );
  }
}
