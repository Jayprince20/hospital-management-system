'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type ImagingAttachment } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { MAX_FILES_PER_ORDER, fileProblem, formatFileSize, isImageType } from '@/lib/imaging';
import { cardClass, inputClass, messageOf, smallBtn } from './ui';

/** Thumbnail of a protected image: fetched with the session token, shown from an object URL */
function useBlobUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let live = true;
    let created: string | null = null;
    api
      .fetchImagingBlobUrl(path)
      .then((u) => {
        created = u;
        if (live) setUrl(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => live && setUrl(null));
    return () => {
      live = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [path]);
  return url;
}

function Thumbnail({ orderId, file, onOpen }: { orderId: string; file: ImagingAttachment; onOpen: (url: string) => void }) {
  const { t } = useLanguage();
  const url = useBlobUrl(isImageType(file.mimeType) ? api.imagingAttachmentPath(orderId, file.id) : null);
  if (!isImageType(file.mimeType)) {
    return (
      <div className="aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300">PDF</div>
    );
  }
  return (
    <button type="button" onClick={() => url && onOpen(url)} className="block w-full aspect-square bg-black rounded-lg overflow-hidden" aria-label={t('img.files.view', { name: file.fileName })}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- object URL of a protected file
        <img src={url} alt={file.caption ?? file.fileName} className="w-full h-full object-contain" />
      ) : (
        <span className="text-xs text-gray-400">{t('img.loading')}</span>
      )}
    </button>
  );
}

/** Key images and PDFs of an exam: upload (drag & drop or picker), view, delete */
export function AttachmentsPanel({
  orderId,
  files,
  canUpload,
  canDelete,
  onChanged,
}: {
  orderId: string;
  files: ImagingAttachment[];
  canUpload: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const { t, language, formatDateTime } = useLanguage();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<Array<{ name: string; progress: number }>>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLightbox(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const upload = async (list: FileList | File[]) => {
    const chosen = Array.from(list);
    if (files.length + chosen.length > MAX_FILES_PER_ORDER) {
      toast.error(t('img.files.tooMany', { max: MAX_FILES_PER_ORDER }));
      return;
    }
    for (const file of chosen) {
      const problem = fileProblem(file);
      if (problem) {
        toast.error(t(problem), file.name);
        continue;
      }
      setUploads((prev) => [...prev, { name: file.name, progress: 0 }]);
      try {
        await api.uploadImagingAttachment(orderId, file, caption.trim() || undefined, (p) =>
          setUploads((prev) => prev.map((u) => (u.name === file.name ? { ...u, progress: p } : u)))
        );
        toast.success(t('img.files.uploaded', { name: file.name }));
      } catch (err) {
        toast.error(t('img.files.uploadFailed', { name: file.name }), messageOf(err, ''));
      } finally {
        setUploads((prev) => prev.filter((u) => u.name !== file.name));
      }
    }
    setCaption('');
    onChanged();
  };

  const openFile = async (file: ImagingAttachment) => {
    try {
      const url = await api.fetchImagingBlobUrl(api.imagingAttachmentPath(orderId, file.id));
      if (isImageType(file.mimeType)) setLightbox(url);
      else {
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (err) {
      toast.error(t('img.files.openFailed'), messageOf(err, ''));
    }
  };

  const remove = async (file: ImagingAttachment) => {
    if (!window.confirm(t('img.files.confirmDelete', { name: file.fileName }))) return;
    try {
      await api.deleteImagingAttachment(orderId, file.id);
      toast.success(t('img.files.deleted'));
      onChanged();
    } catch (err) {
      toast.error(t('img.actionFailed'), messageOf(err, ''));
    }
  };

  return (
    <section className={`${cardClass} p-5`} aria-labelledby="img-files-title">
      <h2 id="img-files-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('img.files.title')}</h2>

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
            if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
          }}
          className={`mb-4 p-4 border-2 border-dashed rounded-lg text-center ${dragging ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20' : 'border-gray-300 dark:border-gray-600'}`}
        >
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('img.files.drop')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('img.files.rules')}</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2 justify-center items-center">
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t('img.files.caption')} className={`${inputClass} sm:max-w-xs`} aria-label={t('img.files.caption')} />
            <button type="button" onClick={() => inputRef.current?.click()} className={smallBtn}>{t('img.files.pick')}</button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) upload(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
          {uploads.map((u) => (
            <div key={u.name} className="mt-3 text-left">
              <p className="text-xs text-gray-600 dark:text-gray-300">{u.name}</p>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded" role="progressbar" aria-valuenow={Math.round(u.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-1.5 bg-brand rounded" style={{ width: `${Math.round(u.progress * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('img.files.none')}</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map((file) => (
            <li key={file.id} className="space-y-1">
              <Thumbnail orderId={orderId} file={file} onOpen={setLightbox} />
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate" title={file.fileName}>{file.caption || file.fileName}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {formatFileSize(file.sizeBytes, language)} · {formatDateTime(file.createdAt)}
              </p>
              <div className="flex gap-1">
                <button type="button" onClick={() => openFile(file)} className={smallBtn}>{t('img.files.open')}</button>
                {canDelete && (
                  <button type="button" onClick={() => remove(file)} className={`${smallBtn} text-red-600 dark:text-red-400`}>{t('img.files.delete')}</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t('img.files.viewer')} onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL of a protected file */}
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
          <button type="button" onClick={() => setLightbox(null)} className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-white/90 text-gray-900 text-sm font-medium">{t('img.close')}</button>
        </div>
      )}
    </section>
  );
}
