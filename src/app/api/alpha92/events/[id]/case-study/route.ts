import { NextRequest, NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import {
  ensureCaseStudy,
  requireOwnedEvent,
} from "@/lib/alpha92/event-lifecycle";

const ALLOWED = new Set([
  "title",
  "status",
  "challenge",
  "solution",
  "outcome",
  "published",
]);

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const event = await requireOwnedEvent(id, user.id);
    const caseStudy = await ensureCaseStudy({ event, userId: user.id });
    return NextResponse.json({ ok: true, caseStudy });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const event = await requireOwnedEvent(id, user.id);
    const existing = await ensureCaseStudy({ event, userId: user.id });
    const body = await request.json();

    const changes = Object.fromEntries(
      Object.entries(body.values ?? {}).filter(
        ([key, value]) => ALLOWED.has(key) && value !== undefined,
      ),
    ) as Record<string, unknown>;

    if ("published" in changes) {
      changes.published_at = changes.published
        ? existing.published_at ?? new Date().toISOString()
        : null;
    }

    if (!Object.keys(changes).length) {
      return NextResponse.json(
        { error: "No case-study fields supplied." },
        { status: 400 },
      );
    }

    const supabase = createAlpha7SupabaseAdmin();
    const { data, error } = await supabase
      .from("case_studies")
      .update(changes)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, caseStudy: data });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
