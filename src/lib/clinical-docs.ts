import { addDiagnosis, type DiagnosisEntry } from '@/lib/clinical-safety';

// Clinical documentation: consultation templates, attachments on the record, problem list
// (types match scratchpad/clinical-docs-api-contract.md)

// ---------- templates ----------

export type TemplateScope = 'PERSONAL' | 'SHARED';

/** A prescription line as stored in a template (no stock item: matched to the formulary on use) */
export interface TemplatePrescriptionLine {
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string | null;
  instructions?: string | null;
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  specialty: string | null;
  scope: TemplateScope;
  owner: { id: string; name: string };
  usageCount: number;
  lastUsedAt: string | null;
  diagnosisCodes: string[];
  updatedAt: string;
}

export interface ConsultationTemplate extends TemplateSummary {
  departmentId: string | null;
  active: boolean;
  chiefComplaint: string | null;
  symptoms: string[];
  examination: string | null;
  diagnosis: string[];
  treatmentPlan: string | null;
  notes: string | null;
  labTestIds: string[];
  prescriptionLines: TemplatePrescriptionLine[];
  followUpDays: number | null;
  createdAt: string;
  labTests: Array<{ id: string; code: string; name: string }>;
  diagnoses: Array<{ code: string; label: string }>;
}

export interface TemplateInput {
  name: string;
  description?: string | null;
  specialty?: string | null;
  scope: TemplateScope;
  chiefComplaint?: string | null;
  symptoms?: string[];
  examination?: string | null;
  diagnosis?: string[];
  diagnosisCodes?: string[];
  treatmentPlan?: string | null;
  notes?: string | null;
  labTestIds?: string[];
  prescriptionLines?: TemplatePrescriptionLine[];
  followUpDays?: number | null;
}

/** The consultation form fields a template fills */
export interface TemplateMergeTarget {
  chiefComplaint: string;
  symptoms: string[];
  examination: string;
  diagnoses: DiagnosisEntry[];
  treatmentPlan: string;
  notes: string;
  followUpDate: string;
}

export interface TemplateSuggestions {
  prescriptionLines: TemplatePrescriptionLine[];
  labTests: Array<{ id: string; code: string; name: string }>;
}

/**
 * Template text never replaces what the doctor typed: an empty field is filled, a filled one gets
 * the template text on a new line (unless it already contains it, e.g. the same template twice).
 */
