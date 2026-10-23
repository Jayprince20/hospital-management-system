'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { api, type ImagingExam, type ImagingExamInput, type ImagingModality } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { MODALITIES } from '@/lib/imaging';
import { usePolling } from '@/components/inpatient/ui';
import { ContrastBadge, ModalityBadge } from '@/components/imaging';
import { DialogShell, ErrorBox, cancelBtn, cardClass, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from '@/components/imaging/ui';

const EMPTY: ImagingExamInput = { code: '', name: '', modality: 'XRAY', bodyPart: '', price: 0, durationMinutes: 15, preparation: '', usesContrast: false, isActive: true };

function ExamDialog({ exam, onClose, onSaved }: { exam: ImagingExam | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState<ImagingExamInput>(exam ? { ...exam, preparation: exam.preparation ?? '' } : EMPTY);
  const [price, setPrice] = useState(String(exam?.price ?? ''));
  const [duration, setDuration] = useState(String(exam?.durationMinutes ?? 15));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ImagingExamInput>(key: K, value: ImagingExamInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const p = Number(price.replace(/\s/g, ''));
    const d = Number(duration);
    if (!form.code.trim() || !form.name.trim() || !form.bodyPart.trim()) return setError(t('img.exams.required'));
    if (!Number.isFinite(p) || p < 0) return setError(t('img.exams.badPrice'));
    if (!Number.isInteger(d) || d <= 0) return setError(t('img.exams.badDuration'));
    setSaving(true);
    setError('');
    // Only the editable fields (the loaded exam also carries id and timestamps)
    const body: ImagingExamInput = {
      modality: form.modality,
      usesContrast: Boolean(form.usesContrast),
      isActive: form.isActive !== false,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      bodyPart: form.bodyPart.trim(),
      price: p,
      durationMinutes: d,
      preparation: form.preparation?.trim() ? form.preparation.trim() : null,
    };
    try {
      if (exam) await api.updateImagingExam(exam.id, body);
      else await api.createImagingExam(body);
      onSaved();
    } catch (err) {
      setError(messageOf(err, t('img.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      wide
      title={exam ? t('img.exams.edit', { name: exam.name }) : t('img.exams.new')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('img.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('img.save')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="ex-code" className={labelClass}>{t('img.exams.code')}</label>
          <input id="ex-code" value={form.code} onChange={(e) => set('code', e.target.value)} className={inputClass} placeholder="RX-THX" />
        </div>
        <div>
          <label htmlFor="ex-modality" className={labelClass}>{t('img.exams.modality')}</label>
          <select id="ex-modality" value={form.modality} onChange={(e) => set('modality', e.target.value as ImagingModality)} className={inputClass}>
            {MODALITIES.map((m) => (
              <option key={m} value={m}>{t(`img.modality.${m}`)}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ex-name" className={labelClass}>{t('img.exams.name')}</label>
          <input id="ex-name" value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="ex-body" className={labelClass}>{t('img.exams.bodyPart')}</label>
          <input id="ex-body" value={form.bodyPart} onChange={(e) => set('bodyPart', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="ex-price" className={labelClass}>{t('img.exams.price')}</label>
          <input id="ex-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="ex-duration" className={labelClass}>{t('img.exams.duration')}</label>
          <input id="ex-duration" type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} className={inputClass} />
        </div>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={Boolean(form.usesContrast)} onChange={(e) => set('usesContrast', e.target.checked)} />
            {t('img.exams.usesContrast')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.isActive !== false} onChange={(e) => set('isActive', e.target.checked)} />
            {t('img.exams.active')}
          </label>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ex-prep" className={labelClass}>{t('img.preparation')}</label>
          <input id="ex-prep" value={form.preparation ?? ''} onChange={(e) => set('preparation', e.target.value)} className={inputClass} placeholder={t('img.exams.preparationPlaceholder')} />
        </div>
      </div>
    </DialogShell>
  );
}

export default function ImagingExamsPage() {
  const { t, formatCurrency } = useLanguage();
  const toast = useToast();
  const [exams, setExams] = useState<ImagingExam[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ImagingExam | null | 'new'>(null);

  const load = useCallback(async () => {
    try {
      setExams(await api.getImagingExams());
      setError('');
    } catch (err) {
      setError(messageOf(err, t('img.loadFailed')));
      setExams([]);
    }
  }, [t]);

  // Load on mount and when the filters change (shared helper, no polling)
  usePolling(load, null);

  const toggle = async (exam: ImagingExam) => {
    try {
      await api.updateImagingExam(exam.id, { isActive: !exam.isActive });
      toast.success(t(exam.isActive ? 'img.exams.deactivated' : 'img.exams.activated', { name: exam.name }));
      load();
    } catch (err) {
      toast.error(t('img.actionFailed'), messageOf(err, ''));
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/imaging" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('img.back')}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('img.exams.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('img.exams.subtitle')}</p>
        </div>
        <button type="button" onClick={() => setEditing('new')} className={primaryBtn}>{t('img.exams.new')}</button>
      </div>
      {error && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}
      <div className={`${cardClass} overflow-x-auto`}>
        {exams === null ? (
          <p className="p-6 text-sm text-gray-500">{t('img.loading')}</p>
        ) : exams.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('img.exams.none')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">{t('img.exams.code')}</th>
                <th className="px-4 py-2">{t('img.exams.name')}</th>
                <th className="px-4 py-2">{t('img.exams.modality')}</th>
                <th className="px-4 py-2 text-right">{t('img.exams.price')}</th>
                <th className="px-4 py-2">{t('img.preparation')}</th>
                <th className="px-4 py-2 text-right">{t('img.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {exams.map((e) => (
                <tr key={e.id} className={e.isActive ? '' : 'opacity-60'}>
                  <td className="px-4 py-3 font-mono text-xs">{e.code}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {e.name} {e.usesContrast && <ContrastBadge />}
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{e.bodyPart} · {t('img.exams.minutes', { count: e.durationMinutes })}</span>
                  </td>
                  <td className="px-4 py-3"><ModalityBadge modality={e.modality} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(e.price)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{e.preparation ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => setEditing(e)} className={smallBtn}>{t('img.exams.editButton')}</button>
                      <button type="button" onClick={() => toggle(e)} className={smallBtn}>{e.isActive ? t('img.exams.deactivate') : t('img.exams.activate')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && (
        <ExamDialog
          exam={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.success(t('img.exams.saved'));
            load();
          }}
        />
      )}
    </div>
  );
}
