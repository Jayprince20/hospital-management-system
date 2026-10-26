// Maternal & child health: immunisation (PEV), growth monitoring (WHO standards) and antenatal care.
// Types follow the backend contract; the helpers below are pure (unit-tested).
import { ageOn } from '@/lib/patient-extras';

export interface StaffRef {
  id: string;
  name: string;
}

// ---------- Immunisation ----------

export type VaccineStatus = 'GIVEN' | 'DUE' | 'OVERDUE' | 'UPCOMING' | 'NOT_APPLICABLE';
export type VaccineRoute = 'ID' | 'IM' | 'SC' | 'ORAL';
export const VACCINE_ROUTES: VaccineRoute[] = ['ID', 'IM', 'SC', 'ORAL'];

export interface ImmunizationRecord {
  id: string;
  vaccineCode: string;
  doseNumber: number;
  label: string;
  administeredOn: string;
  lotNumber: string | null;
  expiryDate: string | null;
  site: string | null;
  route: VaccineRoute | null;
  external: boolean;
  source: string | null;
  givenBy: StaffRef | null;
  recordedBy: StaffRef;
  notes: string | null;
  aefi: string | null;
  enteredInError: boolean;
  createdAt: string;
}

export interface ScheduleItem {
  vaccineCode: string;
  doseNumber: number;
  label: string;
  dueOn: string;
  status: VaccineStatus;
  recordId: string | null;
  administeredOn: string | null;
}

export interface ImmunizationOverview {
  scheduleVersion: string;
  dateOfBirth: string;
  records: ImmunizationRecord[];
  schedule: ScheduleItem[];
  summary: { upToDate: boolean; overdue: number; nextDue: ScheduleItem | null };
}

export interface ImmunizationInput {
  vaccineCode: string;
  doseNumber: number;
  administeredOn: string;
  lotNumber?: string;
  expiryDate?: string;
  site?: string;
  route?: VaccineRoute;
  external?: boolean;
  source?: string;
  notes?: string;
}

export type ImmunizationCreated = ImmunizationRecord & { warnings?: string[] };

export interface ImmunizationPatch {
  lotNumber?: string;
  site?: string;
  notes?: string;
  aefi?: string;
  enteredInError?: boolean;
}

export interface DueChild {
  patient: { id: string; patientId: string; firstName: string; lastName: string; dateOfBirth: string; phoneNumber: string | null; guardianName?: string | null };
  ageLabel: string;
  items: ScheduleItem[];
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const VACCINE_STATUS_STYLE: Record<VaccineStatus, string> = {
  GIVEN: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-200 dark:border-green-800',
  DUE: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800',
  OVERDUE: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800',
  UPCOMING: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600',
  NOT_APPLICABLE: 'bg-white text-gray-400 border-dashed border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700',
};

/** A dose that can be recorded now (not given, not excluded) */
export const isRecordable = (item: ScheduleItem) => item.status === 'DUE' || item.status === 'OVERDUE' || item.status === 'UPCOMING';

const DAY_MS = 86_400_000;

function parseDay(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to) - parseDay(from)) / DAY_MS);
}

/** Age bucket of a schedule visit: "birth", weeks under 4 months, months under 2 years, else years */
export type AgeGroupKey = { unit: 'birth' | 'weeks' | 'months' | 'years'; n: number };

export function ageGroupOf(ageDays: number): AgeGroupKey {
  if (ageDays < 28) return { unit: 'birth', n: 0 };
  if (ageDays < 120) return { unit: 'weeks', n: Math.round(ageDays / 7) };
  if (ageDays < 730) return { unit: 'months', n: Math.round(ageDays / 30.4375) };
  return { unit: 'years', n: Math.round(ageDays / 365.25) };
}

export const ageGroupKeyString = (g: AgeGroupKey) => `${g.unit}-${g.n}`;

export interface ScheduleGroup {
  key: string;
  group: AgeGroupKey;
  ageDays: number;
  items: ScheduleItem[];
}

