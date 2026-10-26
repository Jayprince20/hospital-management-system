'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { usePolling } from '@/components/inpatient/ui';
import { AncAlertChip } from '@/components/maternal-child';
import { ErrorBox, cardClass, messageOf, smallBtn, useDay } from '@/components/maternal-child/ui';
import { formatGA, type CaseloadFilter, type CaseloadItem, type Paginated } from '@/lib/maternal-child';

const FILTERS: CaseloadFilter[] = ['all', 'overdue', 'alerts', 'due-soon'];

/** Ongoing pregnancies followed here, by due date: who is late for a contact, who has alerts */
export default function AntenatalCaseloadPage() {
  const { t } = useLanguage();
  const day = useDay();
  const [filter, setFilter] = useState<CaseloadFilter>('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<CaseloadItem> | null>(null);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await api.getAntenatalCaseload({ status: 'ONGOING', filter, page, limit: 20 });
      if (mine !== seq.current) return;
      setResult(res);
      setError('');
    } catch (err) {
      if (mine === seq.current) setError(messageOf(err, t('mc.anc.loadFailed')));
    }
  }, [filter, page, t]);

  // Load now and whenever the filters change (shared helper, no polling)
  usePolling(load, null);

  const pagination = result?.pagination;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('mc.anc.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('mc.anc.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1" role="group" aria-label={t('mc.preg.alerts')}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f ? 'bg-brand text-white' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              {t(`mc.anc.filter.${f}`)}
            </button>
          ))}
        </div>
        {pagination && <p className="text-sm text-gray-500 dark:text-gray-400 sm:ml-auto">{t('mc.anc.total', { n: pagination.total })}</p>}
      </div>

      <ErrorBox message={error} />
      {!result && !error && <p className="text-sm text-gray-500">{t('mc.loading')}</p>}
      {result && result.data.length === 0 && <div className={`${cardClass} p-8 text-center text-sm text-gray-500 dark:text-gray-400`}>{t('mc.anc.none')}</div>}

      {result && result.data.length > 0 && (
        <div className={`${cardClass} overflow-hidden`}>
          {/* Cards on phones, a table from md up */}
          <ul className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
            {result.data.map((item) => (
              <li key={item.pregnancyId} className="p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{item.patient.firstName} {item.patient.lastName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.patient.patientId}</p>
                  </div>
                  <Link href={`/dashboard/patients/${item.patient.id}`} className={smallBtn}>{t('mc.anc.open')}</Link>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {t('mc.preg.gaValue', { ga: formatGA(item.gestationalAge) })} · {t('mc.preg.edd')} {day(item.edd)}
                </p>
                <p className={`text-xs ${item.overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                  {t('mc.anc.col.next')} : {item.nextContact ? `${t('mc.col.contact')} ${item.nextContact.number} · ${day(item.nextContact.targetDate)}` : t('mc.preg.noNextContact')}
                </p>
                <div className="flex flex-wrap gap-1">
                  {item.overdue && <span className="px-2 py-0.5 rounded-full border text-xs font-semibold bg-red-100 text-red-700 border-red-200">{t('mc.preg.overdue')}</span>}
                  {item.alerts.map((a) => <AncAlertChip key={a} code={a} />)}
                </div>
              </li>
            ))}
          </ul>
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">{t('mc.anc.col.patient')}</th>
                <th className="px-4 py-2">{t('mc.col.ga')}</th>
                <th className="px-4 py-2">{t('mc.preg.edd')}</th>
                <th className="px-4 py-2">{t('mc.anc.col.last')}</th>
                <th className="px-4 py-2">{t('mc.anc.col.next')}</th>
                <th className="px-4 py-2">{t('mc.col.alerts')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-900 dark:text-gray-100">
              {result.data.map((item) => (
                <tr key={item.pregnancyId} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.patient.firstName} {item.patient.lastName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.patient.patientId}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatGA(item.gestationalAge)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{day(item.edd)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{day(item.lastVisitDate)}</td>
                  <td className={`px-4 py-3 whitespace-nowrap ${item.overdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                    {item.nextContact ? `${t('mc.col.contact')} ${item.nextContact.number} · ${day(item.nextContact.targetDate)}` : t('mc.preg.noNextContact')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.overdue && <span className="px-2 py-0.5 rounded-full border text-xs font-semibold bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800">{t('mc.preg.overdue')}</span>}
                      {item.alerts.map((a) => <AncAlertChip key={a} code={a} />)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/patients/${item.patient.id}`} className={smallBtn}>{t('mc.anc.open')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={smallBtn}>{t('mc.prev')}</button>
          <span className="text-sm text-gray-600 dark:text-gray-300">{t('mc.pageOf', { page: pagination.page, total: pagination.totalPages })}</span>
          <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className={smallBtn}>{t('mc.next')}</button>
        </div>
      )}
    </div>
  );
}
