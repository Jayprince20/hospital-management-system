'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type ImagingAttachment, type ImagingOrder } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { isImageType } from '@/lib/imaging';
import { ImagingStatusBadge, ModalityBadge, cardClass, messageOf, smallBtn, useImagingPdf } from './ui';

/** Patient portal: "Mes examens d'imagerie" — preparation before, report and images after */
export function MyImaging() {
  const { t, formatDate, formatDateTime } = useLanguage();
  const toast = useToast();
  const { open, busy } = useImagingPdf();
  const [orders, setOrders] = useState<ImagingOrder[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api
      .getMyImagingOrders()
      .then((list) => live && setOrders(list))
      .catch((err) => {
        if (!live) return;
        setOrders([]);
        setError(messageOf(err, t('img.loadFailed')));
      });
    return () => {
      live = false;
    };
  }, [t]);

  const openFile = async (orderId: string, file: ImagingAttachment) => {
    try {
      const url = await api.fetchImagingBlobUrl(api.imagingAttachmentPath(orderId, file.id));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast.error(t('img.files.openFailed'), messageOf(err, ''));
    }
  };

  return (
    <section className={`${cardClass} p-5`} aria-labelledby="my-imaging-title">
      <h3 id="my-imaging-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t('img.mine.title')}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('img.mine.subtitle')}</p>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}
      {orders === null ? (
        <p className="text-sm text-gray-500">{t('img.loading')}</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('img.mine.none')}</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  {o.exam.name} <ModalityBadge modality={o.exam.modality} />
                </p>
                <ImagingStatusBadge status={o.status} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {o.number} · {t('img.mine.requestedBy', { name: o.orderedBy.name, date: formatDate(o.createdAt) })}
              </p>
              {(o.status === 'SCHEDULED' || o.status === 'ORDERED') && (
                <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-900 dark:text-blue-100">
                  {o.scheduledAt ? (
                    <p className="font-medium">{t('img.mine.appointment', { date: formatDateTime(o.scheduledAt), room: o.room ?? t('img.mine.roomTbc') })}</p>
                  ) : (
                    <p className="font-medium">{t('img.mine.notScheduled')}</p>
                  )}
                  {o.exam.preparation && <p className="mt-1">{t('img.preparation')} : {o.exam.preparation}</p>}
                </div>
              )}
              {o.status === 'REPORTED' && (
                <div className="mt-2 space-y-2">
                  {o.conclusion && (
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      <span className="font-medium">{t('img.report.conclusion')} :</span> {o.conclusion}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => open(o.id)} disabled={busy === o.id} className={smallBtn}>{t('img.report.pdf')}</button>
                    <Link href={`/dashboard/imaging/${o.id}/viewer`} className={smallBtn}>{t('dicom.open')}</Link>
                    {o.attachments.map((f) => (
                      <button key={f.id} type="button" onClick={() => openFile(o.id, f)} className={smallBtn}>
                        {isImageType(f.mimeType) ? t('img.mine.image') : 'PDF'} · {f.caption || f.fileName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
