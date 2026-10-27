'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type ImagingOrderSummary } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { CriticalBadge, cardClass, useIsRadiologist } from './ui';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Doctor dashboard: reports on the doctor's own requests in the last 7 days, critical first */
export function DoctorImagingCard() {
  const { t, formatDateTime } = useLanguage();
  const { user } = useAuth();
  const isRadiologist = useIsRadiologist();
  const [reports, setReports] = useState<ImagingOrderSummary[] | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const doctorId = user?.doctorId;

  useEffect(() => {
    if (!doctorId) return;
    let live = true;
    api
      .getImagingOrders({ orderedById: doctorId, status: 'REPORTED', limit: 30 })
      .then((res) => {
        if (!live) return;
        const since = Date.now() - WEEK_MS;
        const recent = res.orders.filter((o) => new Date(o.reportedAt ?? o.createdAt).getTime() >= since);
        recent.sort((a, b) => Number(Boolean(b.isCritical)) - Number(Boolean(a.isCritical)) || new Date(b.reportedAt ?? b.createdAt).getTime() - new Date(a.reportedAt ?? a.createdAt).getTime());
        setReports(recent.slice(0, 6));
      })
      .catch(() => live && setReports([]));
    return () => {
      live = false;
    };
  }, [doctorId]);

  useEffect(() => {
    if (!isRadiologist) return;
    let live = true;
    api
      .getImagingOrders({ status: 'PERFORMED', limit: 1 })
      .then((res) => live && setPending(res.counts.PERFORMED ?? res.pagination.total))
      .catch(() => live && setPending(null));
    return () => {
      live = false;
    };
  }, [isRadiologist]);

  if (!doctorId) return null;
  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('img.dash.reports')}</h2>
        <Link href="/dashboard/imaging" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">{t('img.dash.openWorklist')}</Link>
      </div>
      {isRadiologist && pending !== null && (
        <Link href="/dashboard/imaging?status=PERFORMED" className="block mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-sm text-amber-900 dark:text-amber-100">
          <span className="text-2xl font-bold mr-2">{pending}</span>
          {t('img.dash.toReport')}
        </Link>
      )}
      {reports === null ? (
        <p className="text-sm text-gray-500">{t('img.loading')}</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('img.dash.noReports')}</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {reports.map((o) => (
            <li key={o.id}>
              <Link href={`/dashboard/imaging/${o.id}`} className="flex items-center justify-between gap-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">{o.patient.name} · {o.exam.name}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{o.reportedAt ? formatDateTime(o.reportedAt) : o.number}</span>
                </span>
                {o.isCritical && <CriticalBadge />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
