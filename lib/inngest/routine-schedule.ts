export type RoutineSchedule = {
  startDate: string;
  time: string;
  timezone: string;
  frequency: "once" | "daily" | "weekly" | "monthly";
  weekDays: Array<"MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU">;
};

const weekdayCodes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string) {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US-u-ca-iso8601", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timezone, formatter);
  }
  return formatter;
}

function localParts(date: Date, timezone: string) {
  const parts = getFormatter(timezone).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
    second: Number(value("second")),
  };
}

function parseDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

function dateKey({ year, month, day }: { year: number; month: number; day: number }) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addCalendarDays(date: string, amount: number) {
  const parsed = parseDate(date);
  if (!parsed) return date;
  const value = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + amount));
  return dateKey({ year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() });
}

function localDateTimeToUtc(date: string, time: string, timezone: string) {
  const parsedDate = parseDate(date);
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!parsedDate || !match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  const targetAsUtc = Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day, hour, minute);
  let candidate = targetAsUtc;

  // Refine the UTC guess using the timezone's rendered local parts. Verifying
  // the final parts also skips local times that do not exist during DST jumps.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const shown = localParts(new Date(candidate), timezone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    const delta = targetAsUtc - shownAsUtc;
    if (delta === 0) break;
    candidate += delta;
  }

  const finalParts = localParts(new Date(candidate), timezone);
  if (
    finalParts.year !== parsedDate.year ||
    finalParts.month !== parsedDate.month ||
    finalParts.day !== parsedDate.day ||
    finalParts.hour !== hour ||
    finalParts.minute !== minute ||
    finalParts.second !== 0
  ) return null;

  return new Date(candidate);
}

function matchesFrequency(schedule: RoutineSchedule, date: string, startDate: string) {
  if (date < startDate) return false;
  if (schedule.frequency === "once") return date === startDate;
  if (schedule.frequency === "daily") return true;

  const parsedDate = parseDate(date);
  const parsedStart = parseDate(startDate);
  if (!parsedDate || !parsedStart) return false;

  if (schedule.frequency === "weekly") {
    const weekday = weekdayCodes[new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)).getUTCDay()];
    return schedule.weekDays.includes(weekday);
  }

  // Monthly routines repeat on the day of month specified by startDate.
  // A month without that day has no occurrence (e.g. the 31st in February).
  return parsedDate.day === parsedStart.day;
}

export function getRoutineOccurrenceInWindow(
  schedule: RoutineSchedule,
  windowStart: Date,
  windowEnd: Date,
) {
  const start = parseDate(schedule.startDate);
  if (!start || windowEnd < windowStart) return null;
  if (!/^\d{2}:\d{2}$/.test(schedule.time)) return null;
  if (schedule.frequency === "weekly" && schedule.weekDays.length === 0) return null;

  try {
    // Also validates the IANA timezone even when no local date would match.
    const localStart = dateKey(localParts(windowStart, schedule.timezone));
    const localEnd = dateKey(localParts(windowEnd, schedule.timezone));
    let date = localStart < schedule.startDate ? schedule.startDate : localStart;
    let occurrence: Date | null = null;

    for (let days = 0; date <= localEnd && days < 4; days += 1) {
      if (matchesFrequency(schedule, date, schedule.startDate)) {
        const candidate = localDateTimeToUtc(date, schedule.time, schedule.timezone);
        if (candidate && candidate >= windowStart && candidate <= windowEnd) {
          if (!occurrence || candidate < occurrence) occurrence = candidate;
        }
      }
      date = addCalendarDays(date, 1);
    }

    return occurrence;
  } catch {
    // Invalid timezones and invalid local-time conversions are not schedulable.
    return null;
  }
}

/** Returns the first valid schedule occurrence strictly after `after`. */
export function getNextRoutineOccurrence(schedule: RoutineSchedule, after: Date) {
  if (
    !schedule ||
    !parseDate(schedule.startDate) ||
    !/^\d{2}:\d{2}$/.test(schedule.time) ||
    !["once", "daily", "weekly", "monthly"].includes(schedule.frequency) ||
    !Array.isArray(schedule.weekDays) ||
    (schedule.frequency === "weekly" && schedule.weekDays.length === 0)
  ) return null;

  try {
    const localAfter = dateKey(localParts(after, schedule.timezone));
    let date = localAfter < schedule.startDate ? schedule.startDate : localAfter;

    // Daily and weekly schedules resolve within a week. Monthly schedules can
    // skip a month when the chosen day does not exist, so allow a full year.
    for (let days = 0; days <= 370; days += 1) {
      if (matchesFrequency(schedule, date, schedule.startDate)) {
        const candidate = localDateTimeToUtc(date, schedule.time, schedule.timezone);
        if (candidate && candidate > after) return candidate;
      }
      date = addCalendarDays(date, 1);
    }

    return null;
  } catch {
    return null;
  }
}

export function isRoutineOccurrence(schedule: RoutineSchedule, scheduledFor: Date) {
  const tolerance = 60_000;
  const occurrence = getRoutineOccurrenceInWindow(
    schedule,
    new Date(scheduledFor.getTime() - tolerance),
    new Date(scheduledFor.getTime() + tolerance),
  );
  return occurrence?.getTime() === scheduledFor.getTime();
}
