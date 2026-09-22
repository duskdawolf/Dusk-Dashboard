import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const PlatformSchema = z.enum([
  "telegram",
  "twitter",
  "instagram",
  "snapchat",
]);

const CreateSchema = z.object({
  title: z.string().min(1).max(180),
  masterCaption: z.string().min(1).max(10000),
  eventId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  status: z
    .enum(["draft", "approved", "scheduled"])
    .default("draft"),
  platforms: z.array(PlatformSchema).min(1),
});

async function authorized() {
  return await getDashboardUser();
}

export async function GET() {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*, post_platforms(*, post_metrics(*))")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load posts.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ posts: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = CreateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid post.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const supabase = createAdminSupabaseClient();

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      event_id: input.eventId ?? null,
      title: input.title,
      master_caption: input.masterCaption,
      status: input.status,
      scheduled_at: input.scheduledAt ?? null,
      approved_at:
        input.status === "approved" || input.status === "scheduled"
          ? new Date().toISOString()
          : null,
      automation_status:
        input.status === "scheduled" ? "ready_for_make" : "not_ready",
    })
    .select("*")
    .single();

  if (error || !post) {
    return NextResponse.json(
      { error: "Could not create post.", detail: error?.message },
      { status: 500 }
    );
  }

  const { error: platformError } = await supabase
    .from("post_platforms")
    .insert(
      input.platforms.map((platform) => ({
        post_id: post.id,
        platform,
        status: input.status === "scheduled" ? "scheduled" : "draft",
        scheduled_at: input.scheduledAt ?? null,
      }))
    );

  if (platformError) {
    await supabase.from("posts").delete().eq("id", post.id);

    return NextResponse.json(
      { error: "Could not save platform records.", detail: platformError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ post }, { status: 201 });
}
