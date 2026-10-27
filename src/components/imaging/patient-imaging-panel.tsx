'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { api, type ImagingOrderSummary } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { NewImagingOrderDialog, type ImagingPatient } from './order-dialog';
import { usePolling } from '@/components/inpatient/ui';
import { CriticalBadge, ImagingStatusBadge, ModalityBadge, PriorityBadge, cardClass, primaryBtn, smallBtn, useImagingPdf } from './ui';

/** "Imagerie" tab of the patient record: the patient's exams, and a new request for doctors */
export function PatientImagingPanel({ patient }: { patient: ImagingPatient }) {
  const { t, formatDate } = useLanguage();
  const { user } = useAuth();
  const canOrder = user?.role === 'DOCTOR' || user?.role === 'ADMIN';
  const { open, busy } = useImagingPdf();
  const [orders, setOrders] = useState<ImagingOrderSummary[] | null>(null);
  const [error, setError] = useState('');
  const [ordering, setOrdering] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getImagingOrders({ patientId: patient.id, limit: 50 });
      setOrders(res.orders);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('img.loadFailed'));
      setOrders([]);
    }
  }, [patient.id, t]);

  // Load on mount and when the filters change (shared helper, no polling)
  usePolling(load, null);

  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('img.panel.title')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('img.panel.subtitle')}</p>
        </div>
        {canOrder && (
          <button type="button" onClick={() => setOrdering(true)} className={primaryBtn}>{t('img.order.new')}</button>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}
      {orders === null ? (
        <p className="text-sm text-gray-500">{t('img.loading')}</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('img.panel.none')}</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {orders.map((o) => (
            <li key={o.id} className="py-3 flex flex-wrap items-center gap-3 justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
                  {o.exam.name} <ModalityBadge modality={o.exam.modality} /> <PriorityBadge priority={o.priority} />
                  {o.isCritical && <CriticalBadge />}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {o.number} · {formatDate(o.scheduledAt ?? o.createdAt)} · {o.orderedBy.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ImagingStatusBadge status={o.status} />
                {o.status === 'REPORTED' && (
                  <button type="button" onClick={() => open(o.id)} disabled={busy === o.id} className={smallBtn}>{t('img.report.pdf')}</button>
                )}
                <Link href={`/dashboard/imaging/${o.id}`} className={smallBtn}>{t('img.open')}</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      {ordering && (
        <NewImagingOrderDialog
          patient={patient}
          onClose={() => setOrdering(false)}
          onCreated={() => load()}
        />
      )}
    </div>
  );
}
