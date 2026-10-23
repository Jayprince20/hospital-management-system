'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Receivables } from '@/lib/api';
import { useLanguage } from '@/context/language-context';

const BUCKETS = ['current', 'd31_60', 'd61_90', 'd90plus'] as const;
const BUCKET_COLORS: Record<(typeof BUCKETS)[number], string> = {
  current: 'text-gray-900 dark:text-white',
  d31_60: 'text-yellow-700 dark:text-yellow-400',
  d61_90: 'text-orange-600 dark:text-orange-400',
  d90plus: 'text-red-600 dark:text-red-400',
};

export default function ReceivablesPage() {
  const { t, formatCurrency, formatDate, formatDateTime } = useLanguage();
  const [data, setData] = useState<Receivables | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getReceivables().then(setData).catch((err) => setError(err instanceof Error ? err.message : t('ins.loadFailed')));
  }, [t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ins.receivables.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('ins.receivables.subtitle')}</p>
        </div>
        <Link href="/dashboard/claims" className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          {t('ins.claims.title')}
        </Link>
      </div>

      {error && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}
      {!data && !error && <div className="flex justify-center h-48 items-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lime-600" /></div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.receivables.insurers')}</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(data.totals.outstanding)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.receivables.unbilled')}</p>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(data.totals.unbilled)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('ins.receivables.unbilledHint')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.receivables.over90')}</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(data.totals.d90plus)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.receivables.patients')}</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(data.patient.outstanding)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('ins.receivables.patientInvoices', { count: data.patient.invoiceCount })}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ins.receivables.byPayer')}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('ins.receivables.asOf', { date: formatDateTime(data.asOf) })}</p>
            </div>
            {data.payers.length === 0 ? (
              <p className="text-center py-12 text-gray-500 dark:text-gray-400">{t('ins.receivables.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                      <th className="px-4 py-3">{t('ins.claims.payer')}</th>
                      {BUCKETS.map((b) => <th key={b} className="px-4 py-3 text-right">{t(`ins.bucket.${b}`)}</th>)}
                      <th className="px-4 py-3 text-right">{t('ins.receivables.total')}</th>
                      <th className="px-4 py-3 text-right">{t('ins.receivables.unbilled')}</th>
                      <th className="px-4 py-3 text-right">{t('ins.receivables.openClaims')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {data.payers.map((row) => (
                      <tr key={row.payerId}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">{row.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {row.code}{row.oldestClaimDate ? ` · ${t('ins.receivables.oldest', { date: formatDate(row.oldestClaimDate) })}` : ''}
                          </p>
                        </td>
                        {BUCKETS.map((b) => (
                          <td key={b} className={`px-4 py-3 text-right ${row[b] > 0 ? BUCKET_COLORS[b] : 'text-gray-400'}`}>{formatCurrency(row[b])}</td>
                        ))}
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(row.outstanding)}</td>
                        <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(row.unbilled)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href="/dashboard/claims" className="text-lime-600 hover:underline">{row.openClaims}</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700/50 font-semibold">
                    <tr>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{t('ins.receivables.total')}</td>
                      {BUCKETS.map((b) => <td key={b} className={`px-4 py-3 text-right ${BUCKET_COLORS[b]}`}>{formatCurrency(data.totals[b])}</td>)}
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{formatCurrency(data.totals.outstanding)}</td>
                      <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(data.totals.unbilled)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
