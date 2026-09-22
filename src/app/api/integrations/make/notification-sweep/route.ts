import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/notifications";

function authorized(request: Request) {
  const expected = process.env.MAKE_WEBHOOK_SECRET;
  return Boolean(
    expected &&
      request.headers.get("authorization") === `Bearer ${expected}`,
  );
}

function hoursUntil(value: string | null | undefined) {
  if (!value) return null;
  return (new Date(value).getTime() - Date.now()) / 3_600_000;
}

function within(hours: number | null, min: number, max: number) {
  return hours != null && hours >= min && hours <= max;
}

function eventTarget(slug?: string | null) {
  return slug ? `/chaos/${slug}` : "/dashboard/events";
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const created: string[] = [];

  const [
    { data: events },
    { data: tasks },
    { data: travel },
    { data: hotels },
    { data: posts },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id,slug,title,start_at,end_at,location,published")
      .eq("published", true),
    supabase
      .from("prep_tasks")
      .select(`
        id,title,task_type,due_at,scheduled_start_at,status,con_prep_id,
        con_preps(event_id,events(id,slug,title))
      `)
      .in("status", ["todo", "scheduled", "doing"]),
    supabase
      .from("travel_segments")
      .select(`
        id,kind,provider,origin,destination,depart_at,arrive_at,con_prep_id,
        con_preps(event_id,events(id,slug,title))
      `)
      .not("depart_at", "is", null),
    supabase
      .from("hotel_stays")
      .select(`
        id,hotel_name,checkin_at,checkout_at,con_prep_id,
        con_preps(event_id,events(id,slug,title))
      `),
    supabase
      .from("posts")
      .select("id,title,scheduled_at,status,event_id,events(id,slug,title)")
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null),
  ]);

  for (const event of events ?? []) {
    const startHours = hoursUntil(event.start_at);

    if (within(startHours, 23, 25)) {
      await notifyAdmins({
        topicKey: "event.tomorrow",
        title: `${event.title} is tomorrow`,
        message: `${event.location ? `${event.location}. ` : ""}Open the Tactical Deployment Plan and make sure the operational nonsense is actually ready.`,
        targetUrl: eventTarget(event.slug),
        actionLabel: "Open deployment plan",
        eventId: event.id,
        dedupeKey: `event.tomorrow:${event.id}:${event.start_at.slice(0, 10)}`,
        dedupeMinutes: 1440,
      });
      created.push(`event.tomorrow:${event.title}`);
    }

    if (within(startHours, 0, 12)) {
      await notifyAdmins({
        topicKey: "event.today",
        title: `${event.title} is today`,
        message: `${event.location ? `${event.location}. ` : ""}Today's deployment is on deck.`,
        targetUrl: eventTarget(event.slug),
        actionLabel: "Open plan",
        eventId: event.id,
        dedupeKey: `event.today:${event.id}:${event.start_at.slice(0, 10)}`,
        dedupeMinutes: 720,
      });
      created.push(`event.today:${event.title}`);
    }

    if (within(startHours, 0.5, 1.5)) {
      await notifyAdmins({
        topicKey: "event.starting_soon",
        title: `${event.title} starts soon`,
        message: "Roughly one hour to deployment.",
        targetUrl: eventTarget(event.slug),
        actionLabel: "Open plan",
        eventId: event.id,
        dedupeKey: `event.starting_soon:${event.id}`,
        dedupeMinutes: 180,
      });
      created.push(`event.starting_soon:${event.title}`);
    }
  }

  for (const task of tasks ?? []) {
    const dueHours = hoursUntil(task.due_at);
    const startHours = hoursUntil(task.scheduled_start_at);
    const event = (task as any).con_preps?.events;

    if (within(dueHours, 23, 25)) {
      await notifyAdmins({
        topicKey: "conprep.task_due_24h",
        title: `Prep task due tomorrow: ${task.title}`,
        message: event?.title
          ? `This is part of ${event.title} prep.`
          : "A Dusk Ops prep task is due within 24 hours.",
        targetUrl: "/dashboard/con-prep",
        actionLabel: "Open Con Prep",
        eventId: event?.id ?? null,
        dedupeKey: `prep.task.24h:${task.id}`,
        dedupeMinutes: 1440,
      });
      created.push(`conprep.task_due_24h:${task.title}`);
    }

    if (within(dueHours, 0, 1.5)) {
      await notifyAdmins({
        topicKey: "conprep.task_due_1h",
        title: `Prep task due soon: ${task.title}`,
        message: "This prep task is due within roughly an hour.",
        targetUrl: "/dashboard/con-prep",
        actionLabel: "Open task",
        eventId: event?.id ?? null,
        dedupeKey: `prep.task.1h:${task.id}`,
        dedupeMinutes: 180,
      });
      created.push(`conprep.task_due_1h:${task.title}`);
    }

    if (dueHours != null && dueHours < 0) {
      await notifyAdmins({
        topicKey: "conprep.task_overdue",
        title: `Prep task overdue: ${task.title}`,
        message: event?.title
          ? `${event.title} has an overdue prep item.`
          : "A prep item is overdue.",
        targetUrl: "/dashboard/con-prep",
        actionLabel: "Fix it",
        eventId: event?.id ?? null,
        dedupeKey: `prep.task.overdue:${task.id}:${new Date().toISOString().slice(0, 10)}`,
        dedupeMinutes: 720,
      });
      created.push(`conprep.task_overdue:${task.title}`);
    }

    if (
      task.task_type === "printing" &&
      within(startHours, 0.5, 1.5)
    ) {
      await notifyAdmins({
        topicKey: "sticker.print_block_1h",
        title: `Sticker printing starts soon: ${task.title}`,
        message: "Your scheduled production block starts in roughly an hour.",
        targetUrl: "/dashboard/con-prep",
        actionLabel: "Open production plan",
        eventId: event?.id ?? null,
        dedupeKey: `sticker.print.1h:${task.id}`,
        dedupeMinutes: 180,
      });
      created.push(`sticker.print_block_1h:${task.title}`);
    }
  }

  for (const segment of travel ?? []) {
    const departHours = hoursUntil(segment.depart_at);
    const event = (segment as any).con_preps?.events;
    const route = [segment.origin, segment.destination].filter(Boolean).join(" → ");

    if (within(departHours, 1.5, 2.5)) {
      await notifyAdmins({
        topicKey: "conprep.departure_2h",
        title: `${event?.title ?? "Travel"} departure in ~2 hours`,
        message: route || "A scheduled travel segment is approaching.",
        targetUrl: "/dashboard/con-prep",
        actionLabel: "Open travel plan",
        eventId: event?.id ?? null,
        dedupeKey: `travel.2h:${segment.id}`,
        dedupeMinutes: 240,
      });
      created.push(`conprep.departure_2h:${route}`);
    }

    if (within(departHours, 0.25, 0.75)) {
      await notifyAdmins({
        topicKey: "conprep.departure_30m",
        title: `${event?.title ?? "Travel"} departure in ~30 minutes`,
        message: route || "Departure is close.",
        targetUrl: "/dashboard/con-prep",
        actionLabel: "Open travel plan",
        eventId: event?.id ?? null,
        dedupeKey: `travel.30m:${segment.id}`,
        dedupeMinutes: 120,
      });
      created.push(`conprep.departure_30m:${route}`);
    }

    if (within(departHours, -0.15, 0.15)) {
      await notifyAdmins({
        topicKey: "conprep.departure_now",
        title: `LEAVE NOW — ${event?.title ?? "travel departure"}`,
        message: route || "Your scheduled departure time is now.",
        targetUrl: "/dashboard/con-prep",
        actionLabel: "Open travel plan",
        eventId: event?.id ?? null,
        dedupeKey: `travel.now:${segment.id}`,
        dedupeMinutes: 120,
      });
      created.push(`conprep.departure_now:${route}`);
    }
  }

  for (const stay of hotels ?? []) {
    const checkinHours = hoursUntil(stay.checkin_at);
    const checkoutHours = hoursUntil(stay.checkout_at);
    const event = (stay as any).con_preps?.events;

    if (within(checkinHours, 1, 3)) {
      await notifyAdmins({
        topicKey: "conprep.hotel_checkin",
        title: `Hotel check-in approaching: ${stay.hotel_name}`,
        message: event?.title
          ? `Check-in for ${event.title} is coming up.`
          : "Hotel check-in is coming up.",
        targetUrl: "/dashboard/con-prep",
        actionLabel: "Open hotel details",
        eventId: event?.id ?? null,
        dedupeKey: `hotel.checkin:${stay.id}`,
        dedupeMinutes: 360,
      });
      created.push(`conprep.hotel_checkin:${stay.hotel_name}`);
    }

    if (within(checkoutHours, 1, 2)) {
      await notifyAdmins({
        topicKey: "conprep.hotel_checkout",
        title: `Hotel checkout approaching: ${stay.hotel_name}`,
        message: "Checkout is approaching. Do the room sweep before the wolf evacuates.",
        targetUrl: "/dashboard/con-prep",
        actionLabel: "Open hotel details",
        eventId: event?.id ?? null,
        dedupeKey: `hotel.checkout:${stay.id}`,
        dedupeMinutes: 240,
      });
      created.push(`conprep.hotel_checkout:${stay.hotel_name}`);
    }
  }

  for (const post of posts ?? []) {
    const scheduledHours = hoursUntil(post.scheduled_at);
    const event = (post as any).events;

    if (within(scheduledHours, 0.5, 1.5)) {
      await notifyAdmins({
        topicKey: "social.due_soon",
        title: `Social post publishes soon: ${post.title}`,
        message: event?.title
          ? `This post is tied to ${event.title}.`
          : "A scheduled Social Ops post is within roughly an hour of publishing.",
        targetUrl: "/dashboard/posts",
        actionLabel: "Open Social Ops",
        eventId: event?.id ?? null,
        postId: post.id,
        dedupeKey: `social.due_soon:${post.id}`,
        dedupeMinutes: 180,
      });
      created.push(`social.due_soon:${post.title}`);
    }
  }

  return NextResponse.json({
    ok: true,
    evaluatedAt: new Date().toISOString(),
    generated: created,
  });
}
