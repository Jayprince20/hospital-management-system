'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, LabOrder } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { FlaggedValue, cardClass } from './ui';

const isToday = (iso: string | null | undefined) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

/** Doctor dashboard: today's critical lab results on the doctor's own requests */
export function DoctorLabCriticalCard() {
  const { user } = useAuth();
  const { t, formatTime } = useLanguage();
  const [orders, setOrders] = useState<LabOrder[] | null>(null);
  const doctorId = user?.role === 'DOCTOR' ? user.doctorId : undefined;

  useEffect(() => {
    if (!doctorId) return;
    let live = true;
    api
      .getLabOrders({ doctorId, limit: 50 })
      .then((res) => {
        if (!live) return;
        setOrders(
          (res.labOrders ?? []).filter(
            (o) => (o.tests ?? []).some((x) => x.isCritical) && (isToday(o.releasedAt) || isToday(o.completedAt) || isToday(o.createdAt))
          )
        );
      })
      .catch(() => live && setOrders([]));
    return () => {
      live = false;
    };
  }, [doctorId]);

  if (!doctorId || orders === null) return null;

  return (
    <div className={`${cardClass} p-4 ${orders.length ? 'border-red-300 dark:border-red-700' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <h2 className={`text-base font-semibold ${orders.length ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{t('labw.doctorCard.title')}</h2>
        <Link href="/dashboard/lab-results" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">{t('labw.doctorCard.all')}</Link>
      </div>
      {orders.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('labw.doctorCard.none')}</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {orders.slice(0, 5).map((o) => (
            <li key={o.id} className="py-2">
              <Link href={`/dashboard/laboratory/orders/${o.id}`} className="block hover:bg-red-50/50 dark:hover:bg-red-900/10 rounded">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {o.patientName} <span className="text-xs text-gray-500 dark:text-gray-400">· {formatTime(o.releasedAt ?? o.completedAt ?? o.createdAt)}</span>
                </p>
                <p className="text-sm">
                  {(o.tests ?? [])
                    .filter((x) => x.isCritical)
                    .map((x) => (
                      <span key={x.id} className="mr-3">
                        {x.name} : <FlaggedValue value={x.result ?? '—'} unit={x.unit} flag={x.flag ?? 'HH'} />
                        {x.status === 'ENTERED' && <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">({t('labw.results.notValidatedShort')})</span>}
                      </span>
                    ))}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
