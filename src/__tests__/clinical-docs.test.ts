import { describe, it, expect } from 'vitest';
import {
  appendText,
  attachmentFileProblem,
  diagnosesNotOnProblemList,
  emptyTemplateForm,
  filterTemplates,
  listOf,
  matchMedication,
  mergeTemplate,
  sortProblems,
  sortTemplates,
  templateFormFrom,
  templateFormToInput,
  titleFromFileName,
  uploadCategoriesFor,
  type ConsultationTemplate,
  type Problem,
  type TemplateMergeTarget,
  type TemplateSummary,
} from '@/lib/clinical-docs';
import { canAccessRoute } from '@/lib/rbac';

const emptyForm = (): TemplateMergeTarget => ({ chiefComplaint: '', symptoms: [], examination: '', diagnoses: [], treatmentPlan: '', notes: '', followUpDate: '' });

const template: ConsultationTemplate = {
  id: 'tpl-1',
  name: 'Paludisme simple (adulte)',
  description: null,
  specialty: 'Médecine générale',
  scope: 'SHARED',
  owner: { id: 'u-1', name: 'Dr Mbarga' },
  usageCount: 3,
  lastUsedAt: null,
  diagnosisCodes: ['B54'],
  updatedAt: '2026-10-26T00:00:00Z',
  departmentId: null,
  active: true,
  chiefComplaint: 'Fièvre depuis 48 h',
  symptoms: ['Fièvre', 'Céphalées'],
  examination: 'T° 38,9 °C, pas de signe de gravité',
  diagnosis: ['Paludisme, sans précision', 'Paludisme simple confirmé par TDR'],
  treatmentPlan: 'ACT 3 jours, paracétamol',
  notes: null,
  labTestIds: ['lab-tdr'],
  prescriptionLines: [{ medicationName: 'Coartem', dosage: '4 cp', frequency: '2 fois/jour', duration: '3 jours' }],
  followUpDays: 3,
  createdAt: '2026-10-01T00:00:00Z',
  labTests: [{ id: 'lab-tdr', code: 'TDR-PALU', name: 'TDR paludisme' }],
  diagnoses: [{ code: 'B54', label: 'Paludisme, sans précision' }],
};

describe('template merge', () => {
  it('fills empty fields and proposes orders without adding them', () => {
    const { form, suggestions } = mergeTemplate(emptyForm(), template, '2026-10-26');
    expect(form.chiefComplaint).toBe('Fièvre depuis 48 h');
    expect(form.symptoms).toEqual(['Fièvre', 'Céphalées']);
    expect(form.diagnoses).toEqual([
      { code: 'B54', label: 'Paludisme, sans précision' },
      { code: null, label: 'Paludisme simple confirmé par TDR' },
    ]);
    expect(form.followUpDate).toBe('2026-10-29');
    expect(suggestions.prescriptionLines).toHaveLength(1);
    expect(suggestions.labTests.map((l) => l.id)).toEqual(['lab-tdr']);
  });

  it('never overwrites what the doctor typed', () => {
    const typed = { ...emptyForm(), chiefComplaint: 'Fièvre et frissons', symptoms: ['fièvre'], followUpDate: '2026-11-02' };
    const { form } = mergeTemplate(typed, template, '2026-10-26');
    expect(form.chiefComplaint).toBe('Fièvre et frissons\nFièvre depuis 48 h');
    expect(form.symptoms).toEqual(['fièvre', 'Céphalées']); // same symptom, other case: kept once
    expect(form.followUpDate).toBe('2026-11-02');
  });

  it('applying the same template twice does not duplicate text or diagnoses', () => {
    const once = mergeTemplate(emptyForm(), template, '2026-10-26').form;
    const twice = mergeTemplate(once, template, '2026-10-26').form;
    expect(twice.examination).toBe(once.examination);
    expect(twice.diagnoses).toHaveLength(2);
  });

  it('appendText', () => {
    expect(appendText('', '  a ')).toBe('a');
    expect(appendText('x  ', 'y')).toBe('x\ny');
    expect(appendText('x', null)).toBe('x');
    expect(appendText('x\ny', 'y')).toBe('x\ny');
  });
});

describe('medication matching', () => {
  const meds = [
    { id: '1', name: 'Coartem 20/120' },
    { id: '2', name: 'Paracétamol 500 mg' },
    { id: '3', name: 'Paracétamol 1 g' },
    { id: '4', name: 'Amoxicilline' },
  ];
  it('matches exactly, ignoring case and accents', () => {
    expect(matchMedication('AMOXICILLINE', meds)?.id).toBe('4');
  });
  it('matches a unique prefix only', () => {
    expect(matchMedication('Coartem', meds)?.id).toBe('1');
    expect(matchMedication('Paracetamol', meds)).toBeNull(); // two products: the doctor chooses
    expect(matchMedication('Ibuprofène', meds)).toBeNull();
  });
});

