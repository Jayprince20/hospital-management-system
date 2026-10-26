'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';
import { usePolling } from '@/components/inpatient/ui';
import { usePendingWrites } from '@/context/offline-context';
import { PendingSyncBadge } from '@/components/offline/connectivity-indicator';
import {
  GROWTH_INDICATORS,
  chartMeasurements,
  defaultIndicator,
  formatZ,
  numOrUndef,
  sexCode,
  sortStatuses,
  todayString,
  type GrowthIndicator,
  type GrowthOverview,
  type GrowthPoint,
  type GrowthReference,
} from '@/lib/maternal-child';
import { GrowthChart } from './growth-chart';
import { DialogShell, ErrorBox, Field, NutritionBadge, Stat, cancelBtn, cardClass, inputClass, messageOf, primaryBtn, smallBtn, useDay } from './ui';
import type { MchPatient } from './vaccination-panel';

const Z_KEYS = ['wfa', 'lhfa', 'wflh', 'bfa', 'hcfa'] as const;
const IMPLAUSIBLE = /improbable|implausible/i;

/** "Croissance" tab: WHO growth curves, the latest nutritional status and the measurements */
export function GrowthPanel({ patient, readOnly = false }: { patient: MchPatient; readOnly?: boolean }) {
  const { t } = useLanguage();
  const toast = useToast();
  const day = useDay();
  const [data, setData] = useState<GrowthOverview | null>(null);
  const [error, setError] = useState('');
  const [indicator, setIndicator] = useState<GrowthIndicator | null>(null);
  // Measurements entered offline (z-scores are computed by the server on sync)
  const pendingPoints = usePendingWrites('growth', patient.id);
  const [references, setReferences] = useState<Record<string, GrowthReference | null>>({});
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<GrowthPoint | null>(null);
  const [busy, setBusy] = useState(false);

  const sex = sexCode(data?.sex) ?? sexCode(patient.gender);

  const load = useCallback(async () => {
    try {
      const overview = await api.getGrowth(patient.id);
      setData(overview);
      setIndicator((current) => current ?? defaultIndicator(overview.latest));
      setError('');
    } catch (err) {
      setError(messageOf(err, t('mc.growth.loadFailed')));
    }
  }, [patient.id, t]);
  usePolling(load, null);

  const refKey = indicator && sex ? `${indicator}-${sex}` : null;
  useEffect(() => {
    if (!indicator || !sex || !refKey || refKey in references) return;
    let cancelled = false;
    api
      .getGrowthReference(indicator, sex)
      .then((ref) => !cancelled && setReferences((r) => ({ ...r, [refKey]: ref })))
      .catch(() => !cancelled && setReferences((r) => ({ ...r, [refKey]: null })));
    return () => {
      cancelled = true;
    };
  }, [indicator, sex, refKey, references]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteGrowth(deleting.id);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(t('mc.growth.delete'), messageOf(err, ''));
    } finally {
      setBusy(false);
    }
  };

  const reference = refKey ? references[refKey] : undefined;
  const measurements = [...(data?.measurements ?? [])].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn));
  const chartPoints = indicator && reference ? chartMeasurements(data?.measurements ?? [], indicator, reference) : [];
  const latest = data?.latest ?? null;
  const decimals = (n: number | null | undefined, unit = '') => (n == null ? '—' : `${n.toFixed(1).replace('.', ',')}${unit}`);

  return (
    <div className="space-y-4">
      <section className={`${cardClass} p-5`} aria-labelledby="mc-growth-title">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 id="mc-growth-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('mc.growth.title')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('mc.growth.subtitle')}</p>
          </div>
          {!readOnly && data && (
            <button type="button" onClick={() => setAdding(true)} className={primaryBtn}>{t('mc.growth.add')}</button>
          )}
        </div>
        <ErrorBox message={error} />
        {!data && !error && <p className="text-sm text-gray-500">{t('mc.loading')}</p>}

        {data && latest && (
          <div className="mb-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t('mc.growth.latest')} · {day(latest.measuredOn)} · {t('mc.growth.ageMonths', { n: decimals(latest.ageMonths) })}
            </p>
            <div className="flex flex-wrap gap-2">
              {latest.status.length === 0 ? (
                <span className="px-2 py-0.5 rounded-full border text-xs font-semibold bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-200 dark:border-green-800">{t('mc.growth.normal')}</span>
              ) : (
                sortStatuses(latest.status).map((code) => <NutritionBadge key={code} code={code} />)
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label={t('mc.growth.field.weight')} value={decimals(latest.weightKg)} sub={`z ${formatZ(latest.z.wfa)}`} />
              <Stat label={t('mc.growth.field.height')} value={decimals(latest.lengthHeightCm)} sub={`z ${formatZ(latest.z.lhfa)}`} />
              <Stat label={t('mc.growth.z.wflh')} value={formatZ(latest.z.wflh)} tone={latest.z.wflh != null && latest.z.wflh < -2 ? 'alert' : undefined} />
              <Stat label={t('mc.growth.field.muac')} value={decimals(latest.muacCm)} tone={latest.muacCm != null && latest.muacCm < 12.5 ? 'alert' : undefined} />
            </div>
          </div>
        )}
        {data && !data.eligible && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('mc.growth.notEligible')}</p>}

        {data && (
          <>
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" role="tablist" aria-label={t('mc.growth.title')}>
              {GROWTH_INDICATORS.map((ind) => (
                <button
                  key={ind}
                  type="button"
                  role="tab"
                  aria-selected={indicator === ind}
                  onClick={() => setIndicator(ind)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border ${indicator === ind ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:bg-gray-50'}`}
                >
                  {t(`mc.growth.ind.${ind}`)}
                </button>
              ))}
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              {!sex ? (
                <p className="text-sm py-6 text-center">{t('mc.growth.noSex')}</p>
              ) : reference === undefined ? (
                <p className="text-sm py-6 text-center">{t('mc.loading')}</p>
              ) : reference === null ? (
                <p className="text-sm py-6 text-center">{t('mc.growth.noReference')}</p>
              ) : (
                <>
                  <GrowthChart indicator={indicator!} reference={reference} points={chartPoints} />
                  {chartPoints.length === 0 && <p className="text-xs text-center mt-1">{t('mc.growth.noPoints')}</p>}
                </>
              )}
            </div>
          </>
        )}
      </section>

      {data && (
        <section className={`${cardClass} p-5`} aria-labelledby="mc-growth-history">
          <h3 id="mc-growth-history" className="text-base font-semibold text-gray-900 dark:text-white mb-3">{t('mc.growth.history')}</h3>
          {measurements.length === 0 && pendingPoints.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('mc.growth.none')}</p>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-2 pr-3">{t('mc.growth.field.date')}</th>
                    <th className="py-2 pr-3">{t('mc.growth.age')}</th>
                    <th className="py-2 pr-3 text-right">{t('mc.growth.unit.kg')}</th>
                    <th className="py-2 pr-3 text-right">{t('mc.growth.unit.cm')}</th>
                    {Z_KEYS.map((k) => (
                      <th key={k} className="py-2 pr-3 text-right">{t(`mc.growth.z.${k}`)}</th>
                    ))}
                    <th className="py-2 pr-3">{t('mc.preg.alerts')}</th>
                    {!readOnly && <th className="py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {pendingPoints.map((p) => {
                    const b = (p.body ?? {}) as Record<string, string | number | undefined>;
                    return (
                      <tr key={p.key} className="bg-amber-50/60 dark:bg-amber-900/10 text-gray-900 dark:text-gray-100">
                        <td className="py-2 pr-3 whitespace-nowrap">{b.measuredOn ? day(String(b.measuredOn)) : '—'}</td>
                        <td className="py-2 pr-3">—</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{b.weightKg != null ? decimals(Number(b.weightKg)) : '—'}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{b.lengthHeightCm != null ? decimals(Number(b.lengthHeightCm)) : '—'}</td>
                        {Z_KEYS.map((k) => (
                          <td key={k} className="py-2 pr-3 text-right text-gray-400">—</td>
                        ))}
                        <td className="py-2 pr-3"><PendingSyncBadge /></td>
                        {!readOnly && <td className="py-2" />}
                      </tr>
                    );
                  })}
                  {measurements.map((m) => (
                    <tr key={m.id} className="text-gray-900 dark:text-gray-100">
                      <td className="py-2 pr-3 whitespace-nowrap">{day(m.measuredOn)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{t('mc.growth.ageMonths', { n: decimals(m.ageMonths) })}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{decimals(m.weightKg)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{decimals(m.lengthHeightCm)}</td>
                      {Z_KEYS.map((k) => (
                        <td key={k} className={`py-2 pr-3 text-right tabular-nums ${m.z[k] != null && m.z[k]! < -2 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>{formatZ(m.z[k])}</td>
                      ))}
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">{sortStatuses(m.status).map((c) => <NutritionBadge key={c} code={c} />)}</div>
                      </td>
                      {!readOnly && (
                        <td className="py-2 text-right">
                          <button type="button" onClick={() => setDeleting(m)} className={smallBtn}>{t('mc.growth.delete')}</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {adding && data && (
        <AddMeasurementDialog
          patientId={patient.id}
          dateOfBirth={data.dateOfBirth || patient.dateOfBirth}
          onClose={() => setAdding(false)}
          onSaved={(point) => {
            setAdding(false);
            toast.success(t('mc.growth.saved'), point.status.length ? point.status.map((c) => t(`mc.nut.${c}`)).join(', ') : t('mc.growth.normal'));
            void load();
          }}
        />
      )}
      <ConfirmModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title={t('mc.growth.delete')}
        message={t('mc.growth.deleteConfirm')}
        confirmText={t('mc.growth.delete')}
        cancelText={t('mc.cancel')}
        variant="danger"
        isLoading={busy}
      />
    </div>
  );
}

function AddMeasurementDialog({
  patientId,
  dateOfBirth,
  onClose,
  onSaved,
}: {
  patientId: string;
  dateOfBirth: string;
  onClose: () => void;
  onSaved: (point: GrowthPoint) => void;
}) {
  const { t } = useLanguage();
  const under2 = (Date.now() - new Date(dateOfBirth).getTime()) / 86_400_000 < 731;
  const [measuredOn, setMeasuredOn] = useState(todayString());
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [lying, setLying] = useState(under2);
  const [head, setHead] = useState('');
  const [muac, setMuac] = useState('');
  const [oedema, setOedema] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [implausible, setImplausible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const input = {
      measuredOn,
      weightKg: numOrUndef(weight),
      lengthHeightCm: numOrUndef(height),
      measuredLying: numOrUndef(height) !== undefined ? lying : undefined,
      headCircumferenceCm: numOrUndef(head),
      muacCm: numOrUndef(muac),
      oedema: oedema || undefined,
      notes: notes.trim() || undefined,
      confirmImplausible: implausible && confirmed ? true : undefined,
    };
    if (input.weightKg === undefined && input.lengthHeightCm === undefined && input.headCircumferenceCm === undefined && input.muacCm === undefined && !oedema) {
      setError(t('mc.growth.needOne'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      onSaved(await api.recordGrowth(patientId, input));
    } catch (err) {
      const message = messageOf(err, t('mc.growth.loadFailed'));
      setError(message);
      if (IMPLAUSIBLE.test(message)) setImplausible(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={t('mc.growth.add')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('mc.cancel')}</button>
          <button type="button" onClick={save} disabled={busy || (implausible && !confirmed)} className={primaryBtn}>{busy ? t('mc.saving') : t('mc.save')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      {implausible && (
        <label className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="rounded border-gray-300" />
          {t('mc.growth.confirm')}
        </label>
      )}
      <Field label={t('mc.growth.field.date')}>
        <input type="date" value={measuredOn} max={todayString()} onChange={(e) => setMeasuredOn(e.target.value)} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('mc.growth.field.weight')}>
          <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass} autoFocus />
        </Field>
        <Field label={t('mc.growth.field.height')}>
          <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('mc.growth.field.head')}>
          <input inputMode="decimal" value={head} onChange={(e) => setHead(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('mc.growth.field.muac')}>
          <input inputMode="decimal" value={muac} onChange={(e) => setMuac(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={lying} onChange={(e) => setLying(e.target.checked)} className="rounded border-gray-300" />
        {t('mc.growth.field.lying')}
        <span className="text-xs text-gray-500">({t('mc.growth.lyingHint')})</span>
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={oedema} onChange={(e) => setOedema(e.target.checked)} className="rounded border-gray-300" />
        {t('mc.growth.field.oedema')}
      </label>
      <Field label={t('mc.growth.field.notes')}>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </Field>
    </DialogShell>
  );
}
