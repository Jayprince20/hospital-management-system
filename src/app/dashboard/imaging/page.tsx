'use client';

import { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, type ImagingModality, type ImagingOrderStatus, type ImagingOrderSummary, type ImagingStats } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { usePolling } from '@/components/inpatient/ui';
import { MODALITIES, WORKLIST_TABS, sortWorklist } from '@/lib/imaging';
import { CancelOrderDialog, CriticalBadge, ImagingStatusBadge, ModalityBadge, PriorityBadge, ScheduleDialog } from '@/components/imaging';
import { cardClass, inputClass, messageOf, smallBtn } from '@/components/imaging/ui';

type Dialog = { kind: 'schedule' | 'cancel'; order: ImagingOrderSummary } | null;

// useSearchParams needs a Suspense boundary for static rendering
export default function ImagingWorklistPage() {
  return (
    <Suspense fallback={null}>
      <ImagingWorklist />
    </Suspense>
  );
}

function ImagingWorklist() {
  const { t, formatDateTime, formatTime } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const role = user?.role;
  const initialStatus = (params.get('status') as ImagingOrderStatus | null) ?? 'ORDERED';
  const [status, setStatus] = useState<ImagingOrderStatus | 'CANCELLED'>(WORKLIST_TABS.includes(initialStatus) || initialStatus === 'CANCELLED' ? initialStatus : 'ORDERED');
  const [date, setDate] = useState('');
  const [modality, setModality] = useState<ImagingModality | ''>('');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<ImagingOrderSummary[] | null>(null);
  const [counts, setCounts] = useState<Partial<Record<ImagingOrderStatus, number>>>({});
  const [stats, setStats] = useState<ImagingStats | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);

  const canSchedule = role === 'ADMIN' || role === 'RECEPTIONIST' || role === 'LAB_TECH' || role === 'DOCTOR';
  const canArrive = canSchedule || role === 'NURSE';
  const canCancel = role === 'ADMIN' || role === 'DOCTOR';

  const load = useCallback(async () => {
    try {
      const [res, st] = await Promise.all([
        api.getImagingOrders({ status, modality, date, search: search.trim() || undefined, limit: 100 }),
        api.getImagingStats(date || undefined).catch(() => null),
      ]);
      setOrders(sortWorklist(res.orders));
      setCounts(res.counts);
      setStats(st);
      setError('');
    } catch (err) {
      setError(messageOf(err, t('img.loadFailed')));
      setOrders((prev) => prev ?? []);
    }
  }, [status, modality, date, search, t]);

  usePolling(load, 30000);

  const chooseStatus = (s: ImagingOrderStatus | 'CANCELLED') => {
    setStatus(s);
    setOrders(null);
    router.replace(`/dashboard/imaging?status=${s}`);
  };

  const arrive = async (order: ImagingOrderSummary) => {
    try {
      await api.updateImagingOrder(order.id, { action: 'arrive' });
      toast.success(t('img.arrive.done', { name: order.patient.name }));
      load();
    } catch (err) {
      toast.error(t('img.actionFailed'), messageOf(err, ''));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('img.worklist.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('img.worklist.subtitle')}</p>
        </div>
        {role === 'ADMIN' && (
          <Link href="/dashboard/imaging/exams" className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">{t('img.exams.link')}</Link>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`${cardClass} p-4`}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('img.stats.pendingReports')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pendingReports}</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('img.stats.reportedToday')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.byStatus.REPORTED ?? 0}</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('img.stats.avgDelay')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgOrderToReportHours == null ? '—' : t('img.stats.hours', { count: Math.round(stats.avgOrderToReportHours * 10) / 10 })}</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('img.stats.critical')}</p>
            <p className={`text-2xl font-bold ${stats.criticalToday > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{stats.criticalToday}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('img.worklist.tabs')}>
        {[...WORKLIST_TABS, 'CANCELLED' as const].map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            onClick={() => chooseStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${status === s ? 'bg-lime-600 border-lime-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            {t(`img.tab.${s}`)}
            {s !== 'CANCELLED' && counts[s] !== undefined && <span className="ml-1.5 text-xs opacity-80">({counts[s]})</span>}
          </button>
        ))}
      </div>

      <div className={`${cardClass} p-4 grid grid-cols-1 md:grid-cols-3 gap-3`}>
        <div>
          <label htmlFor="img-filter-date" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('img.filter.date')}</label>
          <input id="img-filter-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="img-filter-modality" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('img.filter.modality')}</label>
          <select id="img-filter-modality" value={modality} onChange={(e) => setModality(e.target.value as ImagingModality | '')} className={inputClass}>
            <option value="">{t('img.filter.allModalities')}</option>
            {MODALITIES.map((m) => (
              <option key={m} value={m}>{t(`img.modality.${m}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="img-filter-search" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('img.filter.search')}</label>
          <input id="img-filter-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('img.filter.searchPlaceholder')} className={inputClass} />
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}

      <div className={`${cardClass} overflow-x-auto`}>
        {orders === null ? (
          <p className="p-6 text-sm text-gray-500">{t('img.loading')}</p>
        ) : orders.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('img.worklist.empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">{t('img.col.exam')}</th>
                <th className="px-4 py-2">{t('img.col.patient')}</th>
                <th className="px-4 py-2">{t('img.col.when')}</th>
                <th className="px-4 py-2">{t('img.col.doctor')}</th>
                <th className="px-4 py-2">{t('img.col.status')}</th>
                <th className="px-4 py-2 text-right">{t('img.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {orders.map((o) => (
                <tr key={o.id} className={o.priority === 'STAT' ? 'bg-red-50/60 dark:bg-red-900/10' : ''}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/imaging/${o.id}`} className="font-medium text-gray-900 dark:text-white hover:underline">{o.exam.name}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <ModalityBadge modality={o.exam.modality} />
                      <PriorityBadge priority={o.priority} />
                      {o.isCritical && <CriticalBadge />}
                      <span className="text-xs text-gray-500 dark:text-gray-400">{o.number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900 dark:text-white">{o.patient.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{o.patient.patientId}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {o.scheduledAt ? (
                      <>
                        {formatDateTime(o.scheduledAt)}
                        {o.room && <span className="block text-xs text-gray-500">{o.room}</span>}
                      </>
                    ) : (
                      <span className="text-xs text-gray-500">{t('img.worklist.requestedAt', { time: formatDateTime(o.createdAt) })}</span>
                    )}
                    {o.arrivedAt && <span className="block text-xs text-purple-700 dark:text-purple-300">{t('img.worklist.arrivedAt', { time: formatTime(o.arrivedAt) })}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{o.orderedBy.name}</td>
                  <td className="px-4 py-3"><ImagingStatusBadge status={o.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {canSchedule && (o.status === 'ORDERED' || o.status === 'SCHEDULED') && (
                        <button type="button" onClick={() => setDialog({ kind: 'schedule', order: o })} className={smallBtn}>{o.status === 'SCHEDULED' ? t('img.action.reschedule') : t('img.action.schedule')}</button>
                      )}
                      {canArrive && (o.status === 'ORDERED' || o.status === 'SCHEDULED') && (
                        <button type="button" onClick={() => arrive(o)} className={smallBtn}>{t('img.action.arrive')}</button>
                      )}
                      <Link href={`/dashboard/imaging/${o.id}`} className={smallBtn}>{t('img.open')}</Link>
                      {canCancel && o.status !== 'REPORTED' && o.status !== 'CANCELLED' && (
                        <button type="button" onClick={() => setDialog({ kind: 'cancel', order: o })} className={`${smallBtn} text-red-600 dark:text-red-400`}>{t('img.action.cancel')}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dialog?.kind === 'schedule' && (
        <ScheduleDialog
          order={dialog.order}
          onClose={() => setDialog(null)}
          onDone={(o) => {
            setDialog(null);
            toast.success(t('img.schedule.done', { number: o.number }));
            load();
          }}
        />
      )}
      {dialog?.kind === 'cancel' && (
        <CancelOrderDialog
          order={dialog.order}
          onClose={() => setDialog(null)}
          onDone={(o) => {
            setDialog(null);
            toast.success(t('img.cancelOrder.done', { number: o.number }));
            load();
          }}
        />
      )}
    </div>
  );
}
