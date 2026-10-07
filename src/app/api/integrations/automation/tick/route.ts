import { runDirectorySweep } from "@/lib/convention-directory/server";
import { NextRequest, NextResponse } from "next/server";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

function authorized(request: NextRequest) {
  const expected =
    process.env.AUTOMATION_TICK_SECRET ?? process.env.MAKE_WEBHOOK_SECRET;

  if (!expected) return false;

  return request.headers.get("authorization") === `Bearer ${expected}`;
}

async function callInternal(
  request: NextRequest,
  path: string,
  secret: string,
) {
  const url = new URL(path, request.nextUrl.origin);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      source: "alpha31_automation_tick",
    }),
    cache: "no-store",
  });

  const text = await response.text();
  let body: unknown = text;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep text response.
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret =
    process.env.AUTOMATION_TICK_SECRET ?? process.env.MAKE_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Automation secret is not configured." },
      { status: 500 },
    );
  }

  const supabase = createAlpha7SupabaseAdmin();

  const { data: lifecycle, error: lifecycleError } = await supabase.rpc(
    "dusk_alpha31_lifecycle_sweep",
  );

  const [reminders, socialDispatch, directory] = await Promise.all([
    // Both existing child endpoints authenticate with MAKE_WEBHOOK_SECRET.

    callInternal(
      request,
      "/api/integrations/make/sub-event-reminder-sweep",
      process.env.MAKE_WEBHOOK_SECRET ?? secret,
    ),
    callInternal(
      request,
      "/api/integrations/make/social-dispatch",
      process.env.MAKE_WEBHOOK_SECRET ?? secret,
    ),
    runDirectorySweep().catch(() => ({
      ok: false,
      error: "Directory sweep unavailable",
    })),
  ]);

  const ok =
    !lifecycleError && reminders.ok && socialDispatch.ok && directory.ok;

  return NextResponse.json(
    {
      ok,
      lifecycle: {
        ok: !lifecycleError,
        error: lifecycleError?.message ?? null,
        deployments: lifecycle ?? [],
      },
      directory,
      reminders,
      socialDispatch,
      ranAt: new Date().toISOString(),
    },
    { status: ok ? 200 : 207 },
  );
}
