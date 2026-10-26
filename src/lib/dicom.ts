/**
 * DICOM studies attached to imaging orders: the DICOMweb-style JSON the API returns, the image ids
 * Cornerstone loads, window/level presets and the viewport corner texts. Pure helpers (no Cornerstone
 * import) so they can be unit-tested and used by server-rendered pages.
 */

// ---------- DICOM JSON model ----------

/** One attribute of the DICOM JSON model (PS3.18 F.2): { vr, Value } */
export interface DicomJsonAttribute {
  vr?: string;
  Value?: unknown[];
  BulkDataURI?: string;
  InlineBinary?: string;
}
export type DicomJsonObject = Record<string, DicomJsonAttribute | undefined>;

export const TAG = {
  StudyInstanceUID: '0020000D',
  SeriesInstanceUID: '0020000E',
  SOPInstanceUID: '00080018',
  SOPClassUID: '00080016',
  InstanceNumber: '00200013',
  SeriesNumber: '00200011',
  Rows: '00280010',
  Columns: '00280011',
  NumberOfFrames: '00280008',
  Modality: '00080060',
  SeriesDescription: '0008103E',
  StudyDescription: '00081030',
  StudyDate: '00080020',
  AccessionNumber: '00080050',
  BodyPartExamined: '00180015',
  PatientName: '00100010',
  PatientID: '00100020',
  NumberOfSeriesRelatedInstances: '00201209',
  NumberOfStudyRelatedSeries: '00201206',
  NumberOfStudyRelatedInstances: '00201208',
} as const;

/** First value of a tag as text; person names give their alphabetic form ("DOE^JOHN") */
export function tagString(obj: DicomJsonObject | null | undefined, tag: string): string | null {
  const value = obj?.[tag]?.Value?.[0];
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') {
    const pn = value as { Alphabetic?: string };
    return pn.Alphabetic ?? null;
  }
  return String(value);
}

