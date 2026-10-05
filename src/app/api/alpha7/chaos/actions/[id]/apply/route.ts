import { NextResponse } from "next/server";
import { requireAlpha7Admin, alpha7ErrorResponse } from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import {
  ALPHA7_ACTION_TYPES,
  executeAlpha7RecordAction,
  type Alpha7ActionType,
} from "@/lib/alpha7/record-actions";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = createAlpha7SupabaseAdmin();
  let actionId: string | null = null;

  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    actionId = id;

    const { data: action, error } = await supabase
      .from("copilot_actions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (error) throw error;

    if (action.status !== "proposed") {
      return NextResponse.json(
        { error: `Action is already ${action.status}.` },
        { status: 409 },
      );
    }

    if (!ALPHA7_ACTION_TYPES.includes(action.action_type as Alpha7ActionType)) {
      return NextResponse.json(
        { error: "This action is not an Alpha 7 record action." },
        { status: 400 },
      );
    }

    await supabase
      .from("copilot_actions")
      .update({
        status: "executing",
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    const result = await executeAlpha7RecordAction({
      actionType: action.action_type as Alpha7ActionType,
      payload: action.payload ?? {},
      conPrepId: action.con_prep_id,
      eventId: action.event_id,
      userId: user.id,
    });

    await supabase
      .from("copilot_actions")
      .update({
        status: "completed",
        result,
        executed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[alpha7 action apply]", error);
    if (actionId) {
      const { error: failureUpdateError } = await supabase
        .from("copilot_actions")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", actionId);

      if (failureUpdateError) {
        console.error("[alpha7 action apply] could not mark action failed", failureUpdateError);
      }
    }
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
