import { NextRequest, NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import {
  WORKSPACE_RESOURCES,
  createWorkspaceRecord,
  deleteWorkspaceRecord,
  updateWorkspaceRecord,
  type WorkspaceResource,
} from "@/lib/alpha8/workspace-records";

function isResource(value: unknown): value is WorkspaceResource {
  return (
    typeof value === "string" &&
    WORKSPACE_RESOURCES.includes(value as WorkspaceResource)
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const body = await request.json();

    if (!isResource(body.resource)) {
      return NextResponse.json({ error: "Invalid resource." }, { status: 400 });
    }

    const row = await createWorkspaceRecord({
      conPrepId: id,
      userId: user.id,
      resource: body.resource,
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

    if (!isResource(body.resource)) {
      return NextResponse.json({ error: "Invalid resource." }, { status: 400 });
    }

    const row = await updateWorkspaceRecord({
      conPrepId: id,
      userId: user.id,
      resource: body.resource,
      recordId: body.recordId ?? null,
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

    if (!isResource(body.resource) || !body.recordId) {
      return NextResponse.json(
        { error: "resource and recordId are required." },
        { status: 400 },
      );
    }

    const result = await deleteWorkspaceRecord({
      conPrepId: id,
      userId: user.id,
      resource: body.resource,
      recordId: body.recordId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
