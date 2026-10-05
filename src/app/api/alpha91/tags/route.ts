import { NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

export async function GET() {
  try {
    const user = await requireAlpha7Admin();
    const supabase = createAlpha7SupabaseAdmin();

    const { data, error } = await supabase
      .from("events")
      .select("tags,tag,owner_user_id")
      .or(`owner_user_id.eq.${user.id},owner_user_id.is.null`);

    if (error) throw error;

    const counts = new Map<string, number>();

    for (const row of data ?? []) {
      const tags =
        Array.isArray(row.tags) && row.tags.length
          ? row.tags
          : String(row.tag ?? "")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean);

      for (const tag of tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return NextResponse.json({
      items: [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([tag, count]) => ({ tag, count })),
    });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
