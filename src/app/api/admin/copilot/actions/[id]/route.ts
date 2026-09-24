import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { applyCopilotAction } from "@/lib/copilot/actions";

const DecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function validGrant(
  userId: string,
  rawToken: string | null,
  purpose: string,
) {
  if (!rawToken) return false;

  const supabase = createAdminSupabaseClient();
  const { data: grant } = await supabase
    .from("security_grants")
    .select("*")
    .eq("user_id", userId)
    .eq("token_hash", hashToken(rawToken))
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!grant) return false;

  await supabase
    .from("security_grants")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", grant.id);

  return true;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getDashboardUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const parsed = DecisionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action decision." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: action } = await supabase
    .from("copilot_actions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!action) {
    return NextResponse.json({ error: "Action not found." }, { status: 404 });
  }

  if (parsed.data.decision === "reject") {
    await supabase
      .from("copilot_actions")
      .update({ status: "rejected" })
      .eq("id", id);

    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (action.requires_reauth) {
    const grant = request.headers.get("x-chaos-reauth-grant");

    if (!(await validGrant(user.id, grant, `copilot-action:${action.id}`))) {
      return NextResponse.json(
        {
          error: "REAUTH_REQUIRED",
          message:
            "This action requires a fresh Supabase reauthentication grant.",
        },
        { status: 428 },
      );
    }
  }

  try {
    const result = await applyCopilotAction({
      actionId: id,
      userId: user.id,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not apply action.",
      },
      { status: 500 },
    );
  }
}
