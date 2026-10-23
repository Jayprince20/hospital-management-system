'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, type PendingPrescription } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { ErrorBox, cardClass, inputClass, messageOf, primaryBtn, usePolling } from '@/components/pharmacy';

export default function PharmacyPrescriptionsPage() {
  const { t, formatDateTime } = useLanguage();
  const [prescriptions, setPrescriptions] = useState<PendingPrescription[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    api
      .getPendingPharmacyPrescriptions()
      .then((list) => {
        setPrescriptions(list);
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('pos.loadFailed'))));
  }, [t]);
  usePolling(load, 30000);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!prescriptions) return [];
    if (!q) return prescriptions;
    return prescriptions.filter((p) => `${p.patient.name} ${p.patient.patientId} ${p.doctorName}`.toLowerCase().includes(q));
  }, [prescriptions, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pos.rxQueue.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('pos.rxQueue.subtitle')}</p>
        </div>
        <Link href="/dashboard/pharmacy/pos" className={primaryBtn}>{t('nav.pharmacyPos')}</Link>
      </div>

      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('pos.rxQueue.search')} className={`${inputClass} max-w-md`} aria-label={t('pos.rxQueue.search')} />
      <ErrorBox message={error} />

      {prescriptions === null && !error ? (
        <p className="text-sm text-gray-500">{t('pos.loading')}</p>
      ) : visible.length === 0 ? (
        <div className={`${cardClass} p-8 text-center text-sm text-gray-500 dark:text-gray-400`}>{t('pos.rxQueue.empty')}</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {visible.map((rx) => {
            const remaining = rx.items.filter((i) => !i.isDispensed);
            const shortItems = remaining.filter((i) => i.stockSellable < i.quantity);
            return (
              <div key={rx.id} className={`${cardClass} p-4 space-y-3`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{rx.patient.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {rx.patient.patientId} · {t('pos.rx.byDoctor', { name: rx.doctorName })} · {formatDateTime(rx.createdAt)}
                    </p>
                  </div>
                  {remaining.length < rx.items.length && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">{t('pos.rxQueue.partial')}</span>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {rx.items.map((item) => (
                    <li key={item.id} className={`flex items-start justify-between gap-3 text-sm ${item.isDispensed ? 'opacity-50 line-through' : ''}`}>
                      <span className="text-gray-800 dark:text-gray-200">
                        <span className="font-medium">{item.name} {item.strength}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{item.dosage} · {item.frequency} · {item.duration}</span>
                      </span>
                      <span className="text-right whitespace-nowrap">
                        <span className="block text-gray-900 dark:text-white">× {item.quantity}</span>
                        {!item.isDispensed && (
                          <span className={`block text-xs ${item.stockSellable < item.quantity ? 'text-red-600 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                            {t('pos.search.stock', { count: item.stockSellable })}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {shortItems.length > 0 && <p className="text-xs text-red-600 dark:text-red-400">{t('pos.rxQueue.short', { list: shortItems.map((i) => i.name).join(', ') })}</p>}
                <div className="flex justify-end">
                  <Link href={`/dashboard/pharmacy/pos?prescriptionId=${rx.id}`} className={primaryBtn}>{t('pos.rxQueue.dispense')}</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
