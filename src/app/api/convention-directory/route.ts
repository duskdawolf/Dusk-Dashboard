import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { refreshSeries } from "@/lib/convention-directory/server";

export async function GET(request: NextRequest) {
  if (!(await getDashboardUser()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminSupabaseClient();
  const q = (request.nextUrl.searchParams.get("q") ?? "")
    .slice(0, 100)
    .replace(/[\\%_]/g, "\\$&");
  const [editions, series] = await Promise.all([
    db
      .from("public_convention_editions")
      .select("*")
      .ilike("search_text", `%${q.replace(/\s+/g, "%")}%`)
      .order("start_at", { ascending: false })
      .limit(60),
    db
      .from("convention_series")
      .select(
        "id,name,official_url,auto_refresh,last_attempt_at,last_success_at,last_error",
      )
      .ilike("name", `%${q.replace(/\b(?:19|20|21)\d{2}\b/g, "").trim()}%`)
      .eq("auto_refresh", true)
      .limit(20),
  ]);
  if (editions.error || series.error)
    return NextResponse.json(
      { error: "Directory unavailable. Apply the Alpha v31.2 migration." },
      { status: 503 },
    );
  return NextResponse.json({ editions: editions.data, series: series.data });
}

export async function POST(request: Request) {
  if (!(await getDashboardUser()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = z
    .object({ seriesId: z.string().uuid() })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!input.success)
    return NextResponse.json({ error: "Invalid series" }, { status: 400 });
  try {
    const result = await refreshSeries(input.data.seriesId, true);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch {
    return NextResponse.json(
      { error: "Directory refresh unavailable" },
      { status: 503 },
    );
  }
}