/** The schedule as visits: doses due at the same age together, in age order */
export function groupSchedule(items: ScheduleItem[], dateOfBirth: string): ScheduleGroup[] {
  const groups = new Map<string, ScheduleGroup>();
  for (const item of items) {
    const ageDays = Math.max(0, daysBetween(dateOfBirth, item.dueOn));
    const group = ageGroupOf(ageDays);
    const key = ageGroupKeyString(group);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      existing.ageDays = Math.min(existing.ageDays, ageDays);
    } else {
      groups.set(key, { key, group, ageDays, items: [item] });
    }
  }
  return [...groups.values()].sort((a, b) => a.ageDays - b.ageDays);
}

/** Translation key + params for an age group label */
export function ageGroupLabel(g: AgeGroupKey): { key: string; params?: Record<string, number> } {
  if (g.unit === 'birth') return { key: 'mc.age.birth' };
  return { key: `mc.age.${g.unit}`, params: { n: g.n } };
}

// ---------- Growth ----------

export type GrowthIndicator = 'wfa' | 'lhfa' | 'bfa' | 'hcfa' | 'wfl' | 'wfh';
export const GROWTH_INDICATORS: GrowthIndicator[] = ['wfa', 'lhfa', 'wfl', 'wfh', 'bfa', 'hcfa'];

export interface GrowthZ {
  wfa: number | null;
  lhfa: number | null;
  wflh: number | null;
  bfa: number | null;
  hcfa: number | null;
}

export interface GrowthPoint {
  id: string;
  measuredOn: string;
  ageDays: number;
  ageMonths: number;
  weightKg: number | null;
  lengthHeightCm: number | null;
  measuredLying: boolean | null;
  headCircumferenceCm: number | null;
  muacCm: number | null;
  oedema: boolean;
  z: GrowthZ;
  status: string[];
  recordedBy: StaffRef;
  notes: string | null;
}

export interface GrowthOverview {
  sex: string;
  dateOfBirth: string;
  measurements: GrowthPoint[];
  latest: GrowthPoint | null;
  eligible: boolean;
}

export interface GrowthInput {
  measuredOn: string;
  weightKg?: number;
  lengthHeightCm?: number;
  measuredLying?: boolean;
  headCircumferenceCm?: number;
  muacCm?: number;
  oedema?: boolean;
  notes?: string;
  confirmImplausible?: boolean;
}

export interface GrowthReferencePoint {
  x: number;
  sdm3: number;
  sdm2: number;
  sd0: number;
  sd2: number;
  sd3: number;
}

export interface GrowthReference {
  indicator: GrowthIndicator;
  sex: 'M' | 'F';
  xUnit: 'month' | 'cm';
  points: GrowthReferencePoint[];
}

/** Sex code for the WHO tables from a patient gender or a backend sex value */
export function sexCode(value: string | null | undefined): 'M' | 'F' | null {
  if (!value) return null;
  const v = value.toUpperCase();
  if (v === 'M' || v === 'MALE') return 'M';
  if (v === 'F' || v === 'FEMALE') return 'F';
  return null;
}

/** Which z-score belongs to an indicator (weight-for-length and -height share wflh) */
export function zOf(point: GrowthPoint, indicator: GrowthIndicator): number | null {
  if (indicator === 'wfl' || indicator === 'wfh') return point.z.wflh;
  return point.z[indicator];
}

/** x (months or cm) and y for one measurement on a chart; null when it does not apply */
export function chartPointOf(point: GrowthPoint, indicator: GrowthIndicator): { x: number; y: number } | null {
  const w = point.weightKg;
  const h = point.lengthHeightCm;
  switch (indicator) {
    case 'wfa':
      return w != null ? { x: point.ageMonths, y: w } : null;
    case 'lhfa':
      return h != null ? { x: point.ageMonths, y: h } : null;
    case 'hcfa':
      return point.headCircumferenceCm != null ? { x: point.ageMonths, y: point.headCircumferenceCm } : null;
    case 'bfa':
      return w != null && h != null && h > 0 ? { x: point.ageMonths, y: Math.round((w / (h / 100) ** 2) * 10) / 10 } : null;
    case 'wfl':
      return w != null && h != null && point.ageMonths < 24 ? { x: h, y: w } : null;
    case 'wfh':
      return w != null && h != null && point.ageMonths >= 24 ? { x: h, y: w } : null;
  }
}

