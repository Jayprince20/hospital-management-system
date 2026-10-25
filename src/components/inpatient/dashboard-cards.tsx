'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type MyAdmissions, type Ward } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { readStored } from '@/lib/queue';
import { cardClass, useDaysLabel, usePolling } from './ui';

export const MAR_WARD_STORAGE_KEY = 'hms.marRound.ward';

/** Nurse dashboard: doses due or overdue now on the ward last used for the round */
export function MarRoundCard() {
  const { t } = useLanguage();
  const [ward, setWard] = useState<Ward | null>(null);
  const [counts, setCounts] = useState<{ due: number; overdue: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const board = await api.getWards({ active: true });
      const stored = readStored(MAR_WARD_STORAGE_KEY);
      const chosen = board.wards.find((w) => w.id === stored) ?? board.wards.find((w) => w.counts.occupied > 0) ?? null;
      setWard(chosen);
      if (!chosen) return setCounts({ due: 0, overdue: 0 });
      const mar = await api.getWardMar(chosen.id);
      setCounts({
        due: mar.items.filter((i) => i.status === 'DUE').length,
        overdue: mar.items.filter((i) => i.status === 'OVERDUE').length,
      });
    } catch {
      setCounts((prev) => prev ?? { due: 0, overdue: 0 });
    }
  }, []);

  usePolling(load, 60_000);

  if (counts === null) return null;
  return (
    <div className={`${cardClass} p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">{t('inp.round.cardTitle')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {ward ? t('inp.round.cardCounts', { ward: ward.name, due: counts.due, overdue: counts.overdue }) : t('inp.round.noWard')}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {counts.overdue > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{t('inp.round.overdueBadge', { count: counts.overdue })}</span>}
        <Link href="/dashboard/mar-round" className="px-3 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm">{t('inp.round.open')}</Link>
      </div>
    </div>
  );
}

/** Patient portal: current hospital stay and past stays with their discharge summary */
export function MyAdmissionCard() {
  const { t, language, formatDate } = useLanguage();
  const toast = useToast();
  const daysLabel = useDaysLabel();
  const [data, setData] = useState<MyAdmissions | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    api.getMyAdmissions().then(setData).catch(() => setData({ current: null, past: [] }));
  }, []);

  if (!data || (!data.current && data.past.length === 0)) return null;

  const download = async (id: string) => {
    setDownloading(id);
    try {
      await api.downloadDischargeSummary(id, language === 'en' ? 'en' : 'fr');
    } catch (err) {
      toast.error(t('inp.actionFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setDownloading(null);
    }
  };

  const discharged = data.past.filter((a) => a.status === 'DISCHARGED');

  return (
    <div className={`${cardClass} p-5 mb-6 space-y-4`}>
      {data.current && (
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('inp.portal.current')}</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
            {data.current.ward.name}
            {data.current.bed ? ` · ${t('inp.bedLabel', { label: data.current.bed.label })}` : ''}
            {' · '}
            {t('inp.portal.since', { date: formatDate(data.current.admittedAt, { day: 'numeric', month: 'long' }), days: daysLabel(data.current.days) })}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('inp.portal.doctor', { name: data.current.attendingDoctor.name.replace(/^Dr\.?\s*/i, '') })}</p>
        </div>
      )}
      {discharged.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('inp.portal.past')}</h3>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {discharged.map((a) => (
              <li key={a.id} className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {a.ward.name} · {formatDate(a.admittedAt, { day: 'numeric', month: 'short', year: 'numeric' })} → {a.dischargedAt ? formatDate(a.dischargedAt, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
                <button type="button" onClick={() => download(a.id)} disabled={downloading === a.id} className="text-sm text-lime-700 dark:text-lime-400 hover:underline disabled:opacity-50 text-left">
                  {t('inp.portal.summaryPdf')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
