'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, type Ward, type WardMar, type WardMarItem } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { DoseBadge, RecordDoseDialog, cardClass, usePolling } from '@/components/inpatient';
import { MAR_WARD_STORAGE_KEY } from '@/components/inpatient/dashboard-cards';
import { readStored, writeStored } from '@/lib/queue';

const REFRESH_MS = 30_000;

export default function MarRoundPage() {
  const { t, formatDateTime } = useLanguage();
  const toast = useToast();
  const [wards, setWards] = useState<Ward[] | null>(null);
  const [wardId, setWardId] = useState<string>('');
  const [mar, setMar] = useState<WardMar | null>(null);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<{ item: WardMarItem; status: 'GIVEN' | 'REFUSED' } | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    api
      .getWards({ active: true })
      .then((board) => {
        setWards(board.wards);
        const stored = readStored(MAR_WARD_STORAGE_KEY);
        const initial = board.wards.find((w) => w.id === stored) ?? board.wards.find((w) => w.counts.occupied > 0) ?? board.wards[0];
        if (initial) setWardId(initial.id);
      })
      .catch((err) => {
        setWards([]);
        setError(err instanceof Error ? err.message : t('inp.loadFailed'));
      });
  }, [t]);

  const load = useCallback(async () => {
    if (!wardId) return;
    const mine = ++seq.current;
    try {
      const data = await api.getWardMar(wardId);
      if (mine !== seq.current) return;
      setMar(data);
      setError('');
    } catch (err) {
      if (mine !== seq.current) return;
      setError(err instanceof Error && err.message ? err.message : t('inp.loadFailed'));
    }
  }, [wardId, t]);

  usePolling(load, REFRESH_MS);

  const chooseWard = (id: string) => {
    writeStored(MAR_WARD_STORAGE_KEY, id);
    setMar(null);
    setWardId(id);
  };

  const items = mar?.items ?? [];
  const overdue = items.filter((i) => i.status === 'OVERDUE').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('inp.round.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('inp.round.subtitle')}</p>
        </div>
        <select aria-label={t('inp.ward')} value={wardId} onChange={(e) => chooseWard(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          {(wards ?? []).map((w) => (
            <option key={w.id} value={w.id}>{w.name} ({w.counts.occupied})</option>
          ))}
        </select>
      </div>

      {error && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className={`${cardClass} p-4`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('inp.round.toGive')}</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{mar ? items.length : '—'}</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('inp.round.overdue')}</p>
          <p className={`text-2xl font-bold tabular-nums ${overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{mar ? overdue : '—'}</p>
        </div>
      </div>

      <section className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">{t('inp.round.time')}</th>
              <th className="px-4 py-3">{t('inp.bed')}</th>
              <th className="px-4 py-3">{t('inp.patient')}</th>
              <th className="px-4 py-3">{t('inp.mar.medication')}</th>
              <th className="px-4 py-3">{t('inp.round.status')}</th>
              <th className="px-4 py-3 text-right">{t('inp.round.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {wards !== null && wards.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t('inp.board.noWards')}</td></tr>}
            {mar === null && wardId && !error && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">{t('common.loading')}</td></tr>}
            {mar && items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t('inp.round.nothingDue')}</td></tr>}
            {items.map((item) => (
              <tr key={`${item.orderId}-${item.scheduledAt}`} className={item.status === 'OVERDUE' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                <td className="px-4 py-3 font-semibold tabular-nums text-gray-900 dark:text-white">{item.time}</td>
                <td className="px-4 py-3 tabular-nums">{item.bedLabel ?? '—'}</td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/admissions/${item.admissionId}`} className="text-gray-900 dark:text-white hover:underline">{item.patientName}</Link>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{item.number}</span>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {item.drugName} · {item.dose} · {t(`inp.route.${item.route}`)}
                </td>
                <td className="px-4 py-3"><DoseBadge status={item.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setTarget({ item, status: 'GIVEN' })} className="px-2.5 py-1 text-xs font-medium rounded-md bg-lime-600 hover:bg-lime-700 text-white">{t('inp.admin.GIVEN')}</button>
                    <button type="button" onClick={() => setTarget({ item, status: 'REFUSED' })} className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">{t('inp.round.other')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {mar && <p className="text-xs text-gray-500 dark:text-gray-400">{t('inp.round.updatedAt', { time: formatDateTime(mar.now, { hour: '2-digit', minute: '2-digit' }) })}</p>}

      {target && (
        <RecordDoseDialog
          title={t('inp.mar.recordTitle', { drug: target.item.drugName, time: target.item.time })}
          subtitle={`${target.item.patientName}${target.item.bedLabel ? ` · ${t('inp.bedLabel', { label: target.item.bedLabel })}` : ''}`}
          defaultDose={target.item.dose}
          initialStatus={target.status}
          onClose={() => setTarget(null)}
          onConfirm={async (data) => {
            await api.recordAdministration(target.item.admissionId, { orderId: target.item.orderId, scheduledAt: target.item.scheduledAt, ...data });
            setTarget(null);
            toast.success(t('inp.mar.saved'));
            load();
          }}
        />
      )}
    </div>
  );
}
