'use client';

import { useState } from 'react';
import { api, type ImagingOrder, type PregnancyStatus } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { PREGNANCY_STATUSES, needsPregnancyCheck, performBlockers, pregnancyNeedsAgreement } from '@/lib/imaging';
import { ErrorBox, cardClass, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from './ui';

/**
 * Before acquisition: pregnancy status (women 12–50, ionising exams), contrast checks, notes.
 * Then "Examen réalisé". The server enforces the same rules.
 */
export function SafetyPanel({ order, isRadiologist, onChanged }: { order: ImagingOrder; isRadiologist: boolean; onChanged: (o: ImagingOrder) => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const pregnancyCheck = needsPregnancyCheck(order.exam.modality, order.patient.gender, order.patient.age);
  const contrastAllergy = order.warnings.includes('CONTRAST_ALLERGY');
  const [pregnancy, setPregnancy] = useState<PregnancyStatus | ''>(order.pregnancyStatus ?? '');
  const [contrastChecked, setContrastChecked] = useState(Boolean(order.contrastChecked));
  const [creatinine, setCreatinine] = useState(order.creatinine != null ? String(order.creatinine) : '');
  const [notes, setNotes] = useState(order.safetyNotes ?? '');
  const [agreed, setAgreed] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const blockers = performBlockers({
    modality: order.exam.modality,
    usesContrast: order.exam.usesContrast,
    gender: order.patient.gender,
    age: order.patient.age,
    pregnancyStatus: pregnancy || null,
    contrastChecked,
    radiologistAgreed: agreed,
    contrastAllergy,
    overrideReason,
  });

  const saveChecks = async (): Promise<ImagingOrder> => {
    const creat = creatinine.trim() ? Number(creatinine.replace(',', '.')) : null;
    return api.updateImagingOrder(order.id, {
      action: 'safety',
      ...(pregnancy ? { pregnancyStatus: pregnancy } : {}),
      ...(order.exam.usesContrast ? { contrastChecked, creatinine: creat != null && Number.isFinite(creat) ? creat : null } : {}),
      ...(notes.trim() ? { safetyNotes: notes.trim() } : {}),
    });
  };

  const run = async (perform: boolean) => {
    setSaving(true);
    setError('');
    try {
      let updated = await saveChecks();
      if (perform) {
        updated = await api.updateImagingOrder(order.id, {
          action: 'perform',
          ...(agreed ? { radiologistAgreed: true } : {}),
          ...(contrastAllergy && overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {}),
        });
        toast.success(t('img.perform.done', { number: order.number }));
      } else {
        toast.success(t('img.safety.saved'));
      }
      onChanged(updated);
    } catch (err) {
      setError(messageOf(err, t('img.actionFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`${cardClass} p-5 space-y-4`} aria-labelledby="img-safety-title">
      <h2 id="img-safety-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('img.safety.title')}</h2>
      <ErrorBox message={error} />

      {pregnancyCheck ? (
        <fieldset>
          <legend className={labelClass}>{t('img.safety.pregnancy')}<span className="text-red-500"> *</span></legend>
          <div className="flex flex-wrap gap-2">
            {PREGNANCY_STATUSES.filter((s) => s !== 'NOT_APPLICABLE').map((s) => (
              <label key={s} className={`px-3 py-2 rounded-lg border text-sm cursor-pointer ${pregnancy === s ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/30' : 'border-gray-300 dark:border-gray-600'}`}>
                <input type="radio" name="img-pregnancy" value={s} checked={pregnancy === s} onChange={() => setPregnancy(s)} className="mr-2" />
                {t(`img.pregnancy.${s}`)}
              </label>
            ))}
          </div>
          {pregnancyNeedsAgreement(pregnancy || null) && (
            <div className="mt-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-sm text-red-800 dark:text-red-200 space-y-2">
              <p>{t('img.safety.agreementNeeded')}</p>
              {isRadiologist ? (
                <label className="flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                  {t('img.safety.agree')}
                </label>
              ) : (
                <p className="text-xs">{t('img.safety.callRadiologist')}</p>
              )}
            </div>
          )}
        </fieldset>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('img.safety.noPregnancyCheck')}</p>
      )}

      {order.exam.usesContrast && (
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
            <input type="checkbox" checked={contrastChecked} onChange={(e) => setContrastChecked(e.target.checked)} className="mt-0.5" />
            <span>{t('img.safety.contrastChecklist')}</span>
          </label>
          <div className="max-w-xs">
            <label htmlFor="img-creat" className={labelClass}>{t('img.safety.creatinine')}</label>
            <input id="img-creat" inputMode="decimal" value={creatinine} onChange={(e) => setCreatinine(e.target.value)} className={inputClass} placeholder="ex. 85" />
          </div>
          {contrastAllergy && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 space-y-2">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">{t('img.warning.CONTRAST_ALLERGY')}</p>
              <label htmlFor="img-override" className="block text-sm text-red-800 dark:text-red-200">{t('img.safety.overrideReason')}</label>
              <textarea id="img-override" rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className={inputClass} />
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="img-safety-notes" className={labelClass}>{t('img.safety.notes')}</label>
        <textarea id="img-safety-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </div>

      {blockers.length > 0 && (
        <ul className="text-sm text-amber-800 dark:text-amber-200 list-disc pl-5">
          {blockers.map((b) => (
            <li key={b}>{t(b)}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" onClick={() => run(false)} disabled={saving} className={smallBtn}>{t('img.safety.save')}</button>
        <button type="button" onClick={() => run(true)} disabled={saving || blockers.length > 0} className={primaryBtn}>{t('img.perform.button')}</button>
      </div>
    </section>
  );
}