export interface ChartMeasurement {
  x: number;
  y: number;
  id: string;
  measuredOn: string;
  z: number | null;
}

/** The child's points for an indicator, in x order, limited to the reference range */
export function chartMeasurements(points: GrowthPoint[], indicator: GrowthIndicator, reference?: GrowthReference | null): ChartMeasurement[] {
  const xs = reference?.points.map((p) => p.x) ?? [];
  const min = xs.length ? Math.min(...xs) : -Infinity;
  const max = xs.length ? Math.max(...xs) : Infinity;
  return points
    .map((p) => {
      const c = chartPointOf(p, indicator);
      return c ? { ...c, id: p.id, measuredOn: p.measuredOn, z: zOf(p, indicator) } : null;
    })
    .filter((c): c is ChartMeasurement => c !== null && c.x >= min && c.x <= max)
    .sort((a, b) => a.x - b.x);
}

/** Default chart for a child: weight-for-age under 5 years */
export function defaultIndicator(latest: GrowthPoint | null): GrowthIndicator {
  return latest && latest.ageMonths > 60 ? 'bfa' : 'wfa';
}

export type Severity = 'severe' | 'moderate' | 'info';

export const NUTRITION_SEVERITY: Record<string, Severity> = {
  SAM: 'severe',
  MAM: 'moderate',
  SEVERELY_STUNTED: 'severe',
  STUNTED: 'moderate',
  SEVERELY_UNDERWEIGHT: 'severe',
  UNDERWEIGHT: 'moderate',
  OVERWEIGHT: 'moderate',
  OBESE: 'severe',
  FALTERING: 'moderate',
};

export const SEVERITY_STYLE: Record<Severity, string> = {
  severe: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800',
  moderate: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-800',
  info: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600',
};

export const nutritionStyle = (code: string) => SEVERITY_STYLE[NUTRITION_SEVERITY[code] ?? 'info'];

/** Severe findings first */
export function sortStatuses(codes: string[]): string[] {
  const rank = (c: string) => ({ severe: 0, moderate: 1, info: 2 })[NUTRITION_SEVERITY[c] ?? 'info'];
  return [...codes].sort((a, b) => rank(a) - rank(b));
}

/** "+1,2" / "−2,4" (French decimal comma by default) */
export function formatZ(z: number | null | undefined, decimalComma = true): string {
  if (z == null || Number.isNaN(z)) return '—';
  const abs = Math.abs(z).toFixed(1);
  const text = decimalComma ? abs.replace('.', ',') : abs;
  return z > 0 ? `+${text}` : z < 0 ? `−${text}` : text;
}

// ---------- Antenatal care ----------

