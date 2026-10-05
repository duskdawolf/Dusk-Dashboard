import { NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import {
  ensureConPrep,
  eventIsPast,
  requireOwnedEvent,
} from "@/lib/alpha92/event-lifecycle";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const event = await requireOwnedEvent(id, user.id);

    if (eventIsPast(event)) {
      return NextResponse.json(
        {
          error:
            "Past events open as Case Studies. Convention Ops is for upcoming deployments.",
        },
        { status: 400 },
      );
    }

    const prep = await ensureConPrep({ event, userId: user.id });
    return NextResponse.json({ ok: true, prep });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
