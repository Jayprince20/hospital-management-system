'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';
import { usePolling } from '@/components/inpatient/ui';
import { ageGroupLabel, groupSchedule, isRecordable, type ImmunizationOverview, type ImmunizationRecord, type ScheduleItem } from '@/lib/maternal-child';
import { RecordDoseDialog } from './record-dose-dialog';
import { ErrorBox, VaccineStatusChip, cardClass, messageOf, smallBtn, useDay } from './ui';
import { usePendingWrites } from '@/context/offline-context';
import { PendingSyncBadge } from '@/components/offline/connectivity-indicator';

export interface MchPatient {
  id: string;
  name: string;
  dateOfBirth: string;
  gender?: string | null;
}

/** "Vaccination" tab: the PEV schedule as visits by age, the doses recorded, and the card */
export function VaccinationPanel({ patient, readOnly = false }: { patient: MchPatient; readOnly?: boolean }) {
  const { t } = useLanguage();
  const toast = useToast();
  const day = useDay();
  const [data, setData] = useState<ImmunizationOverview | null>(null);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<ScheduleItem | null>(null);
  const [inError, setInError] = useState<ImmunizationRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  // Doses recorded offline for this child, not on the server yet
  const pendingDoses = usePendingWrites('immunization', patient.id);
  const pendingFor = (item: ScheduleItem) => pendingDoses.find((p) => p.body?.vaccineCode === item.vaccineCode && p.body?.doseNumber === item.doseNumber);

  const load = useCallback(async () => {
    try {
      setData(await api.getImmunizations(patient.id));
      setError('');
    } catch (err) {
      setError(messageOf(err, t('mc.vax.loadFailed')));
    }
  }, [patient.id, t]);
  usePolling(load, null);

  const openCard = async () => {
    setOpening(true);
    try {
      await api.openImmunizationCard(patient.id);
    } catch (err) {
      toast.error(t('mc.vax.cardFailed'), messageOf(err, ''));
    } finally {
      setOpening(false);
    }
  };

  const markInError = async () => {
    if (!inError) return;
    setBusy(true);
    try {
      await api.updateImmunization(inError.id, { enteredInError: true });
      setInError(null);
      await load();
    } catch (err) {
      toast.error(t('mc.vax.inError'), messageOf(err, ''));
    } finally {
      setBusy(false);
    }
  };

  const recordable = data?.schedule.filter(isRecordable) ?? [];
  const groups = data ? groupSchedule(data.schedule, data.dateOfBirth || patient.dateOfBirth) : [];
  const records = [...(data?.records ?? [])].sort((a, b) => b.administeredOn.localeCompare(a.administeredOn));

  return (
    <div className="space-y-4">
      <section className={`${cardClass} p-5`} aria-labelledby="mc-vax-title">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 id="mc-vax-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('mc.vax.title')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('mc.vax.subtitle')}</p>
          </div>
          <button type="button" onClick={openCard} disabled={opening || !data} className={smallBtn}>{t('mc.vax.card')}</button>
        </div>
        <ErrorBox message={error} />
        {!data && !error && <p className="text-sm text-gray-500">{t('mc.loading')}</p>}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
              {data.summary.upToDate ? (
                <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 font-semibold">{t('mc.vax.upToDate')}</span>
              ) : data.summary.overdue > 0 ? (
                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200 font-semibold">{t('mc.vax.overdueCount', { n: data.summary.overdue })}</span>
              ) : null}
              {data.summary.nextDue && (
                <span className="text-gray-600 dark:text-gray-300">{t('mc.vax.nextDue', { label: data.summary.nextDue.label, date: day(data.summary.nextDue.dueOn) })}</span>
              )}
              <span className="ml-auto text-xs text-gray-400">{t('mc.vax.scheduleVersion', { v: data.scheduleVersion })}</span>
            </div>

            <ol className="space-y-3">
              {groups.map((g) => {
                const label = ageGroupLabel(g.group);
                return (
                  <li key={g.key} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)] items-start">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 sm:pt-2">{t(label.key, label.params)}</p>
                    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {g.items.map((item) => (
                        <li key={`${item.vaccineCode}-${item.doseNumber}`} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 dark:border-gray-700 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.label}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {item.status === 'GIVEN' && item.administeredOn ? t('mc.vax.givenOn', { date: day(item.administeredOn) }) : t('mc.vax.dueOn', { date: day(item.dueOn) })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {pendingFor(item) ? <PendingSyncBadge /> : <VaccineStatusChip status={item.status} />}
                            {!readOnly && isRecordable(item) && !pendingFor(item) && (
                              <button type="button" onClick={() => setRecording(item)} className={smallBtn} aria-label={`${t('mc.vax.record')} ${item.label}`}>
                                {t('mc.vax.record')}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>

      {data && (
        <section className={`${cardClass} p-5`} aria-labelledby="mc-vax-records">
          <h3 id="mc-vax-records" className="text-base font-semibold text-gray-900 dark:text-white mb-3">{t('mc.vax.records')}</h3>
          {records.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('mc.vax.noRecords')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {records.map((r) => (
                <li key={r.id} className={`py-2.5 flex flex-wrap items-center justify-between gap-2 ${r.enteredInError ? 'opacity-60' : ''}`}>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium text-gray-900 dark:text-white ${r.enteredInError ? 'line-through' : ''}`}>
                      {r.label} · {day(r.administeredOn)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {[
                        r.lotNumber ? t('mc.vax.lotShort', { lot: r.lotNumber }) : null,
                        r.route ? t(`mc.vax.route.${r.route}`) : null,
                        r.site,
                        r.external ? (r.source ? t('mc.vax.from', { source: r.source }) : t('mc.vax.external')) : r.givenBy ? t('mc.vax.givenBy', { name: r.givenBy.name }) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {r.aefi && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{t('mc.vax.field.aefi')} : {r.aefi}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.external && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">{t('mc.vax.external')}</span>}
                    {r.enteredInError ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200">{t('mc.vax.inError')}</span>
                    ) : (
                      !readOnly && (
                        <button type="button" onClick={() => setInError(r)} className={smallBtn}>{t('mc.vax.markError')}</button>
                      )
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {recording && (
        <RecordDoseDialog
          patient={{ id: patient.id, name: patient.name }}
          items={recordable}
          initial={recording}
          onClose={() => setRecording(null)}
          onSaved={() => {
            setRecording(null);
            void load();
          }}
        />
      )}
      <ConfirmModal
        isOpen={inError !== null}
        onClose={() => setInError(null)}
        onConfirm={markInError}
        title={t('mc.vax.markError')}
        message={t('mc.vax.markErrorConfirm')}
        confirmText={t('mc.vax.markError')}
        cancelText={t('mc.cancel')}
        variant="danger"
        isLoading={busy}
      />
    </div>
  );
}
