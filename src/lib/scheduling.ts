import { DateTime, Interval } from "luxon";

export type AvailabilityWindow = {
  weekday: number; // 0 Sunday ... 6 Saturday
  start_time: string; // HH:mm:ss
  end_time: string;   // HH:mm:ss
  window_type: "general" | "packing" | "printing" | "prep";
  active: boolean;
};

export type WorkBlock = {
  weekday: number; // 0 Sunday ... 6 Saturday
  start_time: string;
  end_time: string;
  active: boolean;
};

export type ScheduledBlock = {
  startAt: string;
  endAt: string;
  minutes: number;
  label: string;
};

export const DEFAULT_AIRPORT_ARRIVAL_MINUTES = 90;
export const DEFAULT_EXTRA_TRAVEL_BUFFER_MINUTES = 15;
export const DEFAULT_STICKERS_PER_HOUR = 50;

export function estimateStickerMinutes(
  quantity: number,
  stickersPerHour = DEFAULT_STICKERS_PER_HOUR
) {
  const rawMinutes = (quantity / stickersPerHour) * 60;
  return Math.max(15, Math.ceil(rawMinutes / 15) * 15);
}

export function airportArrivalTarget(
  flightDepartureIso: string,
  minutesBefore = DEFAULT_AIRPORT_ARRIVAL_MINUTES
) {
  return DateTime.fromISO(flightDepartureIso)
    .minus({ minutes: minutesBefore })
    .toISO();
}

export function leaveForAirportTarget({
  flightDepartureIso,
  transitMinutes,
  airportArrivalMinutes = DEFAULT_AIRPORT_ARRIVAL_MINUTES,
  extraTravelBufferMinutes = DEFAULT_EXTRA_TRAVEL_BUFFER_MINUTES,
}: {
  flightDepartureIso: string;
  transitMinutes: number;
  airportArrivalMinutes?: number;
  extraTravelBufferMinutes?: number;
}) {
  return DateTime.fromISO(flightDepartureIso)
    .minus({
      minutes:
        airportArrivalMinutes + transitMinutes + extraTravelBufferMinutes,
    })
    .toISO();
}

function parseClock(value: string) {
  const [hour, minute, second] = value.split(":").map(Number);
  return { hour: hour || 0, minute: minute || 0, second: second || 0 };
}

function luxonWeekdayToSundayZero(day: DateTime) {
  return day.weekday % 7;
}

export function scheduleProductionIntoWindows({
  quantity,
  deadlineIso,
  windows,
  timezone,
  stickersPerHour = DEFAULT_STICKERS_PER_HOUR,
  maxLookbackDays = 35,
}: {
  quantity: number;
  deadlineIso: string;
  windows: AvailabilityWindow[];
  timezone: string;
  stickersPerHour?: number;
  maxLookbackDays?: number;
}) {
  let remaining = estimateStickerMinutes(quantity, stickersPerHour);
  const deadline = DateTime.fromISO(deadlineIso).setZone(timezone);
  const candidates: { start: DateTime; end: DateTime }[] = [];

  for (let dayOffset = 0; dayOffset <= maxLookbackDays; dayOffset += 1) {
    const day = deadline.minus({ days: dayOffset }).startOf("day");
    const weekday = luxonWeekdayToSundayZero(day);

    for (const window of windows) {
      if (!window.active || window.window_type !== "printing") continue;
      if (window.weekday !== weekday) continue;

      const start = day.set(parseClock(window.start_time));
      const end = day.set(parseClock(window.end_time));

      if (end <= start) continue;

      const usableEnd = end < deadline ? end : deadline;
      if (usableEnd <= start) continue;

      candidates.push({ start, end: usableEnd });
    }
  }

  candidates.sort((a, b) => b.end.toMillis() - a.end.toMillis());

  const blocks: ScheduledBlock[] = [];

  for (const candidate of candidates) {
    if (remaining <= 0) break;

    const available = Math.floor(
      candidate.end.diff(candidate.start, "minutes").minutes
    );

    if (available <= 0) continue;

    const allocated = Math.min(available, remaining);
    const blockStart = candidate.end.minus({ minutes: allocated });

    blocks.push({
      startAt: blockStart.toUTC().toISO()!,
      endAt: candidate.end.toUTC().toISO()!,
      minutes: allocated,
      label: "Sticker production",
    });

    remaining -= allocated;
  }

  blocks.sort(
    (a, b) =>
      DateTime.fromISO(a.startAt).toMillis() -
      DateTime.fromISO(b.startAt).toMillis()
  );

  return {
    estimatedMinutes: estimateStickerMinutes(quantity, stickersPerHour),
    remainingMinutes: remaining,
    complete: remaining <= 0,
    blocks,
  };
}