export function tagNumber(obj: DicomJsonObject | null | undefined, tag: string): number | null {
  const raw = obj?.[tag]?.Value?.[0];
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** "DUPONT^MARIE^^^" → "MARIE DUPONT" */
export function formatPersonName(pn: string | null | undefined): string {
  if (!pn) return '';
  const [family = '', given = ''] = pn.split('^');
  return [given, family].map((p) => p.trim()).filter(Boolean).join(' ');
}

/** "20260115" → "2026-01-15" (null when not a DICOM DA) */
export function dicomDateToIso(da: string | null | undefined): string | null {
  if (!da) return null;
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(da.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// ---------- studies, series, instances ----------

export type DicomIdentityCheck = 'MATCH' | 'MISMATCH' | 'UNKNOWN';

export interface DicomStudySummary {
  id: string;
  studyInstanceUid: string;
  imagingOrderId: string | null;
  accessionNumber: string | null;
  studyDate: string | null;
  modality: string | null;
  description: string | null;
  patientNameInFile: string | null;
  patientIdInFile: string | null;
  numberOfSeries: number;
  numberOfInstances: number;
  identityCheck: DicomIdentityCheck;
  /** MISMATCH studies need a radiologist's confirmation before the report can be signed */
  identityConfirmed: boolean;
  identityConfirmedAt: string | null;
  identityConfirmedBy: { id: string; name: string } | null;
  receivedVia: 'UPLOAD' | 'STOW' | string;
  createdAt: string | null;
  /** Present when the API embeds them (exam endpoint) */
  series: DicomSeriesSummary[];
}

export interface DicomSeriesSummary {
  seriesInstanceUid: string;
  seriesNumber: number | null;
  modality: string | null;
  description: string | null;
  bodyPart: string | null;
  numberOfInstances: number;
}

export interface DicomInstanceSummary {
  sopInstanceUid: string;
  instanceNumber: number | null;
  rows: number | null;
  columns: number | null;
  numberOfFrames: number;
}

type Loose = Record<string, unknown>;
const str = (v: unknown): string | null => (v === undefined || v === null || v === '' ? null : String(v));
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** A study row from the API: our camelCase summary, or a QIDO DICOM JSON object */
export function toStudySummary(raw: unknown): DicomStudySummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Loose;
  if (TAG.StudyInstanceUID in o) {
    const d = o as DicomJsonObject;
    const uid = tagString(d, TAG.StudyInstanceUID);
    if (!uid) return null;
    return {
      id: str(o.id) ?? uid,
      studyInstanceUid: uid,
      imagingOrderId: str(o.imagingOrderId),
      accessionNumber: tagString(d, TAG.AccessionNumber),
      studyDate: dicomDateToIso(tagString(d, TAG.StudyDate)),
      modality: tagString(d, TAG.Modality),
      description: tagString(d, TAG.StudyDescription),
      patientNameInFile: tagString(d, TAG.PatientName),
      patientIdInFile: tagString(d, TAG.PatientID),
      numberOfSeries: tagNumber(d, TAG.NumberOfStudyRelatedSeries) ?? 0,
      numberOfInstances: tagNumber(d, TAG.NumberOfStudyRelatedInstances) ?? 0,
      identityCheck: (str(o.identityCheck) as DicomIdentityCheck) ?? 'UNKNOWN',
      identityConfirmed: o.identityConfirmed === undefined ? true : Boolean(o.identityConfirmed),
      identityConfirmedAt: str(o.identityConfirmedAt),
      identityConfirmedBy: (o.identityConfirmedBy as DicomStudySummary['identityConfirmedBy']) ?? null,
      receivedVia: str(o.receivedVia) ?? 'UPLOAD',
      createdAt: str(o.createdAt),
      series: [],
    };
  }
  const uid = str(o.studyInstanceUid);
  if (!uid) return null;
  return {
    id: str(o.id) ?? uid,
    studyInstanceUid: uid,
    imagingOrderId: str(o.imagingOrderId),
    accessionNumber: str(o.accessionNumber),
    studyDate: str(o.studyDate)?.slice(0, 10) ?? null,
    modality: str(o.modality),
    description: str(o.description),
    patientNameInFile: str(o.patientNameInFile),
    patientIdInFile: str(o.patientIdInFile),
    numberOfSeries: num(o.numberOfSeries),
    numberOfInstances: num(o.numberOfInstances),
    identityCheck: ((str(o.identityCheck) ?? 'UNKNOWN') as DicomIdentityCheck),
    identityConfirmed:
      o.identityConfirmed === undefined ? str(o.identityCheck) !== 'MISMATCH' || Boolean(o.identityConfirmedAt) : Boolean(o.identityConfirmed),
    identityConfirmedAt: str(o.identityConfirmedAt),
    identityConfirmedBy: (o.identityConfirmedBy as DicomStudySummary['identityConfirmedBy']) ?? null,
    receivedVia: str(o.receivedVia) ?? 'UPLOAD',
    createdAt: str(o.createdAt),
    series: sortSeries(listOf(o.series).map(toSeriesSummary).filter((x): x is DicomSeriesSummary => Boolean(x))),
  };
}

export function toSeriesSummary(raw: unknown): DicomSeriesSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Loose;
  if (TAG.SeriesInstanceUID in o) {
    const d = o as DicomJsonObject;
    const uid = tagString(d, TAG.SeriesInstanceUID);
    if (!uid) return null;
    return {
      seriesInstanceUid: uid,
      seriesNumber: tagNumber(d, TAG.SeriesNumber),
      modality: tagString(d, TAG.Modality),
      description: tagString(d, TAG.SeriesDescription),
      bodyPart: tagString(d, TAG.BodyPartExamined),
      numberOfInstances: tagNumber(d, TAG.NumberOfSeriesRelatedInstances) ?? 0,
    };
  }
  const uid = str(o.seriesInstanceUid);
  if (!uid) return null;
  return {
    seriesInstanceUid: uid,
    seriesNumber: o.seriesNumber == null ? null : num(o.seriesNumber),
    modality: str(o.modality),
    description: str(o.description),
    bodyPart: str(o.bodyPart),
    numberOfInstances: num(o.numberOfInstances),
  };
}

export function toInstanceSummary(raw: unknown): DicomInstanceSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Loose;
  if (TAG.SOPInstanceUID in o) {
    const d = o as DicomJsonObject;
    const uid = tagString(d, TAG.SOPInstanceUID);
    if (!uid) return null;
    return {
      sopInstanceUid: uid,
      instanceNumber: tagNumber(d, TAG.InstanceNumber),
      rows: tagNumber(d, TAG.Rows),
      columns: tagNumber(d, TAG.Columns),
      numberOfFrames: Math.max(1, tagNumber(d, TAG.NumberOfFrames) ?? 1),
    };
  }
  const uid = str(o.sopInstanceUid);
  if (!uid) return null;
  return {
    sopInstanceUid: uid,
    instanceNumber: o.instanceNumber == null ? null : num(o.instanceNumber),
    rows: o.rows == null ? null : num(o.rows),
    columns: o.columns == null ? null : num(o.columns),
    numberOfFrames: Math.max(1, num(o.numberOfFrames, 1)),
  };
}

