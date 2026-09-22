import { NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { getDashboardUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  DEFAULT_AIRPORT_ARRIVAL_MINUTES,
  DEFAULT_EXTRA_TRAVEL_BUFFER_MINUTES,
  airportArrivalTarget,
  leaveForAirportTarget,
} from "@/lib/scheduling";

const Payload = z.object({
  conPrepId: z.string().uuid(),
  kind: z.enum(["flight", "car"]),
  direction: z.enum(["outbound", "return", "local", "other"]).default("outbound"),
  carMode: z
    .enum(["self_drive", "carpool_driver", "carpool_passenger"])
    .nullable()
    .optional(),
  pickupNotes: z.string().max(1000).optional().default(""),
  provider: z.string().max(160).optional().default(""),
  confirmationCode: z.string().max(160).optional().default(""),
  origin: z.string().max(240).optional().default(""),
  destination: z.string().max(240).optional().default(""),
  departAt: z.string().datetime({ offset: true }).nullable().optional(),
  arriveAt: z.string().datetime({ offset: true }).nullable().optional(),
  costCents: z.number().int().nonnegative().nullable().optional(),
  transitMinutes: z.number().int().positive().max(2000).nullable().optional(),
  extraTravelBufferMinutes: z.number().int().nonnegative().max(600).optional(),
});

export async function POST(request: Request) {
  if (!(await getDashboardUser())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = Payload.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid travel record.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;

  if (input.kind === "car" && !input.carMode) {
    return NextResponse.json(
      { error: "Car travel requires self-drive or carpool mode." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();

  const { data: settingsRow } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "scheduling")
    .maybeSingle();

  const settings = (settingsRow?.value ?? {}) as Record<string, unknown>;
  const airportArrivalMinutes =
    typeof settings.airport_arrival_minutes === "number"
      ? settings.airport_arrival_minutes
      : DEFAULT_AIRPORT_ARRIVAL_MINUTES;

  const defaultExtraTravelBufferMinutes =
    typeof settings.extra_travel_buffer_minutes === "number"
      ? settings.extra_travel_buffer_minutes
      : DEFAULT_EXTRA_TRAVEL_BUFFER_MINUTES;

  const extraTravelBufferMinutes =
    input.extraTravelBufferMinutes ?? defaultExtraTravelBufferMinutes;

  let airportArrivalTargetAt: string | null = null;
  let leaveForAirportAt: string | null = null;
  let arriveAt = input.arriveAt ?? null;

  if (input.departAt && input.transitMinutes && !arriveAt) {
    arriveAt = DateTime.fromISO(input.departAt)
      .plus({ minutes: input.transitMinutes })
      .toISO();
  }

  if (input.kind === "flight" && input.departAt) {
    airportArrivalTargetAt = airportArrivalTarget(
      input.departAt,
      airportArrivalMinutes
    );

    if (input.transitMinutes) {
      leaveForAirportAt = leaveForAirportTarget({
        flightDepartureIso: input.departAt,
        transitMinutes: input.transitMinutes,
        airportArrivalMinutes,
        extraTravelBufferMinutes,
      });
    }
  }

  const { data, error } = await supabase
    .from("travel_segments")
    .insert({
      con_prep_id: input.conPrepId,
      kind: input.kind,
      direction: input.direction,
      car_mode: input.kind === "car" ? input.carMode : null,
      pickup_notes: input.pickupNotes || null,
      provider: input.provider || null,
      confirmation_code: input.confirmationCode || null,
      origin: input.origin || null,
      destination: input.destination || null,
      depart_at: input.departAt ?? null,
      arrive_at: arriveAt,
      cost_cents: input.costCents ?? null,
      transit_minutes: input.transitMinutes ?? null,
      extra_travel_buffer_minutes: extraTravelBufferMinutes,
      airport_arrival_target_at: airportArrivalTargetAt,
      leave_for_airport_at: leaveForAirportAt,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Could not save travel segment.", detail: error.message },
      { status: 500 }
    );
  }

  // Outbound departure becomes the real "everything must be ready" deadline.
  if (input.direction === "outbound" && input.departAt) {
    await supabase
      .from("con_preps")
      .update({ prep_deadline_at: input.departAt })
      .eq("id", input.conPrepId);

    // Re-anchor auto-generated tasks that know their relative offset.
    const { data: tasks } = await supabase
      .from("prep_tasks")
      .select("id,relative_days_before_departure")
      .eq("con_prep_id", input.conPrepId)
      .not("relative_days_before_departure", "is", null);

    for (const task of tasks ?? []) {
      const due = DateTime.fromISO(input.departAt)
        .minus({ days: task.relative_days_before_departure })
        .set({ hour: 19, minute: 0, second: 0, millisecond: 0 })
        .toISO();

      await supabase
        .from("prep_tasks")
        .update({ due_at: due })
        .eq("id", task.id);
    }
  }

  return NextResponse.json({
    travel: data,
    airportArrivalMinutes,
    extraTravelBufferMinutes,
  });
}
