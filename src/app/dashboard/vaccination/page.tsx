'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { usePolling } from '@/components/inpatient/ui';
import { useAuth } from '@/context/auth-context';
import { RecordDoseDialog, VaccineStatusChip } from '@/components/maternal-child';
import { ErrorBox, cardClass, inputClass, messageOf, smallBtn, useDay } from '@/components/maternal-child/ui';
import { todayString, type DueChild, type Paginated, type ScheduleItem } from '@/lib/maternal-child';

type StatusFilter = 'ALL' | 'DUE' | 'OVERDUE';
const FILTERS: StatusFilter[] = ['ALL', 'DUE', 'OVERDUE'];

/** EPI session / defaulter tracing: children with doses due or overdue, recorded in two clicks */
export default function VaccinationSessionPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const day = useDay();
  const canRecord = user?.role === 'ADMIN' || user?.role === 'DOCTOR' || user?.role === 'NURSE';
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [on, setOn] = useState(todayString());
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<DueChild> | null>(null);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<{ child: DueChild; item: ScheduleItem } | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await api.getImmunizationsDue({ on, status, page, limit: 20 });
      if (mine !== seq.current) return;
      setResult(res);
      setError('');
    } catch (err) {
      if (mine === seq.current) setError(messageOf(err, t('mc.epi.loadFailed')));
    }
  }, [on, status, page, t]);

  // Load now and whenever the filters change (shared helper, no polling)
  usePolling(load, null);

  const pagination = result?.pagination;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('mc.epi.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('mc.epi.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1" role="group" aria-label={t('mc.epi.doses')}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={status === f}
              onClick={() => {
                setStatus(f);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${status === f ? 'bg-brand text-white' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              {t(`mc.epi.filter.${f}`)}
            </button>
          ))}
        </div>
        <label className="text-sm">
          <span className="block text-gray-600 dark:text-gray-300 mb-1">{t('mc.epi.on')}</span>
          <input
            type="date"
            value={on}
            onChange={(e) => {
              setOn(e.target.value);
              setPage(1);
            }}
            className={inputClass}
          />
        </label>
        {pagination && <p className="text-sm text-gray-500 dark:text-gray-400 sm:ml-auto">{t('mc.epi.total', { n: pagination.total })}</p>}
      </div>

      <ErrorBox message={error} />
      {!result && !error && <p className="text-sm text-gray-500">{t('mc.loading')}</p>}
      {result && result.data.length === 0 && <div className={`${cardClass} p-8 text-center text-sm text-gray-500 dark:text-gray-400`}>{t('mc.epi.none')}</div>}

      {result && result.data.length > 0 && (
        <ul className="space-y-3">
          {result.data.map((child) => {
            const name = `${child.patient.firstName} ${child.patient.lastName}`;
            return (
              <li key={child.patient.id} className={`${cardClass} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {[child.patient.patientId, child.ageLabel, child.patient.guardianName ? t('mc.epi.guardian', { name: child.patient.guardianName }) : null, child.patient.phoneNumber]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <Link href={`/dashboard/patients/${child.patient.id}`} className={smallBtn}>{t('mc.epi.openRecord')}</Link>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {child.items.map((item) => (
                    <li key={`${item.vaccineCode}-${item.doseNumber}`}>
                      {canRecord ? (
                        <button
                          type="button"
                          onClick={() => setRecording({ child, item })}
                          className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-left hover:border-brand hover:bg-canvas dark:hover:bg-gray-700"
                          aria-label={`${t('mc.vax.record')} ${item.label} — ${name}`}
                        >
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</span>
                          <VaccineStatusChip status={item.status} />
                          <span className="text-xs text-gray-500 dark:text-gray-400">{day(item.dueOn)}</span>
                        </button>
                      ) : (
                        <span className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-1.5">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</span>
                          <VaccineStatusChip status={item.status} />
                          <span className="text-xs text-gray-500 dark:text-gray-400">{day(item.dueOn)}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={smallBtn}>{t('mc.prev')}</button>
          <span className="text-sm text-gray-600 dark:text-gray-300">{t('mc.pageOf', { page: pagination.page, total: pagination.totalPages })}</span>
          <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className={smallBtn}>{t('mc.next')}</button>
        </div>
      )}

      {recording && (
        <RecordDoseDialog
          patient={{ id: recording.child.patient.id, name: `${recording.child.patient.firstName} ${recording.child.patient.lastName}` }}
          items={recording.child.items}
          initial={recording.item}
          onClose={() => setRecording(null)}
          onSaved={() => {
            setRecording(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
