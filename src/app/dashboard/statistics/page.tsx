'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { hasPermission } from '@/lib/rbac';
import { selectableYears, type MonthlyReportSummary } from '@/lib/statistics';
import { ErrorBox, ReportStatusBadge, cardClass, cancelBtn, inputClass, messageOf } from '@/components/statistics/ui';

export default function StatisticsPage() {
  const { t, formatDate } = useLanguage();
  const { user } = useAuth();
  const canManage = hasPermission(user?.role, 'statistics:manage');
  const years = selectableYears();
  const [year, setYear] = useState(years[0]);
  const [months, setMonths] = useState<MonthlyReportSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    api
      .getMonthlyReports(year)
      .then((list) => {
        if (!current) return;
        setMonths(list);
        setError('');
      })
      .catch((err) => current && setError(messageOf(err, t('stat.loadFailed'))));
    return () => {
      current = false;
    };
  }, [year, t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('stat.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('stat.subtitle')}</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1" htmlFor="stat-year">{t('stat.year')}</label>
            <select
              id="stat-year"
              value={year}
              onChange={(e) => {
                setMonths(null);
                setYear(Number(e.target.value));
              }}
              className={inputClass}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {canManage && <Link href="/dashboard/statistics/settings" className={cancelBtn}>{t('stat.settings')}</Link>}
        </div>
      </div>

      <ErrorBox message={error} />
      {!months ? (
        !error && <p className="text-gray-500">{t('stat.loading')}</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {months.map((m) => {
            const body = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white first-letter:uppercase">{m.label}</span>
                  <ReportStatusBadge status={m.status} />
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {m.status === 'FUTURE'
                    ? t('stat.notStarted')
                    : m.status === 'SUBMITTED' && m.submittedAt
                      ? t('stat.submittedOn', { date: formatDate(m.submittedAt) })
                      : m.validatedAt
                        ? t('stat.validatedOn', { date: formatDate(m.validatedAt), name: m.validatedBy?.name ?? '—' })
                        : t('stat.open')}
                </p>
              </>
            );
            return (
              <li key={m.period}>
                {m.status === 'FUTURE' ? (
                  <div className={`${cardClass} p-4 opacity-60`} aria-disabled="true">{body}</div>
                ) : (
                  <Link href={`/dashboard/statistics/${m.period}`} className={`${cardClass} p-4 block hover:border-lime-400 dark:hover:border-lime-600 transition-colors`}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
