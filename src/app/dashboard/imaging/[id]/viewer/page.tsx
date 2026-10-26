'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, type ImagingOrder } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { ErrorState, LoadingState } from '@/components/ui';
import { messageOf } from '@/components/imaging/ui';
import type { DicomStudySummary } from '@/lib/dicom';

// Cornerstone (WebGL, web workers, wasm codecs) only runs in the browser
const DicomViewer = dynamic(() => import('@/components/dicom/dicom-viewer').then((m) => m.DicomViewer), {
  ssr: false,
  loading: () => <div className="min-h-[70vh] rounded-2xl bg-gray-950" />,
});

export default function DicomViewerPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isPatient = user?.role === 'PATIENT';
  const [order, setOrder] = useState<ImagingOrder | null>(null);
  const [studies, setStudies] = useState<DicomStudySummary[] | null>(null);
  const [studyIndex, setStudyIndex] = useState(0);
  const [error, setError] = useState('');

  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    Promise.all([api.getImagingOrder(id), api.getDicomStudies(id)])
      .then(([o, s]) => {
        if (!live) return;
        setOrder(o);
        setStudies(s.filter((x) => x.numberOfInstances > 0 && x.series.length > 0));
        setError('');
      })
      .catch((err) => live && setError(messageOf(err, t('dicom.loadFailed'))));
    return () => {
      live = false;
    };
  }, [id, t, attempt]);

  if (error && !studies) return <ErrorState title={t('dicom.loadFailed')} message={error} onRetry={load} />;
  if (!studies) return <LoadingState label={t('dicom.loading')} />;

  const study = studies[Math.min(studyIndex, studies.length - 1)];
  const backHref = isPatient ? '/dashboard/my-health' : `/dashboard/imaging/${id}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={backHref} className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('dicom.back')}</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('dicom.title')}
            {order && <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">{order.exam.name} · {order.number}</span>}
          </h1>
        </div>
        {studies.length > 1 && (
          <label className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
            {t('dicom.study')}
            <select value={studyIndex} onChange={(e) => setStudyIndex(Number(e.target.value))} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm">
              {studies.map((s, i) => (
                <option key={s.id} value={i}>{`${s.modality ?? ''} ${s.description ?? ''} (${s.numberOfInstances})`.trim()}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!study ? (
        <p className="p-6 rounded-2xl bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300">{isPatient ? t('dicom.noStudiesPatient') : t('dicom.noStudies')}</p>
      ) : (
        <DicomViewer
          key={study.id}
          study={study}
          patient={{ name: order?.patient.name ?? null, age: order?.patient.age ?? null, sex: order?.patient.gender ?? null }}
        />
      )}
    </div>
  );
}
