/**
 * Lab workflow rules shared by the pages. They mirror the server (which decides): the
 * reference range that applies to a patient, the flag of a result, numeric parsing, and the
 * worklist buckets an order belongs to.
 */

export type LabResultType = 'NUMERIC' | 'TEXT' | 'OPTION';
export type LabFlag = 'N' | 'L' | 'H' | 'LL' | 'HH' | 'A';
export type LabSex = 'MALE' | 'FEMALE' | 'OTHER' | null | undefined;

type Num = number | string | null | undefined;

export interface RangeRow {
  sex?: 'MALE' | 'FEMALE' | null;
  ageMinYears?: number | null;
  ageMaxYears?: number | null;
  low?: Num;
  high?: Num;
  criticalLow?: Num;
  criticalHigh?: Num;
  label?: string | null;
}

export interface TestRanges {
  refLow?: Num;
  refHigh?: Num;
  criticalLow?: Num;
  criticalHigh?: Num;
  referenceRanges?: RangeRow[] | null;
}

export interface AppliedRange {
  low: number | null;
  high: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  label: string | null;
}

const toNum = (v: Num): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Whole years between a birth date and a day */
export function ageInYears(dateOfBirth: string | Date | null | undefined, on: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = on.getFullYear() - dob.getFullYear();
  const m = on.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < dob.getDate())) age -= 1;
  return age;
}

/**
 * The range for this patient: the most specific matching row (sex and age band both count;
 * between equally specific rows, the narrower age band wins), else the test's default range.
 */
export function selectRange(test: TestRanges, sex: LabSex, age: number | null): AppliedRange {
  let best: { row: RangeRow; score: number; width: number } | null = null;
  for (const row of test.referenceRanges ?? []) {
    if (row.sex && row.sex !== sex) continue;
    const hasAge = row.ageMinYears != null || row.ageMaxYears != null;
    if (hasAge) {
      if (age == null) continue;
      if (row.ageMinYears != null && age < row.ageMinYears) continue;
      if (row.ageMaxYears != null && age >= row.ageMaxYears) continue;
    }
    const score = (row.sex ? 2 : 0) + (hasAge ? 1 : 0);
    const width = (row.ageMaxYears ?? 200) - (row.ageMinYears ?? 0);
    if (!best || score > best.score || (score === best.score && width < best.width)) best = { row, score, width };
  }
  if (best) {
    const r = best.row;
    return {
      low: toNum(r.low),
      high: toNum(r.high),
      // A row without its own critical values keeps the test's
      criticalLow: toNum(r.criticalLow) ?? toNum(test.criticalLow),
      criticalHigh: toNum(r.criticalHigh) ?? toNum(test.criticalHigh),
      label: r.label ?? null,
    };
  }
  return {
    low: toNum(test.refLow),
    high: toNum(test.refHigh),
    criticalLow: toNum(test.criticalLow),
    criticalHigh: toNum(test.criticalHigh),
    label: null,
  };
}

/** "12,5" or "12.5" → 12.5; anything else (letters, "<5", empty) → null */
export function parseNumeric(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Flag of a numeric value against the applied range (critical first) */
export function numericFlag(value: number, range: AppliedRange): LabFlag {
  if (range.criticalLow != null && value < range.criticalLow) return 'LL';
  if (range.criticalHigh != null && value > range.criticalHigh) return 'HH';
  if (range.low != null && value < range.low) return 'L';
  if (range.high != null && value > range.high) return 'H';
  return 'N';
}

/**
 * Flag of an entered result. OPTION: the first option is the normal answer, any other is
 * abnormal (A). TEXT: no flag. Returns null when the value can't be judged (empty/invalid).
 */
export function resultFlag(
  resultType: LabResultType | string | undefined,
  value: string,
  range: AppliedRange,
  options: string[] = []
): LabFlag | null {
  const type = (resultType ?? 'NUMERIC') as LabResultType;
  if (!value.trim()) return null;
  if (type === 'TEXT') return null;
  if (type === 'OPTION') {
    if (options.length === 0 || !options.includes(value)) return null;
    return value === options[0] ? 'N' : 'A';
  }
  const n = parseNumeric(value);
  return n == null ? null : numericFlag(n, range);
}

export const isCriticalFlag = (flag: string | null | undefined) => flag === 'LL' || flag === 'HH';
export const isAbnormalFlag = (flag: string | null | undefined) => !!flag && flag !== 'N';

/** Arrow shown next to a value */
export function flagSymbol(flag: string | null | undefined): string {
  switch (flag) {
    case 'H':
      return '↑';
    case 'L':
      return '↓';
    case 'HH':
      return '↑!!';
    case 'LL':
      return '↓!!';
    case 'A':
      return '!';
    default:
      return '';
  }
}

export function flagClass(flag: string | null | undefined): string {
  if (isCriticalFlag(flag)) return 'text-red-700 dark:text-red-400 font-bold';
  if (isAbnormalFlag(flag)) return 'text-orange-600 dark:text-orange-400 font-semibold';
  return 'text-gray-900 dark:text-white';
}

/** "3,9 – 6,1" / "< 5" / "> 150" / "" */
export function formatRange(range: Pick<AppliedRange, 'low' | 'high'>, locale = 'fr'): string {
  const f = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 4 });
  if (range.low != null && range.high != null) return `${f(range.low)} – ${f(range.high)}`;
  if (range.high != null) return `< ${f(range.high)}`;
  if (range.low != null) return `> ${f(range.low)}`;
  return '';
}

