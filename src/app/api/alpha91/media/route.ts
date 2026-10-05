import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

const BUCKET = "public-media";
const MAX_BYTES = 50 * 1024 * 1024;

function parseTags(value: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value.map(String) : String(value ?? "").split(","))
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function allowedMime(type: string) {
  return [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ].includes(type);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const kind = request.nextUrl.searchParams.get("kind");
    const tag = request.nextUrl.searchParams.get("tag");
    const supabase = createAlpha7SupabaseAdmin();

    let query = supabase
      .from("media")
      .select("*")
      .or(`owner_user_id.eq.${user.id},owner_user_id.is.null`)
      .order("favorite", { ascending: false })
      .order("created_at", { ascending: false });

    if (kind === "image" || kind === "video") query = query.eq("kind", kind);
    if (tag) query = query.contains("tags", [tag]);

    const { data, error } = await query.limit(250);
    if (error) throw error;

    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Choose an image or video." }, { status: 400 });
    }

    if (file.size > MAX_BYTES || !allowedMime(file.type)) {
      return NextResponse.json(
        { error: "Use a supported image/video up to 50 MB." },
        { status: 400 },
      );
    }

    const kind = file.type.startsWith("video/") ? "video" : "image";
    const title =
      String(form.get("title") ?? "").trim() ||
      file.name.replace(/\.[^.]+$/, "");
    const caption = String(form.get("caption") ?? "").trim() || null;
    const altText = String(form.get("alt_text") ?? "").trim() || null;
    const tags = parseTags(form.get("tags"));

    const extension =
      file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() ||
      (kind === "video" ? "mp4" : "img");
    const storagePath =
      `${user.id}/library/${Date.now()}-${randomUUID()}.${extension}`;

    const supabase = createAlpha7SupabaseAdmin();
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrl } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const { data, error } = await supabase
      .from("media")
      .insert({
        title,
        kind,
        url: publicUrl.publicUrl,
        alt_text: altText,
        event_id: null,
        sort_order: 0,
        published: true,
        storage_path: storagePath,
        mime_type: file.type,
        caption,
        owner_user_id: user.id,
        tags,
        favorite: false,
        source: "upload",
      })
      .select("*")
      .single();

    if (error) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw error;
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const body = await request.json();
    const id = String(body.id ?? "");
    const supabase = createAlpha7SupabaseAdmin();

    const { data: existing, error: existingError } = await supabase
      .from("media")
      .select("*")
      .eq("id", id)
      .single();

    if (existingError) throw existingError;
    if (existing.owner_user_id && existing.owner_user_id !== user.id) {
      throw new Error("FORBIDDEN");
    }

    const changes: Record<string, unknown> = {};
    if (body.title !== undefined) changes.title = String(body.title).trim();
    if (body.caption !== undefined) changes.caption = String(body.caption).trim() || null;
    if (body.alt_text !== undefined) changes.alt_text = String(body.alt_text).trim() || null;
    if (body.tags !== undefined) changes.tags = parseTags(body.tags);
    if (body.favorite !== undefined) changes.favorite = Boolean(body.favorite);

    const { data, error } = await supabase
      .from("media")
      .update(changes)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const body = await request.json();
    const id = String(body.id ?? "");
    const supabase = createAlpha7SupabaseAdmin();

    const { data: existing, error: existingError } = await supabase
      .from("media")
      .select("*")
      .eq("id", id)
      .single();

    if (existingError) throw existingError;
    if (existing.owner_user_id && existing.owner_user_id !== user.id) {
      throw new Error("FORBIDDEN");
    }

    const { error } = await supabase.from("media").delete().eq("id", id);
    if (error) throw error;

    if (existing.storage_path) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([existing.storage_path]);

      if (storageError) {
        console.error("[media library] storage cleanup failed", storageError);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
