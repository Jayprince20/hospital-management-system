// Pure helpers for the imaging (radiology) screens. Rules mirror the backend so the UI can
// warn early; the server stays the authority.

export type ImagingModality = 'XRAY' | 'ULTRASOUND' | 'CT' | 'MRI' | 'MAMMOGRAPHY' | 'FLUOROSCOPY';
export type ImagingOrderStatus = 'ORDERED' | 'SCHEDULED' | 'ARRIVED' | 'PERFORMED' | 'REPORTED' | 'CANCELLED';
export type ImagingPriority = 'ROUTINE' | 'URGENT' | 'STAT';
export type PregnancyStatus = 'NOT_APPLICABLE' | 'NOT_PREGNANT' | 'POSSIBLE' | 'PREGNANT';

export const MODALITIES: ImagingModality[] = ['XRAY', 'ULTRASOUND', 'CT', 'MRI', 'MAMMOGRAPHY', 'FLUOROSCOPY'];
export const PRIORITIES: ImagingPriority[] = ['ROUTINE', 'URGENT', 'STAT'];
export const PREGNANCY_STATUSES: PregnancyStatus[] = ['NOT_PREGNANT', 'POSSIBLE', 'PREGNANT', 'NOT_APPLICABLE'];

/** Worklist tabs, in the order the exam goes through them */
export const WORKLIST_TABS: ImagingOrderStatus[] = ['ORDERED', 'SCHEDULED', 'ARRIVED', 'PERFORMED', 'REPORTED'];

/** Modalities that use X-rays: a woman of childbearing age needs her pregnancy status recorded */
const IONISING: ReadonlySet<ImagingModality> = new Set(['XRAY', 'CT', 'MAMMOGRAPHY', 'FLUOROSCOPY']);

export function isIonising(modality: ImagingModality): boolean {
  return IONISING.has(modality);
}

/** Female patient aged 12–50 having an ionising exam */
export function needsPregnancyCheck(modality: ImagingModality, gender: string | null | undefined, age: number | null | undefined): boolean {
  if (!isIonising(modality) || gender !== 'FEMALE' || age == null) return false;
  return age >= 12 && age <= 50;
}

/** Pregnancy statuses that need the radiologist's agreement before the exam */
export function pregnancyNeedsAgreement(status: PregnancyStatus | null | undefined): boolean {
  return status === 'POSSIBLE' || status === 'PREGNANT';
}

/** What blocks "Examen réalisé", as translation keys (empty = ready) */
export function performBlockers(input: {
  modality: ImagingModality;
  usesContrast: boolean;
  gender?: string | null;
  age?: number | null;
  pregnancyStatus?: PregnancyStatus | null;
  contrastChecked?: boolean;
  radiologistAgreed?: boolean;
  contrastAllergy?: boolean;
  overrideReason?: string;
}): string[] {
  const problems: string[] = [];
  if (needsPregnancyCheck(input.modality, input.gender, input.age)) {
    if (!input.pregnancyStatus) problems.push('img.safety.block.pregnancy');
    else if (pregnancyNeedsAgreement(input.pregnancyStatus) && !input.radiologistAgreed) problems.push('img.safety.block.agreement');
  }
  if (input.usesContrast) {
    if (!input.contrastChecked) problems.push('img.safety.block.contrast');
    if (input.contrastAllergy && !input.overrideReason?.trim()) problems.push('img.safety.block.allergy');
  }
  return problems;
}

// ---------- files ----------

export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_ORDER = 20;

/** null when the file can be uploaded, else the reason (translation key) */
export function fileProblem(file: { type: string; size: number }, maxBytes = DEFAULT_MAX_FILE_BYTES): 'img.files.badType' | 'img.files.tooLarge' | 'img.files.empty' | null {
  if (!(ALLOWED_FILE_TYPES as readonly string[]).includes(file.type)) return 'img.files.badType';
  if (file.size <= 0) return 'img.files.empty';
  if (file.size > maxBytes) return 'img.files.tooLarge';
  return null;
}

export function isImageType(mimeType: string): boolean {
  return mimeType === 'image/jpeg' || mimeType === 'image/png';
}

/** "850 Ko", "2,4 Mo" */
export function formatFileSize(bytes: number, locale = 'fr'): string {
  const fr = locale.startsWith('fr');
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ${fr ? 'Ko' : 'KB'}`;
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return `${fr ? mb.replace('.', ',') : mb} ${fr ? 'Mo' : 'MB'}`;
}

// ---------- worklist ----------

const PRIORITY_RANK: Record<ImagingPriority, number> = { STAT: 0, URGENT: 1, ROUTINE: 2 };

/** STAT first, then URGENT, then by appointment time (or request time when not scheduled) */
export function sortWorklist<T extends { priority: ImagingPriority; scheduledAt?: string | null; createdAt: string }>(orders: T[]): T[] {
  return [...orders].sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    const ta = new Date(a.scheduledAt ?? a.createdAt).getTime();
    const tb = new Date(b.scheduledAt ?? b.createdAt).getTime();
    return ta - tb;
  });
}

export const STATUS_STYLE: Record<ImagingOrderStatus, string> = {
  ORDERED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  ARRIVED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  PERFORMED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  REPORTED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const PRIORITY_STYLE: Record<ImagingPriority, string> = {
  ROUTINE: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  URGENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  STAT: 'bg-red-600 text-white',
};

/** Steps shown in the exam timeline; the index of the current status (-1 when cancelled) */
export function timelineIndex(status: ImagingOrderStatus): number {
  return WORKLIST_TABS.indexOf(status);
}

/** Same rule as the server: radiology department, or radiology / ultrasound specialisation */
export function isRadiologistProfile(department: string | null | undefined, specializations: string[] | null | undefined): boolean {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const dept = fold(department ?? '');
  if (dept.includes('imagerie') || dept.includes('radiolog')) return true;
  return (specializations ?? []).some((s) => {
    const f = fold(s);
    return f.includes('radiolog') || f.includes('echograph');
  });
}

/** A scheduled time in the past (beyond a few minutes) is refused by the server */
export function scheduleInPast(value: string, now = new Date()): boolean {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return true;
  return at.getTime() < now.getTime() - 5 * 60 * 1000;
}
