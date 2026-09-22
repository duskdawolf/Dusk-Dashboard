import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const DeleteSchema = z.object({ id: z.string().uuid() });

async function authorized() {
  return await getDashboardUser();
}

export async function GET() {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("media")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load media.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ media: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }

  const eventId = String(formData.get("eventId") ?? "").trim() || null;
  const altText = String(formData.get("altText") ?? "").trim() || null;
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const published = formData.get("published") === "on";

  const kind = file.type.startsWith("video/") ? "video" : "image";
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;

  const supabase = createAdminSupabaseClient();
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("public-media")
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Storage upload failed.", detail: uploadError.message },
      { status: 500 }
    );
  }

  const { data: publicUrl } = supabase.storage
    .from("public-media")
    .getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from("media")
    .insert({
      title,
      kind,
      url: publicUrl.publicUrl,
      storage_path: storagePath,
      mime_type: file.type || null,
      alt_text: altText,
      caption,
      event_id: eventId,
      published,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from("public-media").remove([storagePath]);

    return NextResponse.json(
      { error: "Could not save media record.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ media: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = DeleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid media id." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: row } = await supabase
    .from("media")
    .select("storage_path")
    .eq("id", parsed.data.id)
    .maybeSingle();

  const { error } = await supabase
    .from("media")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    return NextResponse.json(
      { error: "Could not delete media.", detail: error.message },
      { status: 500 }
    );
  }

  if (row?.storage_path) {
    await supabase.storage.from("public-media").remove([row.storage_path]);
  }

  return NextResponse.json({ ok: true });
}
