'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { DiagnosisPicker } from '@/components/clinical-safety/diagnosis-picker';
import {
  emptyTemplateForm,
  templateFormFrom,
  templateFormToInput,
  type ConsultationTemplate,
  type TemplateFormState,
  type TemplatePrescriptionLine,
} from '@/lib/clinical-docs';
import { ErrorBox, cancelBtn, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from './ui';

const emptyLine = (): TemplatePrescriptionLine => ({ medicationName: '', dosage: '', frequency: '', duration: '', route: '', instructions: '' });

/** Create or edit a consultation template (text, ICD-10 diagnoses, lab tests, prescription lines) */
export function TemplateFormDialog({
  template,
  canShare,
  onClose,
  onSaved,
}: {
  template: ConsultationTemplate | null;
  canShare: boolean;
  onClose: () => void;
  onSaved: (tpl: ConsultationTemplate) => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const medsListId = useId();
  const [f, setF] = useState<TemplateFormState>(() => (template ? templateFormFrom(template) : emptyTemplateForm()));
  const [labTests, setLabTests] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [labFilter, setLabFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getLabTests({ isActive: true, limit: 200 })
      .then((res) => setLabTests((res.labTests ?? []).map((x) => ({ id: x.id, name: x.name, code: x.code }))))
      .catch(() => setLabTests([]));
    api
      .getMedications({ isActive: true, limit: 200 })
      .then((res) => setMedications((res.medications ?? []).map((m) => m.name)))
      .catch(() => setMedications([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const set = <K extends keyof TemplateFormState>(key: K, value: TemplateFormState[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const setLine = (i: number, patch: Partial<TemplatePrescriptionLine>) =>
    setF((prev) => ({ ...prev, prescriptionLines: prev.prescriptionLines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const shownTests = useMemo(() => {
    const q = labFilter.trim().toLowerCase();
    return q ? labTests.filter((x) => x.name.toLowerCase().includes(q) || x.code.toLowerCase().includes(q) || f.labTestIds.includes(x.id)) : labTests;
  }, [labTests, labFilter, f.labTestIds]);

  const save = async () => {
    if (!f.name.trim()) {
      setError(t('cdoc.tpl.nameRequired'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = templateFormToInput(f);
      const saved = template ? await api.updateConsultationTemplate(template.id, body) : await api.createConsultationTemplate(body);
      toast.success(t('cdoc.tpl.saved'), saved.name);
      onSaved(saved);
    } catch (err) {
      setError(messageOf(err, t('cdoc.actionFailed')));
      setBusy(false);
    }
  };

  const area = (key: 'chiefComplaint' | 'examination' | 'treatmentPlan' | 'notes' | 'symptomsText', label: string, rows = 3) => (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <textarea className={inputClass} rows={rows} value={f[key]} onChange={(e) => set(key, e.target.value)} />
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={template ? t('cdoc.tpl.formTitleEdit') : t('cdoc.tpl.formTitleNew')}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{template ? t('cdoc.tpl.formTitleEdit') : t('cdoc.tpl.formTitleNew')}</h2>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          <ErrorBox message={error} />
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>{t('cdoc.tpl.field.name')} *</span>
              <input className={inputClass} value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
            </label>
            <label className="block">
              <span className={labelClass}>{t('cdoc.tpl.field.specialty')}</span>
              <input className={inputClass} value={f.specialty} onChange={(e) => set('specialty', e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>{t('cdoc.tpl.field.description')}</span>
              <input className={inputClass} value={f.description} onChange={(e) => set('description', e.target.value)} />
            </label>
          </div>
          {canShare && (
            <fieldset className="flex flex-wrap gap-4">
              <legend className={labelClass}>{t('cdoc.tpl.field.scope')}</legend>
              {(['PERSONAL', 'SHARED'] as const).map((s) => (
                <label key={s} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="radio" name="tpl-form-scope" checked={f.scope === s} onChange={() => set('scope', s)} className="mt-0.5" />
                  <span>
                    {t(`cdoc.tpl.scope.${s}`)} <span className="text-xs text-gray-500">— {t(`cdoc.tpl.scopeHint.${s}`)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {area('chiefComplaint', t('cdoc.tpl.field.chiefComplaint'), 2)}
            {area('symptomsText', t('cdoc.tpl.field.symptoms'), 2)}
            {area('examination', t('cdoc.tpl.field.examination'))}
            {area('treatmentPlan', t('cdoc.tpl.field.treatmentPlan'))}
          </div>
          <DiagnosisPicker value={f.diagnoses} onChange={(diagnoses) => set('diagnoses', diagnoses)} />
          <div className="grid md:grid-cols-[minmax(0,1fr)_10rem] gap-3">
            {area('notes', t('cdoc.tpl.field.notes'), 2)}
            <label className="block">
              <span className={labelClass}>{t('cdoc.tpl.field.followUpDays')}</span>
              <input type="number" min={1} max={365} className={inputClass} value={f.followUpDays} onChange={(e) => set('followUpDays', e.target.value)} />
            </label>
          </div>

          <fieldset>
            <legend className={labelClass}>{t('cdoc.tpl.field.labTests')}</legend>
            <input className={`${inputClass} mb-2`} value={labFilter} onChange={(e) => setLabFilter(e.target.value)} placeholder={t('cdoc.tpl.labSearch')} aria-label={t('cdoc.tpl.labSearch')} />
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-2 grid sm:grid-cols-2 gap-1">
              {shownTests.map((test) => (
                <label key={test.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={f.labTestIds.includes(test.id)}
                    onChange={(e) => set('labTestIds', e.target.checked ? [...f.labTestIds, test.id] : f.labTestIds.filter((id) => id !== test.id))}
                  />
                  <span className="truncate">{test.name} <span className="text-xs text-gray-500">({test.code})</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={labelClass}>{t('cdoc.tpl.field.rx')}</legend>
            <datalist id={medsListId}>
              {medications.map((m) => <option key={m} value={m} />)}
            </datalist>
            <div className="space-y-2">
              {f.prescriptionLines.map((line, i) => (
                <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 grid gap-2 sm:grid-cols-6">
                  <input className={`${inputClass} sm:col-span-2`} list={medsListId} value={line.medicationName} onChange={(e) => setLine(i, { medicationName: e.target.value })} placeholder={t('cdoc.tpl.rx.medication')} aria-label={t('cdoc.tpl.rx.medication')} />
                  <input className={inputClass} value={line.dosage} onChange={(e) => setLine(i, { dosage: e.target.value })} placeholder={t('cdoc.tpl.rx.dosage')} aria-label={t('cdoc.tpl.rx.dosage')} />
                  <input className={inputClass} value={line.frequency} onChange={(e) => setLine(i, { frequency: e.target.value })} placeholder={t('cdoc.tpl.rx.frequency')} aria-label={t('cdoc.tpl.rx.frequency')} />
                  <input className={inputClass} value={line.duration} onChange={(e) => setLine(i, { duration: e.target.value })} placeholder={t('cdoc.tpl.rx.duration')} aria-label={t('cdoc.tpl.rx.duration')} />
                  <button type="button" className={`${smallBtn} text-red-600 dark:text-red-400`} onClick={() => set('prescriptionLines', f.prescriptionLines.filter((_, j) => j !== i))} aria-label={t('cdoc.tpl.rx.remove', { n: i + 1 })}>✕</button>
                  <input className={`${inputClass} sm:col-span-2`} value={line.route ?? ''} onChange={(e) => setLine(i, { route: e.target.value })} placeholder={t('cdoc.tpl.rx.route')} aria-label={t('cdoc.tpl.rx.route')} />
                  <input className={`${inputClass} sm:col-span-4`} value={line.instructions ?? ''} onChange={(e) => setLine(i, { instructions: e.target.value })} placeholder={t('cdoc.tpl.rx.instructions')} aria-label={t('cdoc.tpl.rx.instructions')} />
                </div>
              ))}
            </div>
            <button type="button" className={`${smallBtn} mt-2`} onClick={() => set('prescriptionLines', [...f.prescriptionLines, emptyLine()])}>+ {t('cdoc.tpl.rx.add')}</button>
          </fieldset>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button type="button" className={cancelBtn} onClick={onClose} disabled={busy}>{t('cdoc.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={save} disabled={busy || !f.name.trim()}>{busy ? t('cdoc.loading') : t('cdoc.save')}</button>
        </div>
      </div>
    </div>
  );
}
