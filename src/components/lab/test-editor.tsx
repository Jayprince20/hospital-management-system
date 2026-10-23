'use client';

import { useState } from 'react';
import { api, LabReferenceRange, LabResultType, LabTest } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { CONTAINERS, parseNumeric } from '@/lib/lab';
import { DialogShell, ErrorBox, cancelBtn, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from './ui';

type RangeDraft = { sex: '' | 'MALE' | 'FEMALE'; ageMinYears: string; ageMaxYears: string; low: string; high: string; criticalLow: string; criticalHigh: string; label: string };

const str = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));
const num = (v: string) => (v.trim() === '' ? null : parseNumeric(v));

/** Result type, tube, default/critical ranges and sex/age ranges of one test */
export function LabTestEditor({ test, onClose, onSaved }: { test: LabTest; onClose: () => void; onSaved: (t: LabTest) => void }) {
  const { t } = useLanguage();
  const [resultType, setResultType] = useState<LabResultType>(test.resultType ?? 'NUMERIC');
  const [options, setOptions] = useState((test.options ?? []).join(', '));
  const [container, setContainer] = useState(test.container ?? '');
  const [unit, setUnit] = useState(test.unit ?? '');
  const [decimals, setDecimals] = useState(String(test.decimals ?? 1));
  const [refLow, setRefLow] = useState(str(test.refLow));
  const [refHigh, setRefHigh] = useState(str(test.refHigh));
  const [criticalLow, setCriticalLow] = useState(str(test.criticalLow));
  const [criticalHigh, setCriticalHigh] = useState(str(test.criticalHigh));
  const [ranges, setRanges] = useState<RangeDraft[]>(
    (test.referenceRanges ?? []).map((r) => ({
      sex: (r.sex ?? '') as RangeDraft['sex'],
      ageMinYears: str(r.ageMinYears),
      ageMaxYears: str(r.ageMaxYears),
      low: str(r.low),
      high: str(r.high),
      criticalLow: str(r.criticalLow),
      criticalHigh: str(r.criticalHigh),
      label: r.label ?? '',
    }))
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const setRange = (i: number, patch: Partial<RangeDraft>) => setRanges((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    const numbers = [refLow, refHigh, criticalLow, criticalHigh, ...ranges.flatMap((r) => [r.low, r.high, r.criticalLow, r.criticalHigh])];
    if (numbers.some((v) => v.trim() !== '' && parseNumeric(v) == null)) return setError(t('labw.catalogue.badNumber'));
    const opts = options.split(',').map((o) => o.trim()).filter(Boolean);
    if (resultType === 'OPTION' && opts.length < 2) return setError(t('labw.catalogue.optionsRequired'));
    const referenceRanges: LabReferenceRange[] = ranges.map((r) => ({
      sex: r.sex || null,
      ageMinYears: r.ageMinYears.trim() ? Number(r.ageMinYears) : null,
      ageMaxYears: r.ageMaxYears.trim() ? Number(r.ageMaxYears) : null,
      low: num(r.low),
      high: num(r.high),
      criticalLow: num(r.criticalLow),
      criticalHigh: num(r.criticalHigh),
      label: r.label.trim() || null,
    }));
    setSaving(true);
    setError('');
    try {
      const saved = await api.saveLabTestRanges(test.id, {
        resultType,
        options: resultType === 'OPTION' ? opts : [],
        container: container || null,
        unit: unit || undefined,
        decimals: Number(decimals) || 0,
        refLow: num(refLow),
        refHigh: num(refHigh),
        criticalLow: num(criticalLow),
        criticalHigh: num(criticalHigh),
        referenceRanges,
      });
      onSaved(saved);
    } catch (err) {
      setError(messageOf(err, t('labw.actionFailed')));
      setSaving(false);
    }
  };

  const numericField = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} className={inputClass} />
    </div>
  );

  return (
    <DialogShell
      wide
      title={t('labw.catalogue.editTitle', { name: test.name })}
      subtitle={test.code}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('labw.cancel')}</button>
          <button type="button" onClick={save} disabled={saving} className={primaryBtn}>{t('labw.catalogue.save')}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="lt-type" className={labelClass}>{t('labw.catalogue.resultType')}</label>
          <select id="lt-type" value={resultType} onChange={(e) => setResultType(e.target.value as LabResultType)} className={inputClass}>
            {(['NUMERIC', 'OPTION', 'TEXT'] as const).map((r) => (
              <option key={r} value={r}>{t(`labw.type.${r}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lt-container" className={labelClass}>{t('labw.catalogue.container')}</label>
          <input id="lt-container" list="lt-containers" value={container} onChange={(e) => setContainer(e.target.value)} className={inputClass} />
          <datalist id="lt-containers">
            {CONTAINERS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="lt-unit" className={labelClass}>{t('labw.catalogue.unit')}</label>
          <input id="lt-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass} />
        </div>
      </div>

      {resultType === 'OPTION' && (
        <div>
          <label htmlFor="lt-options" className={labelClass}>{t('labw.catalogue.options')}</label>
          <input id="lt-options" value={options} onChange={(e) => setOptions(e.target.value)} className={inputClass} placeholder="Négative, Positive" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('labw.catalogue.optionsHint')}</p>
        </div>
      )}

      {resultType === 'NUMERIC' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {numericField('lt-low', t('labw.catalogue.refLow'), refLow, setRefLow)}
            {numericField('lt-high', t('labw.catalogue.refHigh'), refHigh, setRefHigh)}
            {numericField('lt-clow', t('labw.catalogue.criticalLow'), criticalLow, setCriticalLow)}
            {numericField('lt-chigh', t('labw.catalogue.criticalHigh'), criticalHigh, setCriticalHigh)}
            <div>
              <label htmlFor="lt-dec" className={labelClass}>{t('labw.catalogue.decimals')}</label>
              <input id="lt-dec" type="number" min={0} max={4} value={decimals} onChange={(e) => setDecimals(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('labw.catalogue.ranges')}</h3>
              <button
                type="button"
                className={smallBtn}
                onClick={() => setRanges((rs) => [...rs, { sex: '', ageMinYears: '', ageMaxYears: '', low: '', high: '', criticalLow: '', criticalHigh: '', label: '' }])}
              >
                {t('labw.catalogue.addRange')}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('labw.catalogue.rangesHint')}</p>
            {ranges.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('labw.catalogue.noRanges')}</p>
            ) : (
              <div className="space-y-2">
                {ranges.map((r, i) => (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-9 gap-2 items-end border-b border-gray-100 dark:border-gray-700 pb-2">
                    <div className="sm:col-span-2">
                      <label className={labelClass} htmlFor={`r-label-${i}`}>{t('labw.catalogue.rangeLabel')}</label>
                      <input id={`r-label-${i}`} value={r.label} onChange={(e) => setRange(i, { label: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor={`r-sex-${i}`}>{t('labw.catalogue.sex')}</label>
                      <select id={`r-sex-${i}`} value={r.sex} onChange={(e) => setRange(i, { sex: e.target.value as RangeDraft['sex'] })} className={inputClass}>
                        <option value="">{t('labw.catalogue.anySex')}</option>
                        <option value="MALE">{t('labw.sex.MALE')}</option>
                        <option value="FEMALE">{t('labw.sex.FEMALE')}</option>
                      </select>
                    </div>
                    {(
                      [
                        ['ageMinYears', 'ageMin'],
                        ['ageMaxYears', 'ageMax'],
                        ['low', 'refLow'],
                        ['high', 'refHigh'],
                        ['criticalLow', 'criticalLow'],
                        ['criticalHigh', 'criticalHigh'],
                      ] as Array<[keyof RangeDraft, string]>
                    ).map(([field, key]) => (
                      <div key={field}>
                        <label className={labelClass} htmlFor={`r-${field}-${i}`}>{t(`labw.catalogue.${key}`)}</label>
                        <input id={`r-${field}-${i}`} inputMode="decimal" value={r[field]} onChange={(e) => setRange(i, { [field]: e.target.value } as Partial<RangeDraft>)} className={inputClass} />
                      </div>
                    ))}
                    <button type="button" className={`${smallBtn} sm:col-span-9 justify-self-end`} onClick={() => setRanges((rs) => rs.filter((_, j) => j !== i))}>
                      {t('labw.catalogue.removeRange')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {error && <ErrorBox message={error} />}
    </DialogShell>
  );
}
