// Official monthly statistics (rapport mensuel d'activités, DHIS2): types and display helpers.
// Labels inside the report come from the backend in French (it is an official document).

import type { PersonRef } from '@/lib/cash-desk';

export type AgeBand = '0-11m' | '1-4' | '5-14' | '15-24' | '25-59' | '60+';
export const AGE_BANDS: AgeBand[] = ['0-11m', '1-4', '5-14', '15-24', '25-59', '60+'];
export type Sex = 'M' | 'F';
export const SEXES: Sex[] = ['M', 'F'];

export type MonthlyReportStatus = 'DRAFT' | 'VALIDATED' | 'SUBMITTED';
export type MonthlyReportListStatus = MonthlyReportStatus | 'FUTURE';

/** Row split by sex and age band: all 12 cells are always present */
export interface DisaggregatedRow {
  key: string;
  label: string;
  total: number;
  bySexAge: Record<string, number>;
}

export interface SimpleRow {
  key: string;
  label: string;
  value: number;
  unit?: '%' | 'jours' | 'FCFA' | null;
}

export type ReportRow = DisaggregatedRow | SimpleRow;

export interface MdoAlert {
  disease: string;
  date: string;
  age: number | null;
  sex: string | null;
  city: string | null;
  source: 'CONSULTATION' | 'ADMISSION';
  patientRef: string;
}

export interface WardStat {
  ward: string;
  admissions: number;
  patientDays: number;
  beds: number;
  occupancyRate: number;
}

export interface TracerStat {
  medication: string;
  opening: number;
  received: number;
  consumed: number;
  closing: number;
  stockOutDays: number;
}

export interface ReportSection {
  key: string;
  title: string;
  rows: ReportRow[];
  byDepartment?: Array<{ department: string; count: number }>;
  alerts?: MdoAlert[];
  byWard?: WardStat[];
  byTest?: Array<{ test: string; count: number }>;
  byModality?: Array<{ modality: string; count: number }>;
  tracers?: TracerStat[];
  doctorsBySpecialty?: Array<{ specialty: string; count: number }>;
}

export interface FacilityIdentity {
  facilityName: string;
  category: string | null;
  region: string | null;
  healthDistrict: string | null;
  healthArea: string | null;
  dhis2OrgUnit: string | null;
}

export interface MonthlyReportData {
  period: string;
  label: string;
  facility: FacilityIdentity;
  generatedAt: string;
  sections: ReportSection[];
}

export interface MonthlyReportSummary {
  period: string;
  label: string;
  status: MonthlyReportListStatus;
  validatedAt: string | null;
  submittedAt: string | null;
  validatedBy: PersonRef | null;
}

export interface ReportChange {
  key: string;
  label: string;
  frozen: number | null;
  live: number | null;
}

export interface MonthlyReportDetail {
  period: string;
  status: MonthlyReportStatus;
  report: MonthlyReportData;
  notes: string | null;
  validatedBy: PersonRef | null;
  validatedAt: string | null;
  submittedBy: PersonRef | null;
  submittedAt: string | null;
  submissionRef: string | null;
  changedSinceValidation: ReportChange[];
}

export interface IndicatorDef {
  key: string;
  label: string;
  section: string;
  disaggregated: boolean;
}

export interface Dhis2Target {
  dataElement: string;
  categoryOptionCombo?: string;
}

export type Dhis2Mapping = Record<string, Dhis2Target>;

export interface FacilitySettings extends FacilityIdentity {
  dhis2Mapping: Dhis2Mapping | null;
  updatedAt?: string;
}

export interface FacilitySettingsInput {
  facilityName: string;
  category?: string | null;
  region?: string | null;
  healthDistrict?: string | null;
  healthArea?: string | null;
  dhis2OrgUnit?: string | null;
  mappingCsv?: string;
}

export const STATUS_STYLE: Record<MonthlyReportListStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  VALIDATED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  SUBMITTED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  FUTURE: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

export function isDisaggregated(row: ReportRow): row is DisaggregatedRow {
  return 'bySexAge' in row;
}

export const cellKey = (sex: Sex, band: AgeBand) => `${sex}|${band}`;

/** Total for one sex across age bands */
export function sexTotal(row: DisaggregatedRow, sex: Sex): number {
  return AGE_BANDS.reduce((sum, band) => sum + (row.bySexAge[cellKey(sex, band)] ?? 0), 0);
}

/** Flat values with the backend's keys: `cons.total`, `cons.total|M|0-11m`, ... and simple rows key → value */
export function flattenReport(report: MonthlyReportData): Record<string, number> {
  const flat: Record<string, number> = {};
  for (const section of report.sections) {
    for (const row of section.rows) {
      if (isDisaggregated(row)) {
        flat[row.key] = row.total;
        for (const sex of SEXES) for (const band of AGE_BANDS) flat[`${row.key}|${sex}|${band}`] = row.bySexAge[cellKey(sex, band)] ?? 0;
      } else {
        flat[row.key] = row.value;
      }
    }
  }
  return flat;
}

/** Mapping as editable CSV lines: key,dataElement,categoryOptionCombo */
export function mappingToCsv(mapping: Dhis2Mapping | null): string {
  if (!mapping) return '';
  return Object.entries(mapping)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, target]) => [key, target.dataElement, target.categoryOptionCombo ?? ''].join(',').replace(/,$/, ''))
    .join('\n');
}

/** Keys mapped by CSV text (for the live count before saving); the backend validates the UIDs */
// Same parsing as the backend: comma, semicolon or tab; '#' comments; optional header; last line wins per key
export function csvMappedKeys(csv: string): string[] {
  const keys = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/[,;\t]/)[0].trim().replace(/^"|"$/g, ''))
    .filter((key) => key && !/^key$/i.test(key) && !/^indicat/i.test(key));
  return [...new Set(keys)];
}

/** The month is over (it can be validated) once the next month has started */
export function monthIsOver(period: string, now: Date = new Date()): boolean {
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return period < current;
}

/** "2026-10" → "rapport-mensuel-2026-10-dhis2.json" */
export const dhis2FileName = (period: string, format: 'json' | 'csv') => `rapport-mensuel-${period}-dhis2.${format}`;

/** Years offered in the selector: this year and the four before */
export function selectableYears(now: Date = new Date()): number[] {
  const year = now.getFullYear();
  return [0, 1, 2, 3, 4].map((n) => year - n);
}

/** Display of a simple indicator value with its unit */
export function formatIndicator(row: SimpleRow, formatNumber: (n: number) => string, daysSuffix = 'j', daySuffix = daysSuffix): string {
  if (row.unit === '%') return `${formatNumber(row.value)} %`;
  // French: singular below 2 ("1 jour", "1,5 jour")
  if (row.unit === 'jours') return `${formatNumber(row.value)} ${row.value < 2 ? daySuffix : daysSuffix}`;
  if (row.unit === 'FCFA') return `${formatNumber(row.value)} FCFA`;
  return formatNumber(row.value);
}