describe('template lists', () => {
  const s = (id: string, owner: string, uses: number, extra: Partial<TemplateSummary> = {}): TemplateSummary => ({
    id,
    name: id,
    description: null,
    specialty: null,
    scope: 'SHARED',
    owner: { id: owner, name: owner },
    usageCount: uses,
    lastUsedAt: null,
    diagnosisCodes: [],
    updatedAt: '',
    ...extra,
  });
  it('own templates first, then the most used', () => {
    const sorted = sortTemplates([s('a', 'other', 50), s('b', 'me', 1), s('c', 'other', 9)], 'me');
    expect(sorted.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });
  it('searches name, specialty and ICD codes', () => {
    const list = [s('Suivi HTA', 'x', 0, { diagnosisCodes: ['I10'] }), s('Paludisme', 'x', 0, { specialty: 'Pédiatrie' })];
    expect(filterTemplates(list, 'i10').map((x) => x.id)).toEqual(['Suivi HTA']);
    expect(filterTemplates(list, 'pediatrie').map((x) => x.id)).toEqual(['Paludisme']);
    expect(filterTemplates(list, '')).toHaveLength(2);
  });
});

describe('template editor', () => {
  it('round-trips a template and cleans the body', () => {
    const form = templateFormFrom(template);
    expect(form.symptomsText).toBe('Fièvre\nCéphalées');
    expect(form.diagnoses).toHaveLength(2);
    const body = templateFormToInput({ ...form, prescriptionLines: [...form.prescriptionLines, { medicationName: '  ', dosage: '', frequency: '', duration: '' }] });
    expect(body.diagnosisCodes).toEqual(['B54']);
    expect(body.diagnosis).toEqual(['Paludisme, sans précision', 'Paludisme simple confirmé par TDR']);
    expect(body.prescriptionLines).toHaveLength(1);
    expect(body.followUpDays).toBe(3);
    expect(body.notes).toBeNull();
  });
  it('empty form → nulls and empty lists', () => {
    const body = templateFormToInput({ ...emptyTemplateForm(), name: ' Mon modèle ', followUpDays: '0' });
    expect(body.name).toBe('Mon modèle');
    expect(body.followUpDays).toBeNull();
    expect(body.symptoms).toEqual([]);
    expect(body.chiefComplaint).toBeNull();
  });
});

describe('attachments', () => {
  it('accepts JPEG, PNG and PDF up to 10 MB', () => {
    expect(attachmentFileProblem({ type: 'application/pdf', size: 1000 })).toBeNull();
    expect(attachmentFileProblem({ type: 'image/png', size: 10 * 1024 * 1024 })).toBeNull();
    expect(attachmentFileProblem({ type: 'image/png', size: 10 * 1024 * 1024 + 1 })).toBe('cdoc.att.tooLarge');
    expect(attachmentFileProblem({ type: 'image/gif', size: 10 })).toBe('cdoc.att.badType');
    expect(attachmentFileProblem({ type: 'application/pdf', size: 0 })).toBe('cdoc.att.empty');
  });
  it('limits what each role may file', () => {
    expect(uploadCategoriesFor('DOCTOR')).toContain('IMAGE');
    expect(uploadCategoriesFor('RECEPTIONIST')).toEqual(['ID_DOCUMENT', 'REFERRAL_LETTER', 'CONSENT_FORM']);
    expect(uploadCategoriesFor('PATIENT')).toEqual(['OUTSIDE_RESULT', 'REFERRAL_LETTER']);
    expect(uploadCategoriesFor('PHARMACIST')).toEqual([]);
  });
  it('proposes a title from the file name', () => {
    expect(titleFromFileName('lettre_dr_fouda.pdf')).toBe('lettre dr fouda');
  });
  it('reads list envelopes', () => {
    expect(listOf({ data: [1, 2] })).toEqual([1, 2]);
    expect(listOf([3])).toEqual([3]);
    expect(listOf(undefined)).toEqual([]);
  });
});

describe('problem list', () => {
  const p = (id: string, status: Problem['status'], onsetDate: string | null, icd10Code: string | null = null): Problem => ({
    id,
    condition: id,
    icd10Code,
    status,
    onsetDate,
    resolvedAt: null,
    notes: null,
    recordedBy: null,
    sourceConsultationId: null,
    createdAt: '2026-01-01T00:00:00Z',
  });
  it('active and chronic first, most recent first', () => {
    const sorted = sortProblems([p('old-resolved', 'resolved', '2026-05-01'), p('hta', 'chronic', '2019-01-01'), p('palu', 'active', '2026-10-20')]);
    expect(sorted.map((x) => x.id)).toEqual(['palu', 'hta', 'old-resolved']);
  });
  it('offers only the coded diagnoses not already open', () => {
    const problems = [p('hta', 'chronic', null, 'I10'), p('palu', 'resolved', null, 'B54')];
    const diagnoses = [
      { code: 'I10', label: 'HTA' },
      { code: 'B54', label: 'Paludisme' },
      { code: null, label: 'Fatigue' },
    ];
    expect(diagnosesNotOnProblemList(diagnoses, problems).map((d) => d.code)).toEqual(['B54']);
  });
});

describe('templates page access', () => {
  it('doctors and admins only', () => {
    expect(canAccessRoute('DOCTOR', '/dashboard/templates')).toBe(true);
    expect(canAccessRoute('ADMIN', '/dashboard/templates')).toBe(true);
    expect(canAccessRoute('NURSE', '/dashboard/templates')).toBe(false);
    expect(canAccessRoute('PATIENT', '/dashboard/templates')).toBe(false);
  });
});
