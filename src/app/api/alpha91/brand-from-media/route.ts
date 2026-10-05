import { NextRequest, NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import { uploadBrandAsset } from "@/lib/alpha71/brand-assets";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const body = await request.json();
    const mediaId = String(body.mediaId ?? "");
    const assetKind = String(body.assetKind ?? "mascot_art") as
      | "mascot_art"
      | "logo"
      | "style_ref";

    const supabase = createAlpha7SupabaseAdmin();
    const { data: media, error } = await supabase
      .from("media")
      .select("*")
      .eq("id", mediaId)
      .single();

    if (error) throw error;
    if (media.owner_user_id && media.owner_user_id !== user.id) {
      throw new Error("FORBIDDEN");
    }
    if (media.kind !== "image") {
      return NextResponse.json(
        { error: "Brand references must be images." },
        { status: 400 },
      );
    }

    const response = await fetch(media.url);
    if (!response.ok) throw new Error("Could not read Media Library image.");

    const bytes = Buffer.from(await response.arrayBuffer());
    const filename =
      media.storage_path?.split("/").pop() || `${media.id}.png`;
    const mimeType =
      media.mime_type || response.headers.get("content-type") || "image/png";

    const asset = await uploadBrandAsset({
      userId: user.id,
      fileName: filename,
      mimeType,
      bytes,
      assetKind,
      label: String(body.label ?? "").trim() || media.title,
    });

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
