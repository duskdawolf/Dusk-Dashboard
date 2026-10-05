import { NextRequest, NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";
import {
  ensureCaseStudy,
  eventIsPast,
  quarterFor,
  uniqueSlug,
} from "@/lib/alpha92/event-lifecycle";

function parseTags(value: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value.map(String) : String(value ?? "").split(","))
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const scope = request.nextUrl.searchParams.get("scope") ?? "upcoming";
    const tag = request.nextUrl.searchParams.get("tag")?.trim().toLowerCase() ?? "";
    const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

    const supabase = createAlpha7SupabaseAdmin();

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .or(`owner_user_id.eq.${user.id},owner_user_id.is.null`)
      .order("start_at", { ascending: true });

    if (eventsError) throw eventsError;

    const ids = (events ?? []).map((event) => event.id);

    const [prepRes, caseRes, mediaRes] = ids.length
      ? await Promise.all([
          supabase
            .from("con_preps")
            .select("id,event_id,status,readiness_score,owner_user_id")
            .in("event_id", ids),
          supabase
            .from("case_studies")
            .select("id,event_id,status,published,image_url")
            .in("event_id", ids),
          supabase
            .from("event_media")
            .select("event_id")
            .in("event_id", ids),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

    if (prepRes.error) throw prepRes.error;
    if (caseRes.error) throw caseRes.error;
    if (mediaRes.error) throw mediaRes.error;

    const prepMap = new Map(
      (prepRes.data ?? [])
        .filter((prep) => !prep.owner_user_id || prep.owner_user_id === user.id)
        .map((prep) => [prep.event_id, prep]),
    );
    const caseMap = new Map(
      (caseRes.data ?? []).map((row) => [row.event_id, row]),
    );
    const mediaCounts = new Map<string, number>();
    for (const row of mediaRes.data ?? []) {
      mediaCounts.set(row.event_id, (mediaCounts.get(row.event_id) ?? 0) + 1);
    }

    let items = (events ?? []).map((event) => ({
      event,
      lifecycle: eventIsPast(event) ? "past" : "upcoming",
      prep: prepMap.get(event.id) ?? null,
      caseStudy: caseMap.get(event.id) ?? null,
      mediaCount: mediaCounts.get(event.id) ?? 0,
    }));

    if (scope === "past") {
      items = items.filter((item) => item.lifecycle === "past");
    } else if (scope === "upcoming") {
      items = items.filter((item) => item.lifecycle === "upcoming");
    }

    if (tag) {
      items = items.filter((item) =>
        (Array.isArray(item.event.tags) ? item.event.tags : [])
          .map((value: string) => value.toLowerCase())
          .includes(tag),
      );
    }

    if (q) {
      items = items.filter((item) => {
        const haystack = [
          item.event.title,
          item.event.location,
          item.event.description,
          ...(item.event.tags ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    items.sort((a, b) => {
      const av = new Date(a.event.start_at).valueOf();
      const bv = new Date(b.event.start_at).valueOf();
      if (scope === "past") return bv - av;
      return av - bv;
    });

    return NextResponse.json({ items, scope, tag, q });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAlpha7Admin();
    const body = await request.json();

    if (body.mode !== "past") {
      return NextResponse.json(
        {
          error:
            "Upcoming events should be created through Convention Ops so the deployment workspace is created with them.",
        },
        { status: 400 },
      );
    }

    const title = String(body.title ?? "").trim();
    const startAt = String(body.start_at ?? "").trim();
    const endAt = String(body.end_at ?? "").trim() || null;

    if (!title || !startAt) {
      return NextResponse.json(
        { error: "Event name and start date are required." },
        { status: 400 },
      );
    }

    const candidate = {
      start_at: startAt,
      end_at: endAt,
    };

    if (!eventIsPast(candidate)) {
      return NextResponse.json(
        {
          error:
            "That event is not in the past yet. Add upcoming events through Convention Ops.",
        },
        { status: 400 },
      );
    }

    const tags = parseTags(body.tags);
    const eventType = ["convention", "meetup", "hosting", "public"].includes(
      body.event_type,
    )
      ? body.event_type
      : "convention";

    const supabase = createAlpha7SupabaseAdmin();
    const { data: event, error } = await supabase
      .from("events")
      .insert({
        slug: uniqueSlug(title, startAt),
        title,
        start_at: startAt,
        end_at: endAt,
        location: String(body.location ?? "").trim() || null,
        description: String(body.description ?? "").trim() || null,
        tag: tags[0] ?? "Event",
        tags,
        event_type: eventType,
        quarter: quarterFor(startAt),
        state_code: String(body.state_code ?? "").trim() || null,
        published: Boolean(body.published ?? true),
        owner_user_id: user.id,
        route_visible: false,
        event_theme: String(body.event_theme ?? "").trim() || null,
        appearance_mode: String(body.appearance_mode ?? "").trim() || null,
        suiting_mode: ["not_suiting", "partialing", "fullsuiting"].includes(
          body.suiting_mode,
        )
          ? body.suiting_mode
          : "not_suiting",
      })
      .select("*")
      .single();

    if (error) throw error;

    const caseStudy = await ensureCaseStudy({ event, userId: user.id });

    return NextResponse.json({ ok: true, event, caseStudy });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
