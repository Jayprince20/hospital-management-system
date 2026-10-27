'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { ErrorState, LoadingState } from '@/components/ui';
import { cardClass, inputClass, messageOf, primaryBtn } from '@/components/imaging/ui';
import { formatPersonName, type DicomStudySummary } from '@/lib/dicom';

/** Studies pushed by a modality whose accession number matched no exam: attach each to its exam */
export default function UnmatchedStudiesPage() {
  const { t, formatDate, formatDateTime } = useLanguage();
  const toast = useToast();
  const [studies, setStudies] = useState<DicomStudySummary[] | null>(null);
  const [error, setError] = useState('');
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStudies(await api.getUnmatchedDicomStudies());
      setError('');
    } catch (err) {
      setError(messageOf(err, t('dicom.loadFailed')));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const attach = async (s: DicomStudySummary) => {
    const number = (numbers[s.id] ?? s.accessionNumber ?? '').trim();
    if (!number) return;
    setBusy(s.id);
    try {
      const found = (await api.getImagingOrders({ search: number, limit: 5 })).orders.find((o) => o.number.toLowerCase() === number.toLowerCase());
      if (!found) {
        toast.error(t('dicom.unmatched.notFound'));
        return;
      }
      await api.attachUnmatchedDicomStudy(s.id, found.id);
      toast.success(t('dicom.unmatched.attached', { number: found.number }));
      await load();
    } catch (err) {
      toast.error(t('img.actionFailed'), messageOf(err, ''));
    } finally {
      setBusy(null);
    }
  };

  if (error && !studies) return <ErrorState title={t('dicom.loadFailed')} message={error} onRetry={load} />;
  if (!studies) return <LoadingState label={t('dicom.loading')} />;

  return (
    <div className="space-y-4">
      <Link href="/dashboard/imaging" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('img.back')}</Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dicom.unmatched.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('dicom.unmatched.subtitle')}</p>
      </div>
      {studies.length === 0 ? (
        <p className={`${cardClass} p-5 text-sm text-gray-600 dark:text-gray-300`}>{t('dicom.unmatched.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {studies.map((s) => (
            <li key={s.id} className={`${cardClass} p-4 flex flex-wrap items-end justify-between gap-3`}>
              <div className="text-sm">
                <p className="font-medium text-gray-900 dark:text-white">{formatPersonName(s.patientNameInFile) || '—'} · {s.patientIdInFile ?? '—'}</p>
                <p className="text-gray-600 dark:text-gray-400">
                  {t('dicom.studyLine', { modality: s.modality ?? '—', date: s.studyDate ? formatDate(`${s.studyDate}T12:00:00`) : '—', series: s.numberOfSeries, images: s.numberOfInstances })}
                </p>
                <p className="text-xs text-gray-500">{[s.description, s.accessionNumber ? `ACC ${s.accessionNumber}` : null, s.createdAt ? formatDateTime(s.createdAt) : null].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex items-end gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-400">
                  {t('dicom.unmatched.orderNumber')}
                  <input value={numbers[s.id] ?? ''} placeholder={s.accessionNumber ?? 'IMG-2026-…'} onChange={(e) => setNumbers((n) => ({ ...n, [s.id]: e.target.value }))} className={`${inputClass} mt-1 w-44`} />
                </label>
                <button type="button" onClick={() => void attach(s)} disabled={busy === s.id} className={primaryBtn}>{t('dicom.unmatched.attach')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
