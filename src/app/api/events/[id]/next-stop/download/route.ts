import { NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAlpha7Admin();
    const { id } = await context.params;
    const supabase = createAlpha7SupabaseAdmin();

    const { data: event, error } = await supabase
      .from("events")
      .select("title,next_stop_asset_url")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!event.next_stop_asset_url) {
      return NextResponse.json(
        { error: "No Next Stop image has been generated yet." },
        { status: 404 },
      );
    }

    const image = await fetch(event.next_stop_asset_url);
    if (!image.ok) {
      throw new Error("Could not retrieve generated image.");
    }

    const bytes = await image.arrayBuffer();
    const safeName = String(event.title ?? "next-stop")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    return new NextResponse(bytes, {
      headers: {
        "content-type": image.headers.get("content-type") ?? "image/webp",
        "content-disposition": `attachment; filename="${safeName || "next-stop"}-next-stop.webp"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
