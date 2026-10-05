import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  requireAlpha7Admin,
  alpha7ErrorResponse,
} from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import {
  getAlpha7DeploymentContext,
  getOrCreateDeploymentThread,
} from "@/lib/alpha7/deployment-context";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const proposalSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    proposals: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          action_type: {
            type: "string",
            enum: [
              "upsert_hotel",
              "upsert_travel",
              "upsert_registration",
              "upsert_cost",
              "upsert_packing_item",
              "upsert_prep_task",
              "upsert_sub_event",
              "update_event",
              "update_con_prep",
            ],
          },
          title: { type: "string" },
          explanation: { type: "string" },
          record_id: { type: ["string", "null"] },
          changes: {
            type: "object",
            additionalProperties: true,
          },
        },
        required: [
          "action_type",
          "title",
          "explanation",
          "record_id",
          "changes",
        ],
      },
    },
  },
  required: ["summary", "proposals"],
} as const;

function mimeAllowed(type: string) {
  return [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ].includes(type);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const form = await request.formData();

    const conPrepId = String(form.get("conPrepId") ?? "");
    const instruction = String(form.get("instruction") ?? "").trim();
    const maybeFile = form.get("image");
    const file =
      maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null;

    if (!conPrepId) {
      return NextResponse.json(
        { error: "Choose a deployment first." },
        { status: 400 },
      );
    }

    if (!instruction && !file) {
      return NextResponse.json(
        { error: "Enter an instruction or attach an image." },
        { status: 400 },
      );
    }

    if (
      file &&
      (!mimeAllowed(file.type) || file.size > MAX_IMAGE_BYTES)
    ) {
      return NextResponse.json(
        { error: "Use a JPG/PNG/WebP/HEIC image up to 4 MB." },
        { status: 400 },
      );
    }

    const supabase = createAlpha7SupabaseAdmin();
    const context = await getAlpha7DeploymentContext(conPrepId);

    const thread = await getOrCreateDeploymentThread({
      userId: user.id,
      conPrepId,
      eventId: context.event.id,
      eventTitle: context.event.title,
    });

    let attachmentId: string | null = null;
    let imageDataUrl: string | null = null;

    if (file) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const extension =
        file.name
          .split(".")
          .pop()
          ?.replace(/[^a-zA-Z0-9]/g, "")
          .toLowerCase() || "img";

      const storagePath =
        `${user.id}/${conPrepId}/${Date.now()}-${randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("copilot-attachments")
        .upload(storagePath, bytes, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: attachment, error: attachmentError } = await supabase
        .from("copilot_attachments")
        .insert({
          user_id: user.id,
          thread_id: thread.id,
          con_prep_id: conPrepId,
          event_id: context.event.id,
          original_name: file.name,
          storage_path: storagePath,
          mime_type: file.type,
          size_bytes: file.size,
          metadata: { source: "alpha8_workspace" },
        })
        .select("*")
        .single();

      if (attachmentError) throw attachmentError;

      attachmentId = attachment.id;
      imageDataUrl =
        `data:${file.type};base64,${bytes.toString("base64")}`;
    }

    const [
      historyRes,
      packingRes,
      tasksRes,
      subEventsRes,
    ] = await Promise.all([
      supabase
        .from("copilot_messages")
        .select("role,content,created_at")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("packing_items")
        .select("*")
        .eq("con_prep_id", conPrepId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("prep_tasks")
        .select("*")
        .eq("con_prep_id", conPrepId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("deployment_sub_events")
        .select("*")
        .eq("con_prep_id", conPrepId)
        .order("starts_at", { ascending: true }),
    ]);

    if (packingRes.error) throw packingRes.error;
    if (tasksRes.error) throw tasksRes.error;
    if (subEventsRes.error) throw subEventsRes.error;

    const currentData = {
      event: context.event,
      conPrep: context.prep,
      hotelStays: context.hotelStays,
      travelSegments: context.travelSegments,
      registrations: context.registrations,
      costs: context.costs,
      packingItems: packingRes.data ?? [],
      prepTasks: tasksRes.data ?? [],
      subEvents: subEventsRes.data ?? [],
    };

    const userText = [
      instruction ||
        "Extract useful deployment information from the attached image.",
      "",
      "CURRENT DATABASE RECORDS:",
      JSON.stringify(currentData, null, 2),
      "",
      "RECENT CHAOS THREAD CONTEXT:",
      JSON.stringify(
        (historyRes.data ?? []).reverse(),
        null,
        2,
      ),
    ].join("\n");

    const content: Array<Record<string, unknown>> = [
      { type: "input_text", text: userText },
    ];

    if (imageDataUrl) {
      content.push({
        type: "input_image",
        image_url: imageDataUrl,
        detail: "high",
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const model =
      process.env.OPENAI_COPILOT_VISION_MODEL ??
      process.env.OPENAI_COPILOT_MODEL ??
      "gpt-5.6-luna";

    const response = await openai.responses.create({
      model,
      store: false,
      input: [
        {
          role: "system",
          content:
            "You are Chaos Copilot inside Dusk Induskries Convention Ops. " +
            "You may propose typed database updates but NEVER silently write them. " +
            "Use only information the user supplied, visible in an attachment, or already present in CURRENT DATABASE RECORDS. " +
            "You can add or update hotel stays, travel, registration/badge records, budget/cost items, packing items, prep tasks, schedule/sub-events, event details, and deployment/readiness details. " +
            "When the user attaches a Sched or convention-schedule screenshot, extract each selected/relevant session as a separate upsert_sub_event proposal. Use the schedule exactly; never invent panels or times. " +
            "If an existing row matches, set record_id to its exact id. If a genuinely new row is needed, record_id must be null. " +
            "Never invent confirmation numbers, prices, dates, locations, hotel details, travel details, schedule details, packing facts, or task facts. " +
            "Money fields named *_cents must be integer cents. Use ISO-8601 timestamps when a date/time is sufficiently known. " +
            "Respect these enums: con-prep status = planning|ready|traveling|complete; " +
            "registration status = needed|ordered|paid|confirmed; " +
            "cost_status = unbudgeted|budgeted|paid; " +
            "travel kind = flight|train|bus|car|rideshare|other; " +
            "travel direction = outbound|return|local|other; " +
            "car_mode = self_drive|carpool_driver|carpool_passenger; " +
            "prep task status should normally be todo|in_progress|done|cancelled. " +
            "Only propose fields that actually need changing.",
        },
        {
          role: "user",
          content: content as never,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "dusk_record_update_proposals",
          strict: false,
          schema: proposalSchema,
        },
      },
    });

    const parsed = JSON.parse(response.output_text) as {
      summary: string;
      proposals: Array<{
        action_type: string;
        title: string;
        explanation: string;
        record_id: string | null;
        changes: Record<string, unknown>;
      }>;
    };

    await supabase.from("copilot_messages").insert({
      thread_id: thread.id,
      role: "user",
      content:
        instruction ||
        `Analyze attachment: ${file?.name ?? "image"}`,
      metadata: attachmentId
        ? { attachment_id: attachmentId }
        : {},
    });

    await supabase.from("copilot_messages").insert({
      thread_id: thread.id,
      role: "assistant",
      content: parsed.summary,
      metadata: {
        alpha8_workspace: true,
        attachment_id: attachmentId,
        model,
      },
    });

    const actionRows = parsed.proposals.map((proposal) => ({
      thread_id: thread.id,
      user_id: user.id,
      con_prep_id: conPrepId,
      event_id: context.event.id,
      attachment_id: attachmentId,
      action_type: proposal.action_type,
      title: proposal.title,
      explanation: proposal.explanation,
      payload: {
        record_id: proposal.record_id,
        changes: proposal.changes,
        source: attachmentId ? "attachment" : "chaos_text",
      },
      risk_level: "normal",
      status: "proposed",
      requires_reauth: false,
    }));

    let insertedActions: unknown[] = [];

    if (actionRows.length) {
      const { data, error } = await supabase
        .from("copilot_actions")
        .insert(actionRows)
        .select("*");

      if (error) throw error;
      insertedActions = data ?? [];
    }

    if (attachmentId) {
      const { error: attachmentUpdateError } = await supabase
        .from("copilot_attachments")
        .update({
          extracted_json: parsed,
          analysis_model: model,
        })
        .eq("id", attachmentId)
        .eq("user_id", user.id);

      if (attachmentUpdateError) {
        console.error(
          "[alpha8 chaos analyze] attachment metadata update failed",
          attachmentUpdateError,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      summary: parsed.summary,
      actions: insertedActions,
      attachmentId,
      threadId: thread.id,
    });
  } catch (error) {
    console.error("[alpha8 chaos analyze]", error);
    const out = alpha7ErrorResponse(error);
    return NextResponse.json(
      { error: out.message },
      { status: out.status },
    );
  }
}
