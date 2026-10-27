import type {
  AdministrationStatus,
  AdmissionBill,
  BedAssignmentEntry,
  BedStatus,
  DoseStatus,
  MedicationRoute,
  Ward,
  WardBed,
  WardGender,
} from '@/lib/api';

export const BED_STATUSES: BedStatus[] = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'RESERVED'];

/** Bed tile on the bed board, per status (light and dark) */
export const BED_TILE: Record<BedStatus, string> = {
  AVAILABLE: 'bg-green-50 border-green-300 text-green-900 dark:bg-green-900/20 dark:border-green-700 dark:text-green-200',
  OCCUPIED: 'bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-100',
  CLEANING: 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200',
  MAINTENANCE: 'bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-300',
  RESERVED: 'bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-200',
};

/** Small status dot / legend swatch */
export const BED_DOT: Record<BedStatus, string> = {
  AVAILABLE: 'bg-green-500',
  OCCUPIED: 'bg-blue-500',
  CLEANING: 'bg-amber-500',
  MAINTENANCE: 'bg-gray-400',
  RESERVED: 'bg-purple-500',
};

/** Dose slot on the medication administration record */
export const DOSE_STYLE: Record<DoseStatus, string> = {
  UPCOMING: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
  DUE: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700',
  OVERDUE: 'bg-red-100 text-red-800 border-red-400 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700',
  GIVEN: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700',
  REFUSED: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-700',
  HELD: 'bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-200 dark:border-yellow-700',
  MISSED: 'bg-red-200 text-red-900 border-red-400 dark:bg-red-900/60 dark:text-red-100 dark:border-red-700',
};

export const ADMINISTRATION_STATUSES: AdministrationStatus[] = ['GIVEN', 'REFUSED', 'HELD', 'MISSED'];

/** A dose not given needs a reason */
export function needsReason(status: AdministrationStatus): boolean {
  return status !== 'GIVEN';
}

/** A dose slot can still be recorded */
export function isOpenDose(status: DoseStatus): boolean {
  return status === 'DUE' || status === 'OVERDUE' || status === 'UPCOMING';
}

export const MEDICATION_ROUTES: MedicationRoute[] = ['PO', 'IV', 'IM', 'SC', 'INH', 'TOP', 'PR', 'SL', 'OTHER'];

/** Usual administration schedules, offered as one-click presets */
export const TIME_PRESETS: Array<{ key: string; times: string[] }> = [
  { key: 'once', times: ['08:00'] },
  { key: 'twice', times: ['08:00', '20:00'] },
  { key: 'thrice', times: ['06:00', '14:00', '22:00'] },
  { key: 'fourTimes', times: ['06:00', '12:00', '18:00', '00:00'] },
];

export const MAX_TIMES = 8;

/**
 * Read an administration time typed by a nurse or doctor: "8", "8h", "8:30", "08h30", "20 h".
 * Returns "HH:MM" or null when it isn't a time. Midnight may be typed as 24.
 */
export function parseTime(raw: string): string | null {
  const m = /^\s*(\d{1,2})\s*(?:[:hH.]\s*(\d{2})?)?\s*$/.exec(raw);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = m[2] === undefined ? 0 : Number(m[2]);
  if (hours === 24 && minutes === 0) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Add a time to a schedule: sorted, no duplicates, at most MAX_TIMES */
export function addTime(times: string[], time: string): string[] {
  if (times.includes(time) || times.length >= MAX_TIMES) return times;
  return [...times, time].sort();
}

/** Ward gender rule: does this ward take this patient? */
export function wardTakes(gender: WardGender, patientGender: string | null | undefined): boolean {
  if (gender === 'ANY' || !patientGender) return true;
  return gender === patientGender;
}

/** Beds a new patient (or a transfer) can go to: free or reserved, active, in an active ward that takes them */
/** Children's wards take patients under this age (the server applies the same rule) */
export const PAEDIATRIC_MAX_AGE = 15;

export function freeBeds(
  wards: Ward[],
  patientGender?: string | null,
  excludeBedId?: string,
  patientAge?: number | null
): Array<{ ward: Ward; bed: WardBed }> {
  return wards
    .filter((w) => w.isActive && wardTakes(w.gender, patientGender))
    .filter((w) => w.type !== 'PAEDIATRIC' || patientAge == null || patientAge < PAEDIATRIC_MAX_AGE)
    .flatMap((ward) =>
      ward.beds
        .filter((b) => b.isActive && (b.status === 'AVAILABLE' || b.status === 'RESERVED') && b.id !== excludeBedId)
        .map((bed) => ({ ward, bed }))
    );
}

/** Coverage split of a stay bill, whether the server sends it flat or nested */
export function billSplit(bill: AdmissionBill): { insurerShare: number; patientShare: number; payerName: string | null } {
  // The server sends the split under `coverage` ({ coverage, insurerShare, patientShare, … });
  // older shapes had it flat or under `preview`
  const raw = bill as unknown as Record<string, unknown>;
  const nested = (raw.coverage && typeof raw.coverage === 'object' && 'insurerShare' in (raw.coverage as object)
    ? raw.coverage
    : bill.preview ?? null) as { insurerShare?: number; patientShare?: number; coverage?: { payer?: { name?: string } } | null } | null;
  const insurerShare = Number(bill.insurerShare ?? nested?.insurerShare ?? 0);
  const patientShare = Number(bill.patientShare ?? nested?.patientShare ?? bill.subtotal - insurerShare);
  const coverage = (nested ? nested.coverage : bill.coverage) ?? null;
  return { insurerShare, patientShare, payerName: coverage?.payer?.name ?? null };
}

/** Name of the ward on a bed-history line (the server may send the ward as text or as an object) */
export function assignmentWard(entry: BedAssignmentEntry): string {
  return typeof entry.bed.ward === 'string' ? entry.bed.ward : entry.bed.ward.name;
}

/** Bed labels typed as "1-8", "1, 2, 3A" or one per line */
export function parseBedLabels(raw: string): string[] {
  const labels: string[] = [];
  for (const part of raw.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean)) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])];
      if (to >= from && to - from < 100) for (let i = from; i <= to; i++) labels.push(String(i));
      continue;
    }
    labels.push(part);
  }
  return [...new Set(labels)];
}

/** Local YYYY-MM-DD for date inputs and the MAR day */
export function localDay(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
