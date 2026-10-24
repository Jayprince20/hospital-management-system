import { ApiError } from '@/lib/api';

// Doctor consultation: ICD-10 coding, prescribing safety, abnormal vitals, follow-up (types match the backend contract)

export interface Icd10Code {
  code: string;
  label: string;
  chapter: string;
  notifiable: boolean;
}

/** One diagnosis on a consultation; `code` null = free text (not counted in official statistics) */
export interface DiagnosisEntry {
  label: string;
  code: string | null;
  notifiable?: boolean;
}

export interface MdoAlert {
  code: string;
  label: string;
}

export type SafetyAlertType = 'ALLERGY' | 'INTERACTION' | 'DUPLICATE' | 'AGE';
export type SafetySeverity = 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE';

export interface SafetyAlert {
  type: SafetyAlertType;
  severity: SafetySeverity;
  message: string;
  detail: string;
  medicationIds: string[];
  withCurrentTreatment: boolean;
}

export interface PrescriptionCheck {
  alerts: SafetyAlert[];
  blocking: boolean;
}

export interface DrugInteraction {
  id: string;
  substanceA: string;
  substanceB: string;
  severity: SafetySeverity;
  effect: string;
  recommendation: string;
  isActive: boolean;
}

export type VitalFlagLevel = 'LOW' | 'HIGH' | 'CRITICAL_LOW' | 'CRITICAL_HIGH';

export interface VitalFlag {
  field: string;
  level: VitalFlagLevel;
  message: string;
}

export type FollowUpType = 'IN_PERSON' | 'VIDEO';

export interface FollowUpAppointment {
  id: string;
  date: string;
  startTime: string;
  type: FollowUpType | 'PHONE';
  status: string;
}

/** Minimum length of the doctor's justification when prescribing despite a blocking alert */
export const OVERRIDE_MIN_LENGTH = 10;

/** Stored parallel arrays (diagnosis / diagnosisCodes, "" = uncoded) → entries for the picker */
export function diagnosesFromArrays(labels: string[] = [], codes: string[] = []): DiagnosisEntry[] {
  return labels.map((label, i) => ({ label, code: codes[i] ? codes[i] : null }));
}

/** Entries → the `diagnoses` payload of consultation create/update */
export function diagnosesPayload(entries: DiagnosisEntry[]): Array<{ label: string; code: string | null }> {
  return entries
    .map((e) => ({ label: e.label.trim(), code: e.code?.trim() || null }))
    .filter((e) => e.label);
}

/** Adds an entry unless the same code (or the same uncoded label) is already there */
export function addDiagnosis(entries: DiagnosisEntry[], entry: DiagnosisEntry): DiagnosisEntry[] {
  const label = entry.label.trim();
  if (!label) return entries;
  const duplicate = entries.some((e) => (entry.code ? e.code === entry.code : !e.code && e.label.toLowerCase() === label.toLowerCase()));
  return duplicate ? entries : [...entries, { ...entry, label }];
}

export const SEVERITY_ORDER: SafetySeverity[] = ['CONTRAINDICATED', 'MAJOR', 'MODERATE'];

/** Most severe first; allergies before other types at equal severity */
export function sortAlerts(alerts: SafetyAlert[]): SafetyAlert[] {
  return [...alerts].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || Number(b.type === 'ALLERGY') - Number(a.type === 'ALLERGY')
  );
}

export const isBlockingAlert = (alert: SafetyAlert) => alert.severity === 'CONTRAINDICATED' || alert.severity === 'MAJOR';

/** Blocking state: alerts returned by a refused save take precedence over the live check */
export function isBlocked(check: PrescriptionCheck | null, savedAlerts?: SafetyAlert[] | null): boolean {
  return savedAlerts ? savedAlerts.some(isBlockingAlert) : Boolean(check?.blocking);
}

/** A prescription may be submitted when nothing blocks, or with a long enough justification */
export function canSubmitPrescription(check: PrescriptionCheck | null, savedAlerts: SafetyAlert[] | null | undefined, override: string): boolean {
  return !isBlocked(check, savedAlerts) || override.trim().length >= OVERRIDE_MIN_LENGTH;
}

/** Alerts carried by a 409 'Prescription safety check failed' response, or null for any other error */
export function safetyAlertsFromError(err: unknown): SafetyAlert[] | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const data = err.data as { alerts?: SafetyAlert[] } | undefined;
  return Array.isArray(data?.alerts) ? data.alerts : null;
}

export const SEVERITY_STYLE: Record<SafetySeverity, string> = {
  CONTRAINDICATED: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200',
  MAJOR: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
  MODERATE: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200',
};

export const isCriticalFlag = (flag: VitalFlag) => flag.level === 'CRITICAL_LOW' || flag.level === 'CRITICAL_HIGH';

export const VITAL_FLAG_STYLE: Record<VitalFlagLevel, string> = {
  LOW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  HIGH: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  CRITICAL_LOW: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  CRITICAL_HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

/** Worst flag of a field (critical before abnormal), for colouring a value */
export function worstFlag(flags: VitalFlag[] | undefined, field: string): VitalFlag | null {
  const matching = (flags ?? []).filter((f) => f.field === field);
  return matching.find(isCriticalFlag) ?? matching[0] ?? null;
}

/** Free start times of a day from the doctor's availability slots */
export function freeSlotTimes(slots: Array<{ time: string; available: boolean }>): string[] {
  return slots.filter((s) => s.available).map((s) => s.time);
}