export function appendText(current: string, addition: string | null | undefined): string {
  const add = (addition ?? '').trim();
  if (!add) return current;
  if (!current.trim()) return add;
  if (current.includes(add)) return current;
  return `${current.replace(/\s+$/, '')}\n${add}`;
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Merge a template into the form. Orders are returned as suggestions, never added directly. */
export function mergeTemplate(
  form: TemplateMergeTarget,
  template: Pick<ConsultationTemplate, 'chiefComplaint' | 'symptoms' | 'examination' | 'diagnosis' | 'diagnoses' | 'treatmentPlan' | 'notes' | 'followUpDays' | 'prescriptionLines' | 'labTests'>,
  today: string
): { form: TemplateMergeTarget; suggestions: TemplateSuggestions } {
  let diagnoses = form.diagnoses;
  const codedLabels = new Set<string>();
  for (const d of template.diagnoses ?? []) {
    diagnoses = addDiagnosis(diagnoses, { code: d.code, label: d.label });
    codedLabels.add(d.label.trim().toLowerCase());
  }
  // Free-text diagnoses of the template that are not the label of one of its codes
  for (const label of template.diagnosis ?? []) {
    if (!codedLabels.has(label.trim().toLowerCase())) diagnoses = addDiagnosis(diagnoses, { code: null, label });
  }
  const symptoms = [...form.symptoms];
  for (const s of template.symptoms ?? []) {
    const v = s.trim();
    if (v && !symptoms.some((x) => x.toLowerCase() === v.toLowerCase())) symptoms.push(v);
  }
  return {
    form: {
      chiefComplaint: appendText(form.chiefComplaint, template.chiefComplaint),
      symptoms,
      examination: appendText(form.examination, template.examination),
      diagnoses,
      treatmentPlan: appendText(form.treatmentPlan, template.treatmentPlan),
      notes: appendText(form.notes, template.notes),
      followUpDate: form.followUpDate || (template.followUpDays && template.followUpDays > 0 ? addDays(today, template.followUpDays) : ''),
    },
    suggestions: { prescriptionLines: template.prescriptionLines ?? [], labTests: template.labTests ?? [] },
  };
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** The formulary item a template line names: exact name first, then the closest prefix match */
export function matchMedication<T extends { id: string; name: string }>(medicationName: string, medications: T[]): T | null {
  const wanted = normalize(medicationName);
  if (!wanted) return null;
  const exact = medications.find((m) => normalize(m.name) === wanted);
  if (exact) return exact;
  const prefix = medications.filter((m) => {
    const name = normalize(m.name);
    return name.startsWith(wanted) || wanted.startsWith(name);
  });
  return prefix.length === 1 ? prefix[0] : null;
}

/** Own templates first, then by use (most used, most recent) */
export function sortTemplates(list: TemplateSummary[], userId: string | undefined): TemplateSummary[] {
  return [...list].sort((a, b) => {
    const own = Number(b.owner.id === userId) - Number(a.owner.id === userId);
    if (own) return own;
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') || a.name.localeCompare(b.name, 'fr');
  });
}

export function filterTemplates(list: TemplateSummary[], query: string): TemplateSummary[] {
  const q = normalize(query);
  if (!q) return list;
  return list.filter((tpl) =>
    [tpl.name, tpl.description ?? '', tpl.specialty ?? '', ...tpl.diagnosisCodes].some((field) => normalize(field).includes(q))
  );
}

// ---------- attachments ----------

export const ATTACHMENT_CATEGORIES = ['REFERRAL_LETTER', 'OUTSIDE_RESULT', 'IMAGE', 'CONSENT_FORM', 'ID_DOCUMENT', 'OTHER'] as const;
export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

export interface ClinicalAttachment {
  id: string;
  category: AttachmentCategory;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  documentDate: string | null;
  visibleToPatient: boolean;
  consultationId: string | null;
  admissionId: string | null;
  uploadedBy: { id: string; name: string; role: string };
  createdAt: string;
  url: string;
}

export interface AttachmentUpload {
  category: AttachmentCategory;
  title: string;
  documentDate?: string;
  visibleToPatient?: boolean;
  consultationId?: string;
  admissionId?: string;
}

export interface AttachmentPatch {
  title?: string;
  category?: AttachmentCategory;
  documentDate?: string | null;
  visibleToPatient?: boolean;
}

export const ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Client-side check before uploading (the server checks the bytes too) */
export function attachmentFileProblem(file: { type: string; size: number }, maxBytes = ATTACHMENT_MAX_BYTES): 'cdoc.att.badType' | 'cdoc.att.tooLarge' | 'cdoc.att.empty' | null {
  if (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) return 'cdoc.att.badType';
  if (file.size <= 0) return 'cdoc.att.empty';
  if (file.size > maxBytes) return 'cdoc.att.tooLarge';
  return null;
}

export const isImageAttachment = (mimeType: string) => mimeType === 'image/jpeg' || mimeType === 'image/png';

/** Title proposed from a file name: "lettre_dr-x.pdf" → "lettre dr-x" */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
}

/** Categories a role may file (the API enforces the same) */
export function uploadCategoriesFor(role: string | undefined): AttachmentCategory[] {
  if (role === 'DOCTOR' || role === 'NURSE' || role === 'ADMIN') return [...ATTACHMENT_CATEGORIES];
  if (role === 'RECEPTIONIST') return ['ID_DOCUMENT', 'REFERRAL_LETTER', 'CONSENT_FORM'];
  if (role === 'PATIENT') return ['OUTSIDE_RESULT', 'REFERRAL_LETTER'];
  return [];
}

export const ATTACHMENT_CATEGORY_STYLE: Record<AttachmentCategory, string> = {
  REFERRAL_LETTER: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800',
  OUTSIDE_RESULT: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800',
  IMAGE: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-800',
  CONSENT_FORM: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800',
  ID_DOCUMENT: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600',
  OTHER: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
};

// ---------- problem list ----------

export type ProblemStatus = 'active' | 'chronic' | 'resolved';

export interface Problem {
  id: string;
  condition: string;
  icd10Code: string | null;
  status: ProblemStatus;
  onsetDate: string | null;
  resolvedAt: string | null;
  notes: string | null;
  recordedBy: { id: string; name: string } | null;
  sourceConsultationId: string | null;
  createdAt: string;
}

export interface ProblemInput {
  condition?: string;
  icd10Code?: string | null;
  status: ProblemStatus;
  onsetDate?: string;
  notes?: string;
  sourceConsultationId?: string;
}

export interface ProblemPatch {
  status?: ProblemStatus;
  resolvedAt?: string | null;
  notes?: string | null;
  onsetDate?: string | null;
}

/** Active and chronic problems first, then resolved; most recent first within each */
export function sortProblems(problems: Problem[]): Problem[] {
  const rank = (p: Problem) => (p.status === 'resolved' ? 1 : 0);
  const when = (p: Problem) => p.onsetDate ?? p.createdAt ?? '';
  return [...problems].sort((a, b) => rank(a) - rank(b) || when(b).localeCompare(when(a)) || a.condition.localeCompare(b.condition, 'fr'));
}

/** Coded diagnoses of the consultation not yet on the problem list (active or chronic) */
export function diagnosesNotOnProblemList(diagnoses: DiagnosisEntry[], problems: Problem[]): DiagnosisEntry[] {
  const open = new Set(problems.filter((p) => p.status !== 'resolved' && p.icd10Code).map((p) => p.icd10Code));
  return diagnoses.filter((d) => d.code && !open.has(d.code));
}

export const PROBLEM_STATUS_STYLE: Record<ProblemStatus, string> = {
  active: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800',
  chronic: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-800',
  resolved: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
};

/** List endpoints answer `{ data: [...] }`; accept a bare array too */
export function listOf<T>(value: T[] | { data?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value?.data ?? [];
}

// ---------- template editor ----------

export interface TemplateFormState {
  name: string;
  description: string;
  specialty: string;
  scope: TemplateScope;
  chiefComplaint: string;
  symptomsText: string;
  examination: string;
  diagnoses: DiagnosisEntry[];
  treatmentPlan: string;
  notes: string;
  followUpDays: string;
  labTestIds: string[];
  prescriptionLines: TemplatePrescriptionLine[];
}

export function emptyTemplateForm(): TemplateFormState {
  return {
    name: '',
    description: '',
    specialty: '',
    scope: 'PERSONAL',
    chiefComplaint: '',
    symptomsText: '',
    examination: '',
    diagnoses: [],
    treatmentPlan: '',
    notes: '',
    followUpDays: '',
    labTestIds: [],
    prescriptionLines: [],
  };
}

export function templateFormFrom(tpl: ConsultationTemplate): TemplateFormState {
  const coded = (tpl.diagnoses ?? []).map((d) => ({ code: d.code, label: d.label }));
  const codedLabels = new Set(coded.map((d) => d.label.trim().toLowerCase()));
  const uncoded = (tpl.diagnosis ?? []).filter((l) => !codedLabels.has(l.trim().toLowerCase())).map((label) => ({ code: null, label }));
  return {
    name: tpl.name,
    description: tpl.description ?? '',
    specialty: tpl.specialty ?? '',
    scope: tpl.scope,
    chiefComplaint: tpl.chiefComplaint ?? '',
    symptomsText: (tpl.symptoms ?? []).join('\n'),
    examination: tpl.examination ?? '',
    diagnoses: [...coded, ...uncoded],
    treatmentPlan: tpl.treatmentPlan ?? '',
    notes: tpl.notes ?? '',
    followUpDays: tpl.followUpDays ? String(tpl.followUpDays) : '',
    labTestIds: tpl.labTestIds ?? (tpl.labTests ?? []).map((l) => l.id),
    prescriptionLines: (tpl.prescriptionLines ?? []).map((l) => ({ ...l })),
  };
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

/** Editor state → API body: empty text becomes null, blank prescription lines are dropped */
export function templateFormToInput(f: TemplateFormState): TemplateInput {
  const days = parseInt(f.followUpDays, 10);
  return {
    name: f.name.trim(),
    description: orNull(f.description),
    specialty: orNull(f.specialty),
    scope: f.scope,
    chiefComplaint: orNull(f.chiefComplaint),
    symptoms: f.symptomsText.split('\n').map((s) => s.trim()).filter(Boolean),
    examination: orNull(f.examination),
    diagnosis: f.diagnoses.map((d) => d.label.trim()).filter(Boolean),
    diagnosisCodes: f.diagnoses.map((d) => d.code).filter((c): c is string => Boolean(c)),
    treatmentPlan: orNull(f.treatmentPlan),
    notes: orNull(f.notes),
    labTestIds: [...new Set(f.labTestIds)],
    prescriptionLines: f.prescriptionLines
      .filter((l) => l.medicationName.trim())
      .map((l) => ({
        medicationName: l.medicationName.trim(),
        dosage: l.dosage.trim(),
        frequency: l.frequency.trim(),
        duration: l.duration.trim(),
        ...(l.route?.trim() ? { route: l.route.trim() } : {}),
        ...(l.instructions?.trim() ? { instructions: l.instructions.trim() } : {}),
      })),
    followUpDays: Number.isFinite(days) && days > 0 ? days : null,
  };
}
