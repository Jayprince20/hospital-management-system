// Staff rosters: pure helpers shared by the planning grid, "Mon planning", leave and on-call
// screens. Dates are local calendar days (YYYY-MM-DD), times HH:MM, like the API.

export type WarningType = 'OVERLAP' | 'REST_UNDER_11H' | 'WEEK_OVER_48H' | 'ON_LEAVE' | 'NO_ON_CALL';

export const WARNING_TYPES: WarningType[] = ['OVERLAP', 'REST_UNDER_11H', 'WEEK_OVER_48H', 'ON_LEAVE', 'NO_ON_CALL'];

/** Minutes since midnight for "HH:MM"; null when malformed */
export function parseHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** A valid "HH:MM" (24 h clock) */
export function isValidTime(value: string): boolean {
  return parseHHMM(value) !== null;
}

/** Local Date for a YYYY-MM-DD day at a given number of minutes after midnight */
function atMinutes(date: string, minutes: number): Date {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(y, mo - 1, d, 0, minutes);
}

/**
 * When a shift of this type, starting on `date`, begins and ends. An end time earlier than the
 * start means the shift ends the next day; an equal end time is a 24 h shift (garde 08:00–08:00).
 */
export function shiftSpan(date: string, startTime: string, endTime: string): { startsAt: Date; endsAt: Date; overnight: boolean; hours: number } {
  const start = parseHHMM(startTime) ?? 0;
  const end = parseHHMM(endTime) ?? 0;
  const overnight = end <= start;
  const startsAt = atMinutes(date, start);
  const endsAt = atMinutes(date, overnight ? end + 24 * 60 : end);
  return { startsAt, endsAt, overnight, hours: (endsAt.getTime() - startsAt.getTime()) / 3_600_000 };
}

/** Length in hours of a shift type (overnight aware) */
export function shiftHours(startTime: string, endTime: string): number {
  return shiftSpan('2026-01-05', startTime, endTime).hours;
}

/** YYYY-MM-DD of a Date in local time */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Date object (local midnight) for YYYY-MM-DD */
export function fromIso(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, n: number): string {
  const d = fromIso(date);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** YYYY-MM of a day, or of today */
export function monthOf(date?: string | Date): string {
  const d = typeof date === 'string' ? fromIso(date) : date ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Shift a YYYY-MM month by n months */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthOf(d);
}

export interface GridDay {
  date: string;
  day: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  isSunday: boolean;
  isSaturday: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isToday: boolean;
}

/** Every day of a month for the planning grid */
export function monthDays(month: string, holidays: Array<{ date: string; name: string }> = [], today: string = isoDate(new Date())): GridDay[] {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(y, m, 0).getDate();
  const byDate = new Map(holidays.map((h) => [h.date.slice(0, 10), h.name]));
  return Array.from({ length: count }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    const weekday = new Date(y, m - 1, i + 1).getDay();
    return {
      date,
      day: i + 1,
      weekday,
      isSunday: weekday === 0,
      isSaturday: weekday === 6,
      isHoliday: byDate.has(date),
      holidayName: byDate.get(date),
      isToday: date === today,
    };
  });
}

/** Monday of the week containing `date` */
export function weekStart(date: string): string {
  const d = fromIso(date);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return isoDate(d);
}

/**
 * Working days between two dates inclusive: Monday to Saturday, minus public holidays
 * (Cameroon counts Saturday as a working day for leave). 0 when end is before start.
 */
export function countWorkingDays(startDate: string, endDate: string, holidays: Iterable<string> = []): number {
  if (!startDate || !endDate || endDate < startDate) return 0;
  const off = new Set(Array.from(holidays, (h) => h.slice(0, 10)));
  let count = 0;
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    if (fromIso(d).getDay() !== 0 && !off.has(d)) count += 1;
  }
  return count;
}

/** Whether a (leave) period covers a day, both ends inclusive */
export function coversDay(range: { startDate: string; endDate: string }, date: string): boolean {
  return range.startDate.slice(0, 10) <= date && date <= range.endDate.slice(0, 10);
}

/** Key for a grid cell */
export const cellKey = (userId: string, date: string) => `${userId}|${date}`;

/** Admin, or head of this department */
export function isManagerOf(user: { id: string; role: string } | null | undefined, department: { head?: { id: string } | null } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return Boolean(department?.head && department.head.id === user.id);
}

/** Translation key for a roster warning */
export function warningKey(type: string): string {
  return (WARNING_TYPES as string[]).includes(type) ? `ros.warning.${type}` : 'ros.warning.OTHER';
}

/** Coverage colour of a day: no on-call at all is the problem to see */
export function coverageLevel(count: number): 'none' | 'ok' {
  return count > 0 ? 'ok' : 'none';
}

/** Text colour (black/white) readable on a shift colour */
export function readableTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#111827';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Relative luminance (sRGB approximation)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111827' : '#ffffff';
}

/** Remaining annual leave once a request of `days` would be approved */
export function remainingAfter(balance: { remaining: number }, days: number): number {
  return balance.remaining - days;
}