/** A list response: a bare array, { data: [...] } or { studies|series|instances: [...] } */
export function listOf(raw: unknown, key?: string): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = raw as Loose;
    if (key && Array.isArray(o[key])) return o[key] as unknown[];
    if (Array.isArray(o.data)) return o.data as unknown[];
  }
  return [];
}

export function sortSeries(series: DicomSeriesSummary[]): DicomSeriesSummary[] {
  return [...series].sort((a, b) => (a.seriesNumber ?? 9999) - (b.seriesNumber ?? 9999) || (a.description ?? '').localeCompare(b.description ?? ''));
}

export function sortInstances(instances: DicomInstanceSummary[]): DicomInstanceSummary[] {
  return [...instances].sort((a, b) => (a.instanceNumber ?? 0) - (b.instanceNumber ?? 0) || a.sopInstanceUid.localeCompare(b.sopInstanceUid));
}

// ---------- image ids ----------

/** WADO path of one Part-10 instance (relative to the API base) */
export function instancePath(studyUid: string, seriesUid: string, sopUid: string): string {
  const e = encodeURIComponent;
  return `/api/dicomweb/studies/${e(studyUid)}/series/${e(seriesUid)}/instances/${e(sopUid)}`;
}

/**
 * Cornerstone image ids for a series: one per instance, one per frame for multi-frame instances
 * (wadouri frames are 1-based: "?frame=1").
 */
export function buildImageIds(apiBase: string, studyUid: string, seriesUid: string, instances: DicomInstanceSummary[]): string[] {
  const base = apiBase.replace(/\/+$/, '');
  const ids: string[] = [];
  for (const inst of sortInstances(instances)) {
    const url = `${base}${instancePath(studyUid, seriesUid, inst.sopInstanceUid)}`;
    if (inst.numberOfFrames > 1) {
      for (let f = 1; f <= inst.numberOfFrames; f += 1) ids.push(`wadouri:${url}?frame=${f}`);
    } else {
      ids.push(`wadouri:${url}`);
    }
  }
  return ids;
}

/** A series with one multi-frame instance plays as a clip (cine) */
export function isMultiFrame(instances: DicomInstanceSummary[]): boolean {
  return instances.some((i) => i.numberOfFrames > 1);
}

// ---------- window / level ----------

export interface WindowPreset {
  key: string;
  /** Locale key for the label */
  labelKey: string;
  width: number;
  center: number;
}

/** CT presets (Hounsfield units) */
export const CT_PRESETS: WindowPreset[] = [
  { key: 'lung', labelKey: 'dicom.preset.lung', width: 1500, center: -600 },
  { key: 'mediastinum', labelKey: 'dicom.preset.mediastinum', width: 350, center: 50 },
  { key: 'bone', labelKey: 'dicom.preset.bone', width: 2000, center: 300 },
  { key: 'brain', labelKey: 'dicom.preset.brain', width: 80, center: 40 },
  { key: 'abdomen', labelKey: 'dicom.preset.abdomen', width: 400, center: 50 },
];

export function presetsFor(modality: string | null | undefined): WindowPreset[] {
  return modality?.toUpperCase() === 'CT' ? CT_PRESETS : [];
}

/** Width/center ↔ the VOI range Cornerstone uses */
export function windowToVoiRange(width: number, center: number): { lower: number; upper: number } {
  return { lower: center - width / 2, upper: center + width / 2 };
}

