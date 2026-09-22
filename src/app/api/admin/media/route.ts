import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/notifications";

const DeleteSchema = z.object({ id: z.string().uuid() });

const PatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    title: z.string().min(1).max(240).optional(),
    altText: z.string().max(1000).nullable().optional(),
    caption: z.string().max(4000).nullable().optional(),
    published: z.boolean().optional(),
    eventId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    action: z.literal("reorder"),
    eventId: z.string().uuid(),
    orderedIds: z.array(z.string().uuid()).min(1),
  }),
  z.object({
    action: z.literal("setCover"),
    eventId: z.string().uuid(),
    id: z.string().uuid(),
  }),
]);

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
    .order("event_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Could not load media.", detail: error.message },
      { status: 500 },
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
      { status: 500 },
    );
  }

  const { data: publicUrl } = supabase.storage
    .from("public-media")
    .getPublicUrl(storagePath);

  let sortOrder = 0;
  if (eventId) {
    const { data: existing } = await supabase
      .from("media")
      .select("sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    sortOrder = (existing?.sort_order ?? -1) + 1;
  }

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
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from("public-media").remove([storagePath]);

    return NextResponse.json(
      { error: "Could not save media record.", detail: error.message },
      { status: 500 },
    );
  }

  await notifyAdmins({
    topicKey: "media.upload_complete",
    title: `Evidence archived: ${data.title}`,
    message: eventId
      ? "The media file was uploaded and attached to its deployment."
      : "The media file was uploaded but is not assigned to an event.",
    targetUrl: "/dashboard/media",
    actionLabel: "Open Media Ops",
    eventId,
    dedupeKey: `media.upload:${data.id}`,
    dedupeMinutes: 1440,
  }).catch(() => undefined);

  if (!eventId) {
    await notifyAdmins({
      topicKey: "media.unassigned",
      title: `Unassigned evidence: ${data.title}`,
      message: "This media file is not attached to an event yet.",
      targetUrl: "/dashboard/media",
      actionLabel: "Assign media",
      dedupeKey: `media.unassigned:${data.id}`,
      dedupeMinutes: 1440,
    }).catch(() => undefined);
  }

  return NextResponse.json({ media: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = PatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid media update.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  if (input.action === "update") {
    const patch: Record<string, unknown> = {};

    if (input.title !== undefined) patch.title = input.title;
    if (input.altText !== undefined) patch.alt_text = input.altText;
    if (input.caption !== undefined) patch.caption = input.caption;
    if (input.published !== undefined) patch.published = input.published;
    if (input.eventId !== undefined) patch.event_id = input.eventId;

    const { data, error } = await supabase
      .from("media")
      .update(patch)
      .eq("id", input.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Could not update media.", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ media: data });
  }

  if (input.action === "reorder") {
    for (const [index, id] of input.orderedIds.entries()) {
      const { error } = await supabase
        .from("media")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("event_id", input.eventId);

      if (error) {
        return NextResponse.json(
          { error: "Could not reorder media.", detail: error.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ ok: true });
  }

  const { data: eventMedia, error: loadError } = await supabase
    .from("media")
    .select("id,sort_order")
    .eq("event_id", input.eventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (loadError) {
    return NextResponse.json(
      { error: "Could not load event media.", detail: loadError.message },
      { status: 500 },
    );
  }

  const orderedIds = [
    input.id,
    ...(eventMedia ?? [])
      .map((row) => row.id)
      .filter((id) => id !== input.id),
  ];

  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from("media")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("event_id", input.eventId);

    if (error) {
      return NextResponse.json(
        { error: "Could not set cover image.", detail: error.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
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
      { status: 500 },
    );
  }

  if (row?.storage_path) {
    await supabase.storage.from("public-media").remove([row.storage_path]);
  }

  return NextResponse.json({ ok: true });
}
