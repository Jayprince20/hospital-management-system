'use client';

import { useEffect, useState } from 'react';
import { api, type PharmacySale } from '@/lib/api';
import { useLanguage } from '@/context/language-context';

/** Patient portal: what the patient bought at the hospital pharmacy */
export function MyPharmacyPurchases() {
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const [sales, setSales] = useState<PharmacySale[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .getMyPharmacySales()
      .then((list) => live && setSales(list))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="space-y-3" aria-label={t('pos.portal.title')}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('pos.portal.title')}</h3>
      {failed ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('pos.loadFailed')}</p>
      ) : sales === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('pos.loading')}</p>
      ) : sales.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('pos.portal.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {sales.map((sale) => (
            <li key={sale.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t('pos.portal.sale', { number: sale.number })}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatDateTime(sale.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(sale.total)}</p>
                  {sale.refundedAmount > 0 && <p className="text-xs text-red-600">{t('pos.portal.refunded', { amount: formatCurrency(sale.refundedAmount) })}</p>}
                  {sale.status === 'VOIDED' && <p className="text-xs text-red-600">{t('pos.saleStatus.VOIDED')}</p>}
                </div>
              </div>
              <ul className="mt-2 text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
                {(sale.items ?? []).map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span>{item.description} × {item.quantity}</span>
                    <span>{formatCurrency(item.total)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
