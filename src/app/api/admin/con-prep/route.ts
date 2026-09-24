import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const CreateSchema = z.object({ eventId: z.string().uuid() });

const DEFAULT_PACKING = [
  ["Fursuit", "Head"],
  ["Fursuit", "Bodysuit"],
  ["Fursuit", "Hand paws"],
  ["Fursuit", "Foot paws"],
  ["Fursuit", "Tail"],
  ["Cooling", "Head cooling fan"],
  ["Cooling", "Portable fans"],
  ["Gear", "Harness"],
  ["Gear", "Collar"],
  ["Gear", "Muzzle"],
  ["Care", "Brush / comb"],
  ["Care", "Basic repair kit"],
  ["Electronics", "Phone charger"],
  ["Electronics", "Battery pack"],
  ["Merch", "Stickers / giveaways"],
  ["Travel", "ID / wallet / travel documents"],
];

async function authorized() {
  return await getDashboardUser();
}

export async function GET() {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("con_preps")
    .select(
      "*, events(id,title,slug,start_at,end_at,location,event_type), packing_items(*), prep_tasks(*), travel_segments(*), hotel_stays(*), con_registrations(*), cost_entries(*)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load con prep.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ preps: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await authorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = CreateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id,title,start_at,event_type")
    .eq("id", parsed.data.eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json(
      { error: "Event not found.", detail: eventError?.message },
      { status: 404 }
    );
  }

  const { data: existing } = await supabase
    .from("con_preps")
    .select("id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "A prep kit already exists for this event." },
      { status: 409 }
    );
  }

  const { data: prep, error: prepError } = await supabase
    .from("con_preps")
    .insert({
      event_id: event.id,
      status: "planning",
      prep_deadline_at: event.start_at,
    })
    .select("*")
    .single();

  if (prepError || !prep) {
    return NextResponse.json(
      { error: "Could not create con prep.", detail: prepError?.message },
      { status: 500 }
    );
  }

  const packing = DEFAULT_PACKING.map(([category, label], index) => ({
    con_prep_id: prep.id,
    category,
    label,
    quantity: 1,
    packed: false,
    sort_order: index * 10,
  }));

  const eventStart = new Date(event.start_at);
  const relative = (days: number, hours = 19) => {
    const date = new Date(eventStart);
    date.setDate(date.getDate() - days);
    date.setHours(hours, 0, 0, 0);
    return date.toISOString();
  };

  const tasks = [
    {
      con_prep_id: prep.id,
      title: "Confirm travel + hotel details",
      due_at: relative(7),
      duration_minutes: 30,
      status: "todo",
      task_type: "travel",
      relative_days_before_departure: 7,
    },
    {
      con_prep_id: prep.id,
      title: "Print / prepare stickers and giveaways",
      due_at: relative(5),
      duration_minutes: 90,
      status: "todo",
      task_type: "production",
      relative_days_before_departure: 5,
    },
    {
      con_prep_id: prep.id,
      title: "Clean / inspect fursuit and gear",
      due_at: relative(3),
      duration_minutes: 60,
      status: "todo",
      task_type: "prep",
      relative_days_before_departure: 3,
    },
    {
      con_prep_id: prep.id,
      title: "Pack convention gear",
      due_at: relative(2),
      duration_minutes: 90,
      status: "todo",
      task_type: "packing",
      relative_days_before_departure: 2,
    },
    {
      con_prep_id: prep.id,
      title: "Final bag and document check",
      due_at: relative(1),
      duration_minutes: 30,
      status: "todo",
      task_type: "packing",
      relative_days_before_departure: 1,
    },
  ];

  const [{ error: packingError }, { error: taskError }] = await Promise.all([
    supabase.from("packing_items").insert(packing),
    supabase.from("prep_tasks").insert(tasks),
  ]);

  if (packingError || taskError) {
    return NextResponse.json(
      {
        error: "Prep created, but defaults could not be fully generated.",
        detail: packingError?.message ?? taskError?.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ prep }, { status: 201 });
}
