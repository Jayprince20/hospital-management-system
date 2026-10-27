'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { isImageAttachment, type ClinicalAttachment } from '@/lib/clinical-docs';
import { CategoryChip, messageOf, smallBtn } from './ui';

/** A protected file as an object URL (fetched with the session token, revoked on unmount) */
export function useAttachmentUrl(attachmentId: string | null): { url: string | null; error: string } {
  const [state, setState] = useState<{ id: string | null; url: string | null; error: string }>({ id: null, url: null, error: '' });
  useEffect(() => {
    if (!attachmentId) return;
    let live = true;
    let created: string | null = null;
    api
      .fetchAttachmentBlobUrl(attachmentId)
      .then((u) => {
        created = u;
        if (live) setState({ id: attachmentId, url: u, error: '' });
        else URL.revokeObjectURL(u);
      })
      .catch((err) => live && setState({ id: attachmentId, url: null, error: messageOf(err, 'error') }));
    return () => {
      live = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [attachmentId]);
  // A result for another file is still loading
  return state.id === attachmentId ? { url: state.url, error: state.error } : { url: null, error: '' };
}

const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3, 4];

/** Full-screen viewer: images with zoom, PDFs in the browser's viewer */
export function AttachmentViewer({ attachment, onClose }: { attachment: ClinicalAttachment; onClose: () => void }) {
  const { t, formatDate } = useLanguage();
  const { url, error } = useAttachmentUrl(attachment.id);
  const [zoom, setZoom] = useState(2); // index into ZOOMS (1×)
  const image = isImageAttachment(attachment.mimeType);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (image && (e.key === '+' || e.key === '=')) setZoom((z) => Math.min(z + 1, ZOOMS.length - 1));
      if (image && e.key === '-') setZoom((z) => Math.max(z - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, image]);

  const download = () => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.fileName;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" role="dialog" aria-modal="true" aria-label={attachment.title}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 dark:text-white truncate">{attachment.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2">
            <CategoryChip category={attachment.category} />
            <span className="truncate">{attachment.fileName}</span>
            {attachment.documentDate && <span>· {formatDate(`${attachment.documentDate.slice(0, 10)}T12:00:00`)}</span>}
          </p>
        </div>
        {image && (
          <div className="flex items-center gap-1" role="group" aria-label="Zoom">
            <button type="button" className={smallBtn} onClick={() => setZoom((z) => Math.max(z - 1, 0))} aria-label={t('cdoc.att.zoomOut')} disabled={zoom === 0}>−</button>
            <button type="button" className={smallBtn} onClick={() => setZoom(2)}>{t('cdoc.att.zoomReset')} · {Math.round(ZOOMS[zoom] * 100)} %</button>
            <button type="button" className={smallBtn} onClick={() => setZoom((z) => Math.min(z + 1, ZOOMS.length - 1))} aria-label={t('cdoc.att.zoomIn')} disabled={zoom === ZOOMS.length - 1}>+</button>
          </div>
        )}
        <button type="button" className={smallBtn} onClick={download} disabled={!url}>{t('cdoc.att.download')}</button>
        <button type="button" className={smallBtn} onClick={onClose} autoFocus>{t('cdoc.att.close')}</button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {error && <p className="text-white bg-red-700/80 rounded-lg px-4 py-2 text-sm mt-10">{t('cdoc.att.openFailed')} — {error}</p>}
        {!url && !error && <p className="text-white text-sm mt-10">{t('cdoc.loading')}</p>}
        {url && image && (
          // eslint-disable-next-line @next/next/no-img-element -- object URL of a protected file
          <img
            src={url}
            alt={attachment.title}
            style={{ width: ZOOMS[zoom] === 1 ? undefined : `${ZOOMS[zoom] * 100}%`, maxWidth: ZOOMS[zoom] === 1 ? '100%' : 'none' }}
            className="h-auto bg-white rounded shadow-lg"
          />
        )}
        {url && !image && <iframe src={url} title={attachment.title} className="w-full h-full min-h-[70vh] bg-white rounded" />}
      </div>
    </div>
  );
}