export function voiRangeToWindow(range: { lower: number; upper: number }): { width: number; center: number } {
  return { width: range.upper - range.lower, center: (range.upper + range.lower) / 2 };
}

// ---------- overlay ----------

/** "AB" from "Achille Mendouga" — the overlay never shows full names (screens are often seen by others) */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .split(/[\s^]+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .join('')
    .slice(0, 3);
}

export interface OverlayInput {
  patientName: string | null;
  age: number | null;
  sex: string | null;
  studyDate: string | null;
  seriesDescription: string | null;
  modality: string | null;
  window: { width: number; center: number } | null;
  zoom: number | null;
  index: number;
  total: number;
}

export interface OverlayText {
  topLeft: string[];
  topRight: string[];
  bottomLeft: string[];
  bottomRight: string[];
}

const SEX_SHORT: Record<string, string> = { MALE: 'M', FEMALE: 'F', M: 'M', F: 'F', OTHER: 'A', O: 'A' };

export function overlayText(o: OverlayInput, formatDate: (iso: string) => string): OverlayText {
  const who = [initialsOf(o.patientName), o.age != null ? `${o.age} a` : null, o.sex ? SEX_SHORT[o.sex.toUpperCase()] ?? null : null].filter(Boolean).join(' · ');
  return {
    topLeft: [who].filter(Boolean),
    topRight: [o.studyDate ? formatDate(o.studyDate) : null, [o.modality, o.seriesDescription].filter(Boolean).join(' · ') || null].filter((x): x is string => Boolean(x)),
    bottomLeft: o.window ? [`L ${Math.round(o.window.center)} · W ${Math.round(o.window.width)}`] : [],
    bottomRight: [o.zoom != null ? `${Math.round(o.zoom * 100)} %` : null, o.total > 0 ? `${o.index + 1}/${o.total}` : null].filter((x): x is string => Boolean(x)),
  };
}

// ---------- uploads ----------

export interface DicomUploadResult {
  study: DicomStudySummary | null;
  /** Several studies may come from one .zip */
  studies: DicomStudySummary[];
  stored: number;
  duplicates: number;
  rejected: Array<{ fileName: string; reason: string }>;
}

export function toUploadResult(raw: unknown): DicomUploadResult {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Loose;
  const studies = [
    ...(o.study ? [toStudySummary(o.study)] : []),
    ...listOf(o.studies).map(toStudySummary),
  ].filter((s): s is DicomStudySummary => Boolean(s));
  const unique = studies.filter((s, i) => studies.findIndex((x) => x.studyInstanceUid === s.studyInstanceUid) === i);
  const rejected = listOf(o.rejected)
    .map((r) => {
      const x = (r ?? {}) as Loose;
      return { fileName: str(x.fileName) ?? str(x.name) ?? '?', reason: str(x.reason) ?? str(x.error) ?? '' };
    });
  return { study: unique[0] ?? null, studies: unique, stored: num(o.stored), duplicates: num(o.duplicates), rejected };
}

export const DICOM_UPLOAD_ACCEPT = '.dcm,.dicom,.zip,application/dicom,application/zip';
export const DICOM_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const DICOM_MAX_ZIP_BYTES = 500 * 1024 * 1024;

/** Client-side pre-check (the server decides): extension and size */
export function dicomFileProblem(file: { name: string; size: number }): 'type' | 'size' | null {
  const name = file.name.toLowerCase();
  const isZip = name.endsWith('.zip');
  // Files from modalities often have no extension (e.g. "IM0001"): accept them, the server checks the DICM preamble
  const hasOtherExtension = /\.[a-z0-9]{2,4}$/.test(name) && !/\.(dcm|dicom|zip)$/.test(name);
  if (hasOtherExtension) return 'type';
  if (file.size > (isZip ? DICOM_MAX_ZIP_BYTES : DICOM_MAX_FILE_BYTES)) return 'size';
  return null;
}

/** Layout key → grid size */
export type ViewerLayout = '1x1' | '1x2' | '2x2';
export function layoutCells(layout: ViewerLayout): number {
  return layout === '1x1' ? 1 : layout === '1x2' ? 2 : 4;
}

/** Same person in the file and the record? Accent/case-insensitive comparison of name parts, for display */
export function foldName(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\^+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}
