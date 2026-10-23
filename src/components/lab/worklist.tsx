'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, LabStats, LabWorklistOrder } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { usePolling } from '@/components/inpatient/ui';
import { LAB_BUCKETS, LabBucket, bucketsOf, sortLabWorklist } from '@/lib/lab';
import { ScanPanel } from './scan-panel';
import { ContainerBadge, CriticalMarker, ErrorBox, LabPriorityBadge, SampleStatusChip, cardClass, inputClass, labelClass, messageOf } from './ui';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function LabWorklist() {
  const { t, formatTime, formatDate } = useLanguage();
  const [date, setDate] = useState(today());
  const [bucket, setBucket] = useState<LabBucket>('toCollect');
  const [orders, setOrders] = useState<LabWorklistOrder[] | null>(null);
  const [serverCounts, setServerCounts] = useState<Partial<Record<LabBucket, number>> | null>(null);
  const [stats, setStats] = useState<LabStats | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([api.getLabWorklist({ date: date || undefined }), api.getLabStats(date || undefined).catch(() => null)]);
      setOrders(list.orders);
      setServerCounts(list.counts ?? null);
      setStats(s);
      setError('');
    } catch (err) {
      setError(messageOf(err, t('labw.loadFailed')));
    }
  }, [date, t]);

  // Loads now and every 30 s while the tab is visible
  usePolling(load, 30000);

  const withBuckets = useMemo(() => (orders ?? []).map((o) => ({ order: o, buckets: bucketsOf(o) })), [orders]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(LAB_BUCKETS.map((b) => [b, 0])) as Record<LabBucket, number>;
    for (const { buckets } of withBuckets) for (const b of buckets) c[b] += 1;
    return { ...c, ...(serverCounts ?? {}) } as Record<LabBucket, number>;
  }, [withBuckets, serverCounts]);
  const shown = useMemo(() => sortLabWorklist(withBuckets.filter((x) => x.buckets.includes(bucket)).map((x) => x.order)), [withBuckets, bucket]);

  return (
    <div className="space-y-4">
      <ScanPanel onChanged={load} />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(
            [
              ['received', stats.received],
              ['released', stats.released],
              ['pendingValidation', stats.pendingValidation],
              ['rejected', stats.rejected],
              ['criticalToday', stats.criticalToday],
              ['turnaround', stats.avgTurnaroundHours == null ? '—' : `${stats.avgTurnaroundHours.toLocaleString('fr', { maximumFractionDigits: 1 })} h`],
            ] as Array<[string, number | string]>
          ).map(([key, value]) => (
            <div key={key} className={`${cardClass} p-3`}>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t(`labw.stats.${key}`)}</p>
              <p className={`text-xl font-semibold ${key === 'criticalToday' && Number(value) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className={`${cardClass} p-4`}>
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
          <div role="tablist" className="flex flex-wrap gap-2">
            {LAB_BUCKETS.map((b) => (
              <button
                key={b}
                role="tab"
                aria-selected={bucket === b}
                onClick={() => setBucket(b)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  bucket === b ? 'bg-lime-600 border-lime-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {t(`labw.bucket.${b}`)} <span className="ml-1 opacity-80">({counts[b] ?? 0})</span>
              </button>
            ))}
          </div>
          <div className="w-48">
            <label htmlFor="lab-date" className={labelClass}>{t('labw.date')}</label>
            <input id="lab-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        {error && <div className="mt-3"><ErrorBox message={error} /></div>}

        <div className="mt-4 overflow-x-auto">
          {orders === null ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">{t('labw.loading')}</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">{t('labw.empty')}</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-3">{t('labw.col.order')}</th>
                  <th className="py-2 pr-3">{t('labw.col.patient')}</th>
                  <th className="py-2 pr-3">{t('labw.col.prescriber')}</th>
                  <th className="py-2 pr-3">{t('labw.col.tubes')}</th>
                  <th className="py-2 pr-3">{t('labw.col.progress')}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {shown.map((o) => {
                  const total = o.counts.pending + o.counts.entered + o.counts.validated + o.counts.released;
                  return (
                    <tr key={o.id} className={o.hasCritical ? 'bg-red-50/60 dark:bg-red-900/10' : ''}>
                      <td className="py-2.5 pr-3 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-gray-900 dark:text-white">{o.number ?? o.id.slice(0, 8)}</span>
                          <LabPriorityBadge priority={o.priority} />
                          {o.hasCritical && <CriticalMarker />}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(o.createdAt, { day: 'numeric', month: 'short' })} {formatTime(o.createdAt)}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        <p className="text-gray-900 dark:text-white">{o.patient.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {o.patient.patientId}
                          {o.patient.sex ? ` · ${t(`labw.sex.${o.patient.sex}`)}` : ''}
                          {o.patient.age != null ? ` · ${t('labw.years', { n: o.patient.age })}` : ''}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 align-top text-gray-700 dark:text-gray-300">{o.doctorName}</td>
                      <td className="py-2.5 pr-3 align-top">
                        <div className="space-y-1">
                          {o.samples.length === 0 ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400">{t('labw.noTubes')}</span>
                          ) : (
                            o.samples.map((s) => (
                              <div key={s.barcode} className="flex items-center gap-2">
                                <ContainerBadge container={s.container} />
                                <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{s.barcode}</span>
                                <SampleStatusChip status={s.status} />
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 align-top text-xs text-gray-700 dark:text-gray-300">
                        {t('labw.progress', { released: o.counts.released, total })}
                        {o.counts.entered > 0 && <p className="text-amber-700 dark:text-amber-400">{t('labw.toValidateN', { n: o.counts.entered })}</p>}
                      </td>
                      <td className="py-2.5 align-top text-right">
                        <Link href={`/dashboard/laboratory/orders/${o.id}`} className="text-lime-700 dark:text-lime-400 hover:underline">
                          {t('labw.open')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