export type PregnancyCareStatus = 'ONGOING' | 'DELIVERED' | 'ENDED' | 'TRANSFERRED';
export type PregnancyOutcome = 'LIVE_BIRTH' | 'STILLBIRTH' | 'MISCARRIAGE' | 'ABORTION' | 'ECTOPIC' | 'TRANSFERRED_OUT';
export const PREGNANCY_OUTCOMES: PregnancyOutcome[] = ['LIVE_BIRTH', 'STILLBIRTH', 'MISCARRIAGE', 'ABORTION', 'ECTOPIC', 'TRANSFERRED_OUT'];
export type DeliveryMode = 'VAGINAL' | 'CESAREAN' | 'ASSISTED';
export const DELIVERY_MODES: DeliveryMode[] = ['VAGINAL', 'CESAREAN', 'ASSISTED'];
export type ScreeningStatus = 'NEGATIVE' | 'POSITIVE' | 'UNKNOWN';
export const SCREENING_STATUSES: ScreeningStatus[] = ['NEGATIVE', 'POSITIVE', 'UNKNOWN'];
export type Presentation = 'CEPHALIC' | 'BREECH' | 'TRANSVERSE' | 'UNKNOWN';
export const PRESENTATIONS: Presentation[] = ['CEPHALIC', 'BREECH', 'TRANSVERSE', 'UNKNOWN'];
export type DipstickResult = 'NEG' | 'TRACE' | '+' | '++' | '+++';
export const DIPSTICK_RESULTS: DipstickResult[] = ['NEG', 'TRACE', '+', '++', '+++'];
export const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];
export const RISK_FACTORS = [
  'AGE_UNDER_18',
  'AGE_OVER_35',
  'GRAND_MULTIPARA',
  'PREVIOUS_CESAREAN',
  'HYPERTENSION',
  'DIABETES',
  'SICKLE_CELL',
  'HIV',
  'MULTIPLE_PREGNANCY',
  'PREVIOUS_STILLBIRTH',
  'OTHER',
] as const;

export interface GestationalAge {
  weeks: number;
  days: number;
}

export interface PregnancySummary {
  id: string;
  status: PregnancyCareStatus;
  edd: string;
  gestationalAge: GestationalAge | null;
  visitsCount: number;
  outcome: PregnancyOutcome | null;
  openedOn: string;
  closedOn: string | null;
}

export interface AntenatalVisit {
  id: string;
  pregnancyId: string;
  visitDate: string;
  contactNumber: number;
  gestationalAgeDays: number;
  weightKg: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  fundalHeightCm: number | null;
  fetalHeartRate: number | null;
  presentation: Presentation | null;
  fetalMovements: boolean | null;
  oedema: boolean | null;
  urineProtein: DipstickResult | null;
  urineGlucose: DipstickResult | null;
  hemoglobin: number | null;
  iptpDose: number | null;
  tdDose: number | null;
  ironFolate: boolean | null;
  llin: boolean | null;
  deworming: boolean | null;
  complaints: string | null;
  plan: string | null;
  nextVisitDate: string | null;
  recordedById: string;
  createdAt: string;
  alerts: string[];
}

export interface PregnancyDetail {
  id: string;
  status: PregnancyCareStatus;
  lmp: string | null;
  eddByUltrasound: string | null;
  edd: string;
  gravida: number;
  para: number;
  abortions: number;
  livingChildren: number;
  previousCesarean: boolean;
  bloodGroup: string | null;
  hivStatus: ScreeningStatus | null;
  syphilisStatus: ScreeningStatus | null;
  riskFactors: string[];
  notes: string | null;
  openedOn: string;
  closedOn: string | null;
  outcome: PregnancyOutcome | null;
  deliveryDate: string | null;
  deliveryMode: DeliveryMode | null;
  babyPatientId: string | null;
  patient: { id: string; patientId: string; firstName: string; lastName: string; dateOfBirth: string; age: number };
  gestationalAge: GestationalAge | null;
  trimester: number | null;
  visits: AntenatalVisit[];
  nextContact: { number: number; targetWeek: number; targetDate: string } | null;
  iptpDosesGiven: number;
  iptpDue: boolean;
  tdDosesGiven: number;
  alerts: string[];
  overdue: boolean;
}

export interface PregnancyInput {
  lmp?: string;
  eddByUltrasound?: string;
  gravida: number;
  para: number;
  abortions?: number;
  livingChildren?: number;
  previousCesarean?: boolean;
  bloodGroup?: string;
  hivStatus?: ScreeningStatus;
  syphilisStatus?: ScreeningStatus;
  riskFactors?: string[];
  notes?: string;
}

export interface PregnancyClose {
  status: Exclude<PregnancyCareStatus, 'ONGOING'>;
  outcome: PregnancyOutcome;
  closedOn: string;
  deliveryDate?: string;
  deliveryMode?: DeliveryMode;
  babyPatientId?: string;
}

export type PregnancyPatch = Partial<PregnancyInput> | PregnancyClose;