function subtractWorkBlocks(
  base: Interval,
  day: DateTime,
  workBlocks: WorkBlock[]
) {
  let free: Interval[] = [base];
  const weekday = luxonWeekdayToSundayZero(day);

  for (const block of workBlocks) {
    if (!block.active || block.weekday !== weekday) continue;

    const workStart = day.set(parseClock(block.start_time));
    const workEnd = day.set(parseClock(block.end_time));
    const work = Interval.fromDateTimes(workStart, workEnd);

    const next: Interval[] = [];
    for (const segment of free) {
      const diff = segment.difference(work);
      next.push(...diff);
    }
    free = next;
  }

  return free;
}

function candidateScore(interval: Interval) {
  const start = interval.start!;
  const duration = interval.length("minutes");

  // Prefer normal human prep hours while still allowing "anywhere outside work"
  // if capacity gets tight. This is a preference, not a hard block.
  const hour = start.hour;
  let score = 0;

  if (hour >= 14 && hour < 22) score += 30;      // after-work / evening
  else if (hour >= 8 && hour < 14) score += 20;  // daytime
  else if (hour >= 22 || hour < 6) score -= 50;  // overnight: last resort

  if (start.weekday === 6) score += 15; // Saturday
  if (start.weekday === 7 && hour >= 20) score += 5; // Sunday after work

  score += Math.min(duration, 240) / 60;
  return score;
}

export function scheduleTaskOutsideWork({
  durationMinutes,
  deadlineIso,
  workBlocks,
  timezone,
  maxLookbackDays = 14,
  notBeforeIso,
}: {
  durationMinutes: number;
  deadlineIso: string;
  workBlocks: WorkBlock[];
  timezone: string;
  maxLookbackDays?: number;
  notBeforeIso?: string;
}) {
  const deadline = DateTime.fromISO(deadlineIso).setZone(timezone);
  const notBefore = notBeforeIso
    ? DateTime.fromISO(notBeforeIso).setZone(timezone)
    : deadline.minus({ days: maxLookbackDays });

  const candidates: Interval[] = [];

  for (let dayOffset = 0; dayOffset <= maxLookbackDays; dayOffset += 1) {
    const day = deadline.minus({ days: dayOffset }).startOf("day");
    const dayStart = day < notBefore.startOf("day") ? notBefore : day;
    const dayEndRaw = day.endOf("day");
    const dayEnd = dayEndRaw > deadline ? deadline : dayEndRaw;

    if (dayEnd <= dayStart) continue;

    const base = Interval.fromDateTimes(dayStart, dayEnd);
    const free = subtractWorkBlocks(base, day, workBlocks);

    for (const interval of free) {
      if (interval.length("minutes") >= durationMinutes) {
        candidates.push(interval);
      }
    }
  }

  if (candidates.length === 0) {
    return { complete: false, block: null };
  }

  // Prefer higher-quality windows, then the latest one before deadline.
  candidates.sort((a, b) => {
    const scoreDiff = candidateScore(b) - candidateScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return b.end!.toMillis() - a.end!.toMillis();
  });

  const chosen = candidates[0];
  const end = chosen.end!;
  const start = end.minus({ minutes: durationMinutes });

  return {
    complete: true,
    block: {
      startAt: start.toUTC().toISO()!,
      endAt: end.toUTC().toISO()!,
      minutes: durationMinutes,
      label: "Con prep",
    } satisfies ScheduledBlock,
  };
}
