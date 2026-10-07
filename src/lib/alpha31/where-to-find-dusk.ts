import { createAlpha7SupabaseAdmin } from "@/lib/alpha7/supabase-admin";

export type WhereToFindDuskItem = {
  id: string;
  source: "schedule" | "manual";
  title: string;
  startsAt: string | null;
  timeLabel: string | null;
  location: string | null;
  role: string | null;
  suiting: string | null;
  featureOnNextStop: boolean;
  line: string;
};

export type WhereToFindDusk = {
  eventId: string;
  deploymentSuiting: string;
  manualNote: string | null;
  scheduleItems: WhereToFindDuskItem[];
  publicLines: string[];
  nextStopLines: string[];
};

function suitLabel(mode: string) {
  if (mode === "fullsuiting") return "Fullsuiting";
  if (mode === "partialing") return "Partialing";
  return "Not suiting";
}

function roleLabel(status: string) {
  if (status === "hosting") return "Hosting";
  if (status === "performing") return "Performing";
  return null;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.DUSK_HOME_TIMEZONE ?? "America/New_York",
  }).format(new Date(value));
}

function splitManual(value?: string | null) {
  if (!value) return [];
  return value
    .replace(/\r/g, "")
    .split(/\n|•|;/g)
    .map((part) => part.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
}

export async function buildWhereToFindDusk(
  eventId: string,
): Promise<WhereToFindDusk> {
  const supabase = createAlpha7SupabaseAdmin();

  const [{ data: event, error: eventError }, { data: rows, error: rowsError }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id,suiting_mode,find_me_notes")
        .eq("id", eventId)
        .single(),
      supabase
        .from("deployment_sub_events")
        .select("*")
        .eq("event_id", eventId)
        .neq("attendance_status", "not_going")
        .order("next_stop_priority", { ascending: false })
        .order("starts_at", { ascending: true }),
    ]);

  if (eventError) throw eventError;
  if (rowsError) throw rowsError;

  const deploymentSuiting = String(event.suiting_mode ?? "not_suiting");

  const scheduleItems: WhereToFindDuskItem[] = (rows ?? [])
    .filter((row) => row.show_in_find_dusk || row.feature_on_next_stop)
    .map((row) => {
      const effectiveSuit =
        row.suiting_mode === "inherit"
          ? deploymentSuiting
          : row.suiting_mode;

      const location = row.room || row.location || null;
      const role = roleLabel(row.attendance_status);

      const line = [
        `${timeLabel(row.starts_at)} — ${row.title}`,
        location ? `@ ${location}` : null,
        suitLabel(effectiveSuit),
        role,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        id: row.id,
        source: "schedule" as const,
        title: row.title,
        startsAt: row.starts_at,
        timeLabel: timeLabel(row.starts_at),
        location,
        role,
        suiting: suitLabel(effectiveSuit),
        featureOnNextStop: Boolean(row.feature_on_next_stop),
        line,
      };
    });

  const manualLines = splitManual(event.find_me_notes);

  const publicSchedule = scheduleItems.filter((item) =>
    (rows ?? []).some(
      (row) => row.id === item.id && row.show_in_find_dusk,
    ),
  );

  const nextStopSchedule = scheduleItems.filter(
    (item) => item.featureOnNextStop,
  );

  const publicLines = [
    ...publicSchedule.map((item) => item.line),
    ...manualLines,
  ];

  const nextStopLines = [
    ...(nextStopSchedule.length
      ? nextStopSchedule.map((item) => item.line)
      : publicSchedule.map((item) => item.line)),
    ...manualLines,
  ].slice(0, 5);

  if (!publicLines.length) {
    publicLines.push(
      `Deployment default: ${suitLabel(deploymentSuiting)}`,
    );
  }

  if (!nextStopLines.length) {
    nextStopLines.push(
      `Deployment default: ${suitLabel(deploymentSuiting)}`,
    );
  }

  return {
    eventId,
    deploymentSuiting,
    manualNote: event.find_me_notes ?? null,
    scheduleItems,
    publicLines,
    nextStopLines,
  };
}