export type AntenatalVisitInput = Partial<Omit<AntenatalVisit, 'id' | 'pregnancyId' | 'contactNumber' | 'gestationalAgeDays' | 'recordedById' | 'createdAt' | 'alerts'>>;

export interface CaseloadItem {
  pregnancyId: string;
  patient: { id: string; patientId: string; firstName: string; lastName: string; dateOfBirth: string; phoneNumber?: string | null };
  gestationalAge: GestationalAge | null;
  edd: string;
  lastVisitDate: string | null;
  nextContact: { number: number; targetWeek: number; targetDate: string } | null;
  alerts: string[];
  overdue: boolean;
}

export type CaseloadFilter = 'all' | 'overdue' | 'alerts' | 'due-soon';

/** "24+3" (weeks + days of amenorrhoea) */
export function formatGA(ga: GestationalAge | null | undefined): string {
  if (!ga) return '—';
  return `${ga.weeks}+${ga.days}`;
}

export function gaFromDays(days: number): GestationalAge {
  const d = Math.max(0, Math.round(days));
  return { weeks: Math.floor(d / 7), days: d % 7 };
}

/** Alerts that call for action today */
export const SEVERE_ANC_ALERTS = new Set(['SEVERE_HYPERTENSION', 'PREECLAMPSIA_SIGNS', 'SEVERE_ANAEMIA', 'FHR_ABNORMAL', 'NO_FETAL_MOVEMENT', 'POST_TERM']);

export const ancAlertStyle = (code: string) => SEVERITY_STYLE[SEVERE_ANC_ALERTS.has(code) ? 'severe' : 'moderate'];

/** Alerts computed from a visit (HYPERTENSION is also a chronic risk factor: context decides) */
export const ANC_ALERTS = new Set([
  'HYPERTENSION',
  'SEVERE_HYPERTENSION',
  'PREECLAMPSIA_SIGNS',
  'ANAEMIA',
  'SEVERE_ANAEMIA',
  'FUNDAL_HEIGHT_DISCREPANCY',
  'FHR_ABNORMAL',
  'NO_FETAL_MOVEMENT',
  'MALPRESENTATION',
  'GLYCOSURIA',
  'POST_TERM',
]);

/** Label key of a code shown as a visit alert (default) or as a risk factor */
export function alertKey(code: string, kind: 'alert' | 'risk' = 'alert'): string {
  if (kind === 'risk' && (RISK_FACTORS as readonly string[]).includes(code)) return `mc.risk.${code}`;
  if (ANC_ALERTS.has(code)) return `mc.anc.alert.${code}`;
  return (RISK_FACTORS as readonly string[]).includes(code) ? `mc.risk.${code}` : `mc.anc.alert.${code}`;
}

/** A pregnancy's alert list mixes visit alerts and risk factors: split them for display */
export function splitPregnancyAlerts(alerts: string[], riskFactors: string[]): { alerts: string[]; risks: string[] } {
  return {
    alerts: alerts.filter((a) => ANC_ALERTS.has(a)),
    risks: [...new Set([...riskFactors, ...alerts.filter((a) => !ANC_ALERTS.has(a))])],
  };
}

// ---------- Which sections a record shows ----------

export function showVaccination(dateOfBirth: string, today = new Date()): boolean {
  const age = ageOn(dateOfBirth, today);
  return age !== null && age < 15;
}

export function showGrowth(dateOfBirth: string, today = new Date()): boolean {
  const age = ageOn(dateOfBirth, today);
  return age !== null && age < 19;
}

export function showPregnancy(gender: string | null | undefined, dateOfBirth: string, today = new Date()): boolean {
  const age = ageOn(dateOfBirth, today);
  return sexCode(gender) === 'F' && age !== null && age >= 10 && age <= 55;
}

/** Local YYYY-MM-DD */
export function todayString(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Optional numeric field from a form input ('' → undefined; French comma accepted) */
export function numOrUndef(value: string): number | undefined {
  const v = value.trim().replace(',', '.');
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
