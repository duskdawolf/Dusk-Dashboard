import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

function authorized(request: Request) {
  const expected = process.env.MAKE_WEBHOOK_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const [
    { data: tasks, error: taskError },
    { data: travel, error: travelError },
    { data: hotels, error: hotelError },
  ] = await Promise.all([
    supabase
      .from("prep_tasks")
      .select("id,title,scheduled_start_at,scheduled_end_at,calendar_event_id,con_prep_id")
      .not("scheduled_start_at", "is", null)
      .not("scheduled_end_at", "is", null)
      .is("calendar_event_id", null),
    supabase
      .from("travel_segments")
      .select("*")
      .is("calendar_event_id", null),
    supabase
      .from("hotel_stays")
      .select("*")
      .is("calendar_event_id", null),
  ]);

  if (taskError || travelError || hotelError) {
    return NextResponse.json(
      {
        error: "Could not load calendar jobs.",
        detail: taskError?.message ?? travelError?.message ?? hotelError?.message,
      },
      { status: 500 }
    );
  }

  const jobs = [
    ...(tasks ?? []).map((task) => ({
      sourceType: "prep_task",
      sourceId: task.id,
      title: task.title,
      startAt: task.scheduled_start_at,
      endAt: task.scheduled_end_at,
      allDay: false,
    })),
    ...(travel ?? []).flatMap((segment) => {
      const rows = [];

      if (segment.depart_at && segment.arrive_at) {
        rows.push({
          sourceType: "travel_segment",
          sourceId: segment.id,
          title: `${segment.kind === "flight" ? "Flight" : "Drive"}: ${segment.origin ?? ""} → ${segment.destination ?? ""}`,
          startAt: segment.depart_at,
          endAt: segment.arrive_at,
          allDay: false,
        });
      }

      if (segment.leave_for_airport_at && segment.airport_arrival_target_at) {
        rows.push({
          sourceType: "airport_departure",
          sourceId: segment.id,
          title: "Leave for airport",
          startAt: segment.leave_for_airport_at,
          endAt: segment.airport_arrival_target_at,
          allDay: false,
        });
      }

      return rows;
    }),
    ...(hotels ?? []).flatMap((hotel) => {
      if (!hotel.checkin_at || !hotel.checkout_at) return [];
      return [{
        sourceType: "hotel_stay",
        sourceId: hotel.id,
        title: `Hotel: ${hotel.hotel_name}`,
        startAt: hotel.checkin_at,
        endAt: hotel.checkout_at,
        allDay: false,
      }];
    }),
  ];

  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const {
    sourceType,
    sourceId,
    googleEventId,
  } = body as {
    sourceType?: string;
    sourceId?: string;
    googleEventId?: string;
  };

  if (!sourceType || !sourceId || !googleEventId) {
    return NextResponse.json(
      { error: "sourceType, sourceId, and googleEventId are required." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();

  if (sourceType === "prep_task") {
    const { error } = await supabase
      .from("prep_tasks")
      .update({ calendar_event_id: googleEventId })
      .eq("id", sourceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (sourceType === "travel_segment" || sourceType === "airport_departure") {
    const { error } = await supabase
      .from("travel_segments")
      .update({ calendar_event_id: googleEventId })
      .eq("id", sourceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (sourceType === "hotel_stay") {
    const { error } = await supabase
      .from("hotel_stays")
      .update({ calendar_event_id: googleEventId })
      .eq("id", sourceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: "Unknown sourceType." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
