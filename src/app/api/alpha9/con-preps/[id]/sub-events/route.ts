import { NextRequest, NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import {
  createSubEvent,
  deleteSubEvent,
  updateSubEvent,
} from "@/lib/alpha9/sub-events";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const body = await request.json();
    const row = await createSubEvent({
      conPrepId: id,
      userId: user.id,
      values: body.values ?? {},
    });
    return NextResponse.json({ ok: true, row });
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
    const body = await request.json();
    const row = await updateSubEvent({
      conPrepId: id,
      userId: user.id,
      id: body.id,
      values: body.values ?? {},
    });
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const body = await request.json();
    await deleteSubEvent({
      conPrepId: id,
      userId: user.id,
      id: body.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
