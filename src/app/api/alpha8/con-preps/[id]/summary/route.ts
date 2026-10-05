import { NextResponse } from "next/server";
import {
  alpha7ErrorResponse,
  requireAlpha7Admin,
} from "@/lib/alpha7/auth";
import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAlpha7Admin();
    const { id } = await context.params;
    const supabase = createAlpha7SupabaseAdmin();

    const { data: prep, error: prepError } = await supabase
      .from("con_preps")
      .select("*")
      .eq("id", id)
      .single();

    if (prepError) throw prepError;
    if (prep.owner_user_id && prep.owner_user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [
      eventRes,
      packingRes,
      taskRes,
      hotelRes,
      travelRes,
      regRes,
      costRes,
      subEventRes,
    ] = await Promise.all([
      supabase.from("events").select("*").eq("id", prep.event_id).single(),
      supabase.from("packing_items").select("*").eq("con_prep_id", id).order("sort_order", { ascending: true }),
      supabase.from("prep_tasks").select("*").eq("con_prep_id", id).order("sort_order", { ascending: true }),
      supabase.from("hotel_stays").select("*").eq("con_prep_id", id).order("created_at", { ascending: true }),
      supabase.from("travel_segments").select("*").eq("con_prep_id", id).order("created_at", { ascending: true }),
      supabase.from("con_registrations").select("*").eq("con_prep_id", id).order("created_at", { ascending: true }),
      supabase.from("cost_entries").select("*").eq("con_prep_id", id).order("created_at", { ascending: true }),
      supabase.from("deployment_sub_events").select("*").eq("con_prep_id", id).order("starts_at", { ascending: true }),
    ]);

    for (const result of [
      eventRes,
      packingRes,
      taskRes,
      hotelRes,
      travelRes,
      regRes,
      costRes,
      subEventRes,
    ]) {
      if (result.error) throw result.error;
    }

    const packing = packingRes.data ?? [];
    const tasks = taskRes.data ?? [];
    const hotels = hotelRes.data ?? [];
    const travel = travelRes.data ?? [];
    const registrations = regRes.data ?? [];
    const costs = costRes.data ?? [];
    const subEvents = subEventRes.data ?? [];

    const packedCount = packing.filter((item) => item.packed).length;
    const taskDoneCount = tasks.filter((task) =>
      ["done", "complete", "completed"].includes(
        String(task.status).toLowerCase(),
      ),
    ).length;

    const openTasks = tasks.filter(
      (task) =>
        !["done", "complete", "completed", "cancelled"].includes(
          String(task.status).toLowerCase(),
        ),
    );

    const nextTask =
      [...openTasks]
        .filter((task) => task.due_at)
        .sort(
          (a, b) =>
            new Date(a.due_at).valueOf() -
            new Date(b.due_at).valueOf(),
        )[0] ?? null;

    const sum = (status: string) =>
      costs
        .filter((item) => item.cost_status === status)
        .reduce(
          (total, item) => total + Number(item.amount_cents ?? 0),
          0,
        );

    const budgetedCostCents = sum("budgeted");
    const paidCostCents = sum("paid");
    const unbudgetedCostCents = sum("unbudgeted");

    const publicSubEvents = subEvents.filter(
      (item) =>
        item.show_in_find_dusk && item.attendance_status !== "not_going",
    );

    return NextResponse.json({
      prep,
      event: eventRes.data,
      packing,
      tasks,
      hotels,
      travel,
      registrations,
      costs,
      subEvents,
      metrics: {
        packingTotal: packing.length,
        packedCount,
        taskTotal: tasks.length,
        taskDoneCount,
        openTaskCount: openTasks.length,
        nextTask,
        totalCostCents:
          budgetedCostCents + paidCostCents + unbudgetedCostCents,
        budgetedCostCents,
        paidCostCents,
        unbudgetedCostCents,
        subEventCount: subEvents.length,
        publicSubEventCount: publicSubEvents.length,
      },
    });
  } catch (error) {
    const out = alpha7ErrorResponse(error);
    return NextResponse.json({ error: out.message }, { status: out.status });
  }
}
