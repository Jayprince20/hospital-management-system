'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, type ImagingOrder } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { DICOM_UPLOAD_ACCEPT, dicomFileProblem, formatPersonName, type DicomStudySummary, type DicomUploadResult } from '@/lib/dicom';
import { cardClass, messageOf, primaryBtn, smallBtn } from '@/components/imaging/ui';

/**
 * DICOM part of an imaging exam: studies received (with the identity check), drag & drop upload of
 * .dcm/.zip for the imaging team, and the button to the viewer.
 */
export function DicomPanel({
  order,
  canUpload,
  isRadiologist,
  onChanged,
}: {
  order: ImagingOrder;
  canUpload: boolean;
  isRadiologist: boolean;
  onChanged?: () => void;
}) {
  const { t, formatDate } = useLanguage();
  const { user } = useAuth();
  // Removing a study (soft delete, with a reason) is for the administration only
  const canRemove = user?.role === 'ADMIN';
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [studies, setStudies] = useState<DicomStudySummary[] | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ count: number; fraction: number } | null>(null);
  const [result, setResult] = useState<DicomUploadResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStudies(await api.getDicomStudies(order.id));
      setError('');
    } catch (err) {
      setError(messageOf(err, t('dicom.loadFailed')));
      setStudies((s) => s ?? []);
    }
  }, [order.id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async (files: File[]) => {
    const problems = files.map((f) => ({ f, p: dicomFileProblem(f) })).filter((x) => x.p);
    for (const { f, p } of problems) toast.error(t(p === 'size' ? 'dicom.upload.tooBig' : 'dicom.upload.badType', { name: f.name }));
    const ok = files.filter((f) => !dicomFileProblem(f));
    if (!ok.length) return;
    setProgress({ count: ok.length, fraction: 0 });
    setResult(null);
    try {
      const res = await api.uploadDicomFiles(order.id, ok, (fraction) => setProgress({ count: ok.length, fraction }));
      setResult(res);
      toast.success(t('dicom.upload.done', { stored: res.stored, duplicates: res.duplicates }));
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(t('dicom.upload.failed'), messageOf(err, ''));
    } finally {
      setProgress(null);
    }
  };

  const confirmIdentity = async (s: DicomStudySummary) => {
    setBusy(s.id);
    try {
      await api.confirmDicomIdentity(order.id, s.id);
      toast.success(t('dicom.identity.confirmDone'));
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(t('img.actionFailed'), messageOf(err, ''));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (s: DicomStudySummary) => {
    const reason = window.prompt(t('dicom.deleteReason'));
    if (!reason?.trim()) return;
    setBusy(s.id);
    try {
      await api.deleteDicomStudy(order.id, s.id, reason.trim());
      toast.success(t('dicom.deleted'));
      await load();
    } catch (err) {
      toast.error(t('img.actionFailed'), messageOf(err, ''));
    } finally {
      setBusy(null);
    }
  };

  const hasImages = (studies ?? []).some((s) => s.numberOfInstances > 0);

  return (
    <section className={`${cardClass} p-5 space-y-4`} aria-labelledby="dicom-panel-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="dicom-panel-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('dicom.upload.title')}</h2>
        {hasImages && (
          <Link href={`/dashboard/imaging/${order.id}/viewer`} className={primaryBtn}>{t('dicom.open')}</Link>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {studies === null && <p className="text-sm text-gray-500">{t('dicom.loading')}</p>}
      {studies?.length === 0 && !error && <p className="text-sm text-gray-500 dark:text-gray-400">{t('dicom.noStudies')}</p>}

      <ul className="space-y-3">
        {(studies ?? []).map((s) => (
          <li key={s.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{s.description || t('dicom.study')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('dicom.studyLine', {
                    modality: s.modality ?? '—',
                    date: s.studyDate ? formatDate(`${s.studyDate}T12:00:00`) : '—',
                    series: s.numberOfSeries,
                    images: s.numberOfInstances,
                  })}
                </p>
              </div>
              {canRemove && (
                <button type="button" onClick={() => void remove(s)} disabled={busy === s.id} className={`${smallBtn} text-red-600 dark:text-red-400`}>{t('dicom.delete')}</button>
              )}
            </div>
            {s.identityCheck === 'MISMATCH' && !s.identityConfirmed && (
              <div role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 text-sm space-y-1">
                <p className="font-semibold">{t('dicom.identity.mismatch')}</p>
                <p>{t('dicom.identity.inFile', { name: formatPersonName(s.patientNameInFile) || '—', id: s.patientIdInFile ?? '—' })}</p>
                <p>{t('dicom.identity.patient', { name: order.patient.name, id: order.patient.patientId })}</p>
                <p className="text-xs">{t('dicom.identity.mustConfirm')}</p>
                {isRadiologist && (
                  <button type="button" onClick={() => void confirmIdentity(s)} disabled={busy === s.id} className={`${smallBtn} mt-1`}>{t('dicom.identity.confirm')}</button>
                )}
              </div>
            )}
            {s.identityCheck === 'MISMATCH' && s.identityConfirmed && s.identityConfirmedBy && (
              <p className="text-xs text-green-700 dark:text-green-300">{t('dicom.identity.confirmed', { name: s.identityConfirmedBy.name })}</p>
            )}
          </li>
        ))}
      </ul>

      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void send(Array.from(e.dataTransfer.files));
          }}
          className={`rounded-xl border-2 border-dashed p-4 text-center text-sm ${dragging ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20' : 'border-gray-300 dark:border-gray-600'}`}
        >
          {progress ? (
            <div className="space-y-2" aria-live="polite">
              <p>{t('dicom.upload.sending', { n: progress.count })}</p>
              <div className="h-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className="h-full bg-brand" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-300">
              {t('dicom.upload.drop')}{' '}
              <button type="button" onClick={() => inputRef.current?.click()} className="text-lime-700 dark:text-lime-400 font-medium hover:underline">{t('dicom.upload.choose')}</button>
              <span className="block text-xs text-gray-500 mt-1">{t('dicom.upload.hint')}</span>
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={DICOM_UPLOAD_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              void send(files);
            }}
          />
        </div>
      )}

      {result && result.rejected.length > 0 && (
        <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
          {result.rejected.map((r, i) => (
            <li key={`${r.fileName}-${i}`}>{t('dicom.upload.rejected', { name: r.fileName, reason: r.reason })}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