/** Digits a keyboard-wedge scanner typed (it may add spaces, a prefix or a trailing newline) */
export function normaliseBarcode(input: string): string {
  return input.replace(/\D/g, '');
}

export const isValidBarcode = (barcode: string) => /^\d{10}$/.test(barcode);

// ---------- worklist buckets ----------

export type LabBucket = 'toCollect' | 'toReceive' | 'toEnter' | 'toValidate' | 'released';
export const LAB_BUCKETS: LabBucket[] = ['toCollect', 'toReceive', 'toEnter', 'toValidate', 'released'];

export interface BucketInput {
  status: string;
  samples?: Array<{ status: string }> | null;
  counts?: { pending?: number; entered?: number; validated?: number; released?: number } | null;
  /** Items still to collect (pending and without a usable sample), when the server sends it */
  toCollect?: number | null;
}

/** Every tab an order shows up in: one order can wait at several steps (tubes, tests) */
export function bucketsOf(order: BucketInput): LabBucket[] {
  if (order.status === 'CANCELLED') return [];
  const samples = order.samples ?? [];
  const c = order.counts ?? {};
  const pending = c.pending ?? 0;
  const entered = c.entered ?? 0;
  const released = c.released ?? 0;
  const total = pending + entered + (c.validated ?? 0) + released;
  const usable = samples.filter((s) => s.status !== 'REJECTED');
  const out: LabBucket[] = [];
  const needsCollection = order.toCollect != null ? order.toCollect > 0 : pending > 0 && (usable.length === 0 || samples.some((s) => s.status === 'REJECTED'));
  if (order.status === 'ORDERED' || needsCollection) out.push('toCollect');
  if (usable.some((s) => s.status === 'COLLECTED')) out.push('toReceive');
  if (pending > 0 && usable.some((s) => s.status === 'RECEIVED')) out.push('toEnter');
  if (entered > 0) out.push('toValidate');
  if (total > 0 && released === total) out.push('released');
  return [...new Set(out)];
}

const PRIORITY_RANK: Record<string, number> = { STAT: 0, URGENT: 1, ROUTINE: 2 };

/** STAT, then URGENT, then the oldest first */
export function sortLabWorklist<T extends { priority: string; createdAt: string }>(orders: T[]): T[] {
  return [...orders].sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/** Same rule as the server: lab/biology department, or a biology specialisation */
export function isBiologistProfile(department: string | null | undefined, specializations: string[] | null | undefined): boolean {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const dept = fold(department ?? '');
  if (dept.includes('laboratoire') || dept.includes('biolog')) return true;
  return (specializations ?? []).some((s) => fold(s).includes('biolog'));
}

export const REJECTION_REASONS = ['HEMOLYSED', 'CLOTTED', 'INSUFFICIENT', 'MISLABELLED', 'DELAYED', 'OTHER'] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const CONTAINERS = ['EDTA', 'Sec', 'Citrate', 'Fluorure', 'Héparine', 'Pot stérile', 'Écouvillon'] as const;

/** Tube cap colour for a container, for the small badge */
export function containerColour(container: string | null | undefined): string {
  const c = (container ?? '').toLowerCase();
  if (c.includes('edta')) return 'bg-purple-500';
  if (c.includes('citrate')) return 'bg-sky-400';
  if (c.includes('fluor')) return 'bg-gray-400';
  if (c.includes('hépar') || c.includes('hepar')) return 'bg-green-500';
  if (c.includes('sec')) return 'bg-red-500';
  return 'bg-amber-300';
}
