'use client';

import { useEffect, useState } from 'react';
import { api, localizeServerMessage, type MobileMoneyReconciliation } from '@/lib/api';
import { toLocalDateString } from '@/lib/formatters';
import { useLanguage } from '@/context/language-context';

const STATUSES = ['SUCCESSFUL', 'PENDING', 'PROCESSING', 'FAILED', 'EXPIRED', 'CANCELLED'] as const;
const OPERATORS = ['MTN_MOMO', 'ORANGE_MONEY'] as const;

/** One day of mobile money per operator and status, to check against MTN and Orange statements */
export function MobileMoneyReconciliationPanel() {
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const [date, setDate] = useState(() => toLocalDateString());
  const [data, setData] = useState<MobileMoneyReconciliation | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getMobileMoneyReconciliation(date)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const cell = (operator: string, status: string) => data?.transactions?.[operator]?.[status];
  const operatorLabel = (operator: string) => (operator === 'MTN_MOMO' ? t('pay.mtn') : operator === 'ORANGE_MONEY' ? t('pay.orange') : operator);
  const operators = Array.from(new Set([...OPERATORS, ...Object.keys(data?.transactions ?? {})]));
  const hasActivity = operators.some((op) => STATUSES.some((st) => (cell(op, st)?.count ?? 0) > 0));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 dark:border-gray-700 p-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('pay.recon.title')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('pay.recon.subtitle')}</p>
          {data && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('pay.recon.mode', { mode: data.mode === 'live' ? t('pay.recon.modeLive') : t('pay.recon.modeSandbox') })}
            </p>
          )}
        </div>
        <label className="text-sm text-gray-700 dark:text-gray-300">
          <span className="mr-2">{t('pay.recon.date')}</span>
          <input
            type="date"
            value={date}
            max={toLocalDateString()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-gray-900 dark:text-white"
          />
        </label>
      </div>

      {failed ? (
        <p className="p-4 text-sm text-red-600 dark:text-red-400">{t('pay.recon.loadFailed')}</p>
      ) : !data ? (
        <p className="p-4 text-sm text-gray-500">{t('common.loading')}</p>
      ) : (
        <div className="space-y-4 p-4">
          {!hasActivity ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('pay.recon.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-2 pr-4">{t('pay.recon.operator')}</th>
                    {STATUSES.map((status) => (
                      <th key={status} className="px-3 py-2 text-right">{t(`pay.status.${status}`)}</th>
                    ))}
                    <th className="py-2 pl-3 text-right">{t('pay.recon.credited')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-900 dark:text-white">
                  {operators.map((operator) => (
                    <tr key={operator}>
                      <td className="py-2 pr-4 font-medium">{operatorLabel(operator)}</td>
                      {STATUSES.map((status) => {
                        const totals = cell(operator, status);
                        return (
                          <td key={status} className="px-3 py-2 text-right whitespace-nowrap">
                            {totals && totals.count > 0 ? (
                              <>
                                <span className="block">{formatCurrency(totals.amount)}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">× {totals.count}</span>
                              </>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 pl-3 text-right font-semibold whitespace-nowrap text-green-700 dark:text-green-400">
                        {formatCurrency(data.credited?.[operator]?.amount ?? 0)}
                        <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">× {data.credited?.[operator]?.count ?? 0}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('pay.recon.invalidWebhooks')}</p>
              <p className={`text-lg font-semibold ${data.invalidWebhooks.length > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                {data.invalidWebhooks.length}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('pay.recon.unprocessed')}</p>
              <p className={`text-lg font-semibold ${data.unprocessedWebhooks > 0 ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`}>
                {data.unprocessedWebhooks}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-900 dark:text-white">{t('pay.recon.needsReview')}</p>
            {data.needsReview.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('pay.recon.needsReviewEmpty')}</p>
            ) : (
              <ul className="space-y-2">
                {data.needsReview.map((tx) => (
                  <li key={tx.id} className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm">
                    <p className="font-medium text-red-800 dark:text-red-300">
                      {operatorLabel(tx.provider)} · {formatCurrency(tx.amount)} · {formatDateTime(tx.initiatedAt)}
                    </p>
                    {tx.failureReason && <p className="text-red-700 dark:text-red-300">{localizeServerMessage(tx.failureReason)}</p>}
                    <p className="font-mono text-xs text-red-700/80 dark:text-red-300/80">{tx.providerRefId ?? tx.externalId}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
