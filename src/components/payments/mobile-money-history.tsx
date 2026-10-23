'use client';

import { useEffect, useState } from 'react';
import { api, localizeServerMessage, type MobileMoneyTransaction } from '@/lib/api';
import { useLanguage } from '@/context/language-context';

const STATUS_STYLES: Record<string, string> = {
  SUCCESSFUL: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PROCESSING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  EXPIRED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

/** Mobile money attempts on one invoice, newest first. `refreshKey` reloads after a payment. */
export function MobileMoneyHistory({ invoiceId, refreshKey = 0 }: { invoiceId: string; refreshKey?: number }) {
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const [transactions, setTransactions] = useState<MobileMoneyTransaction[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getInvoiceMobileMoneyTransactions(invoiceId)
      .then((list) => {
        if (!cancelled) {
          setTransactions(list);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId, refreshKey]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{t('pay.history.title')}</h3>
      </div>
      {failed ? (
        <p className="p-4 text-sm text-red-600 dark:text-red-400">{t('pay.history.loadFailed')}</p>
      ) : transactions === null ? (
        <p className="p-4 text-sm text-gray-500">{t('common.loading')}</p>
      ) : transactions.length === 0 ? (
        <p className="p-4 text-sm text-gray-500 dark:text-gray-400">{t('pay.history.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">{t('pay.history.date')}</th>
                <th className="px-4 py-2">{t('pay.history.operator')}</th>
                <th className="px-4 py-2">{t('pay.history.phone')}</th>
                <th className="px-4 py-2 text-right">{t('pay.history.amount')}</th>
                <th className="px-4 py-2">{t('pay.history.status')}</th>
                <th className="px-4 py-2">{t('pay.history.reference')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-900 dark:text-white">
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(tx.initiatedAt)}</td>
                  <td className="px-4 py-2">{tx.provider === 'MTN_MOMO' ? t('pay.mtn') : t('pay.orange')}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{tx.phoneNumber}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{formatCurrency(tx.amount)}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[tx.status] ?? STATUS_STYLES.EXPIRED}`}>
                      {t(`pay.status.${tx.status}`)}
                    </span>
                    {tx.needsReview && (
                      <span className="ml-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">{t('pay.review')}</span>
                    )}
                    {tx.failureReason && !tx.isSuccessful && (
                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{localizeServerMessage(tx.failureReason)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">{tx.providerRefId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
