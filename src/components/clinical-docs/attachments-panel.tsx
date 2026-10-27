'use client';

import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { usePolling } from '@/components/inpatient/ui';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { formatFileSize } from '@/lib/imaging';
import {
  ATTACHMENT_CATEGORIES,
  attachmentFileProblem,
  isImageAttachment,
  titleFromFileName,
  uploadCategoriesFor,
  type AttachmentCategory,
  type ClinicalAttachment,
} from '@/lib/clinical-docs';
import { AttachmentViewer, useAttachmentUrl } from './attachment-viewer';
import { CategoryChip, DialogShell, ErrorBox, cancelBtn, cardClass, dangerBtn, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from './ui';

function Thumb({ file, onOpen }: { file: ClinicalAttachment; onOpen: () => void }) {
  const { t } = useLanguage();
  const { url } = useAttachmentUrl(isImageAttachment(file.mimeType) ? file.id : null);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full aspect-[4/3] rounded-xl overflow-hidden bg-canvas dark:bg-gray-900 border border-line dark:border-gray-700 hover:ring-2 hover:ring-brand/40"
      aria-label={`${t('cdoc.att.open')} — ${file.title}`}
    >
      {isImageAttachment(file.mimeType) ? (
        url ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URL of a protected file
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-gray-400">{t('cdoc.loading')}</span>
        )
      ) : (
        <span className="flex h-full flex-col items-center justify-center gap-1 text-red-700 dark:text-red-300">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-bold">PDF</span>
        </span>
      )}
    </button>
  );
}

interface Pending {
  file: File;
  title: string;
  progress: number | null;
}

/** Metadata for the files being filed, then upload one by one with progress */
function UploadDialog({
  files,
  categories,
  patientMode,
  consultationId,
  patientId,
  onClose,
  onDone,
}: {
  files: File[];
  categories: AttachmentCategory[];
  patientMode: boolean;
  consultationId?: string;
  patientId: string;
  onClose: () => void;
  onDone: (uploadedIds: string[]) => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const [pending, setPending] = useState<Pending[]>(() => files.map((file) => ({ file, title: titleFromFileName(file.name), progress: null })));
  const [category, setCategory] = useState<AttachmentCategory>(() => {
    const allImages = files.every((f) => isImageAttachment(f.type));
    if (allImages && categories.includes('IMAGE')) return 'IMAGE';
    return categories.includes('OUTSIDE_RESULT') ? 'OUTSIDE_RESULT' : categories[0];
  });
  const [documentDate, setDocumentDate] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async () => {
    if (pending.some((p) => !p.title.trim())) {
      setError(t('cdoc.att.field.title'));
      return;
    }
    setBusy(true);
    setError('');
    let ok = 0;
    const uploadedIds: string[] = [];
    let done = pending.filter((p) => p.progress === 1).length; // already sent on a previous try
    for (let i = 0; i < pending.length; i += 1) {
      const p = pending[i];
      if (p.progress === 1) continue;
      setPending((list) => list.map((x, j) => (j === i ? { ...x, progress: 0 } : x)));
      try {
        const created = await api.uploadPatientAttachment(
          patientId,
          p.file,
          {
            category,
            title: p.title.trim(),
            documentDate: documentDate || undefined,
            visibleToPatient: patientMode ? true : visible,
            consultationId,
          },
          (fraction) => setPending((list) => list.map((x, j) => (j === i ? { ...x, progress: fraction } : x)))
        );
        setPending((list) => list.map((x, j) => (j === i ? { ...x, progress: 1 } : x)));
        ok += 1;
        uploadedIds.push(created.id);
        done += 1;
      } catch (err) {
        setPending((list) => list.map((x, j) => (j === i ? { ...x, progress: null } : x)));
        setError(`${t('cdoc.att.uploadFailed', { name: p.file.name })} — ${messageOf(err, '')}`);
      }
    }
    setBusy(false);
    if (ok) {
      toast.success(t('cdoc.att.uploaded'), ok > 1 ? `${ok}` : undefined);
      onDone(uploadedIds);
    }
    // Keep the dialog open on a failure so the remaining files can be retried
    if (done === pending.length) onClose();
  };

  return (
    <DialogShell
      title={t('cdoc.att.uploadTitle', { count: pending.length })}
      onClose={busy ? () => {} : onClose}
      wide
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose} disabled={busy}>{t('cdoc.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={upload} disabled={busy}>{busy ? t('cdoc.loading') : t('cdoc.att.upload')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>{t('cdoc.att.field.category')}</span>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as AttachmentCategory)}>
            {categories.map((c) => (
              <option key={c} value={c}>{t(`cdoc.att.cat.${c}`)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>{t('cdoc.att.field.documentDate')}</span>
          <input type="date" className={inputClass} value={documentDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDocumentDate(e.target.value)} />
        </label>
      </div>
      {!patientMode && (
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="rounded border-gray-300" />
          {t('cdoc.att.field.visible')}
        </label>
      )}
      <ul className="space-y-3">
        {pending.map((p, i) => (
          <li key={`${p.file.name}-${i}`} className="rounded-xl border border-line dark:border-gray-700 p-3">
            <label className="block">
              <span className={labelClass}>{t('cdoc.att.field.title')}</span>
              <input className={inputClass} value={p.title} onChange={(e) => setPending((list) => list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} disabled={busy || p.progress === 1} />
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">{p.file.name} · {formatFileSize(p.file.size)}</p>
            {p.progress !== null && (
              <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded" role="progressbar" aria-valuenow={Math.round(p.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={p.file.name}>
                <div className="h-1.5 bg-brand rounded transition-all" style={{ width: `${Math.round(p.progress * 100)}%` }} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </DialogShell>
  );
}

function EditDialog({ file, onClose, onSaved }: { file: ClinicalAttachment; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [title, setTitle] = useState(file.title);
  const [category, setCategory] = useState<AttachmentCategory>(file.category);
  const [documentDate, setDocumentDate] = useState(file.documentDate?.slice(0, 10) ?? '');
  const [visible, setVisible] = useState(file.visibleToPatient);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.updateAttachment(file.id, { title: title.trim(), category, documentDate: documentDate || null, visibleToPatient: visible });
      toast.success(t('cdoc.att.updated'));
      onSaved();
    } catch (err) {
      setError(messageOf(err, t('cdoc.actionFailed')));
    } finally {
      setBusy(false);
    }
  };
  return (
    <DialogShell
      title={t('cdoc.att.editTitle')}
      subtitle={file.fileName}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('cdoc.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={save} disabled={busy || !title.trim()}>{t('cdoc.save')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <label className="block">
        <span className={labelClass}>{t('cdoc.att.field.title')}</span>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block">
        <span className={labelClass}>{t('cdoc.att.field.category')}</span>
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as AttachmentCategory)}>
          {ATTACHMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(`cdoc.att.cat.${c}`)}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>{t('cdoc.att.field.documentDate')}</span>
        <input type="date" className={inputClass} value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="rounded border-gray-300" />
        {t('cdoc.att.field.visible')}
      </label>
    </DialogShell>
  );
}

function DeleteDialog({ file, onClose, onDeleted }: { file: ClinicalAttachment; onClose: () => void; onDeleted: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await api.deleteAttachment(file.id, reason.trim());
      toast.success(t('cdoc.att.deleted'));
      onDeleted();
    } catch (err) {
      setError(messageOf(err, t('cdoc.actionFailed')));
      setBusy(false);
    }
  };
  return (
    <DialogShell
      title={t('cdoc.att.deleteTitle', { name: file.title })}
      subtitle={t('cdoc.att.deleteHint')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('cdoc.cancel')}</button>
          <button type="button" className={dangerBtn} onClick={remove} disabled={busy || reason.trim().length < 3}>{t('cdoc.att.delete')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <label className="block">
        <span className={labelClass}>{t('cdoc.att.deleteReason')}</span>
        <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </label>
    </DialogShell>
  );
}

/**
 * Files on the patient record (letters, outside results, photos, scanned forms).
 * `consultationId` narrows the list to one consultation and links new uploads to it;
 * `patientMode` is the patient portal: only shared files, uploads always visible to the patient.
 */
export function PatientAttachmentsPanel({
  patientId,
  consultationId,
  patientMode = false,
  compact = false,
  title,
  subtitle,
  onUploaded,
}: {
  patientId: string;
  consultationId?: string;
  patientMode?: boolean;
  compact?: boolean;
  title?: string;
  subtitle?: string;
  /** Files sent while no consultationId exists yet (the write-up links them once saved) */
  onUploaded?: (ids: string[]) => void;
}) {
  const { t, language, formatDate } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ClinicalAttachment[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<AttachmentCategory | ''>('');
  const [dragging, setDragging] = useState(false);
  const [toUpload, setToUpload] = useState<File[] | null>(null);
  const [viewing, setViewing] = useState<ClinicalAttachment | null>(null);
  const [editing, setEditing] = useState<ClinicalAttachment | null>(null);
  const [deleting, setDeleting] = useState<ClinicalAttachment | null>(null);

  const role = patientMode ? 'PATIENT' : user?.role;
  const categories = uploadCategoriesFor(role);
  const canUpload = categories.length > 0;

  const load = useCallback(async () => {
    try {
      setFiles(await api.getPatientAttachments(patientId, consultationId ? { consultationId } : {}));
      setError('');
    } catch (err) {
      setError(messageOf(err, t('cdoc.att.loadFailed')));
      setFiles((f) => f ?? []);
    }
  }, [patientId, consultationId, t]);

  usePolling(load, null);

  const pick = (list: FileList | File[]) => {
    const accepted: File[] = [];
    for (const file of Array.from(list)) {
      const problem = attachmentFileProblem(file);
      if (problem) toast.error(t(problem), file.name);
      else accepted.push(file);
    }
    if (accepted.length) setToUpload(accepted);
  };

  const today = new Date().toISOString().slice(0, 10);
  const canEdit = (f: ClinicalAttachment) => !patientMode && (user?.role === 'ADMIN' || user?.role === 'DOCTOR' || f.uploadedBy.id === user?.id);
  const canDelete = (f: ClinicalAttachment) => !patientMode && (user?.role === 'ADMIN' || (f.uploadedBy.id === user?.id && f.createdAt.slice(0, 10) === today));

  const shown = (files ?? []).filter((f) => !filter || f.category === filter);
  const present = Array.from(new Set((files ?? []).map((f) => f.category)));

  return (
    <section className={`${cardClass} ${compact ? 'p-4' : 'p-5'}`} aria-label={title ?? t('cdoc.att.title')}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h2 className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-white`}>{title ?? t('cdoc.att.title')}</h2>
          {!compact && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle ?? t('cdoc.att.subtitle')}</p>}
        </div>
        {!compact && present.length > 1 && (
          <div className="flex flex-wrap gap-1" role="group" aria-label={t('cdoc.att.field.category')}>
            <button type="button" onClick={() => setFilter('')} aria-pressed={!filter} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${!filter ? 'bg-brand text-white border-brand' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>{t('cdoc.att.filterAll')}</button>
            {present.map((c) => (
              <button key={c} type="button" onClick={() => setFilter(c)} aria-pressed={filter === c} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${filter === c ? 'bg-brand text-white border-brand' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>{t(`cdoc.att.cat.${c}`)}</button>
            ))}
          </div>
        )}
      </div>

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
            if (e.dataTransfer.files.length) pick(e.dataTransfer.files);
          }}
          className={`mb-4 rounded-xl border-2 border-dashed px-4 ${compact ? 'py-3' : 'py-5'} text-center transition-colors ${dragging ? 'border-brand bg-brand/5' : 'border-gray-300 dark:border-gray-600'}`}
        >
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {patientMode && <span className="block font-medium text-gray-800 dark:text-gray-100 mb-0.5">{t('cdoc.att.sendTitle')}</span>}
            {t('cdoc.att.drop')}{' '}
            <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold text-brand underline-offset-2 hover:underline">{t('cdoc.att.pick')}</button>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('cdoc.att.rules')}</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) pick(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}

      <ErrorBox message={error} />
      {files === null && !error && <p className="text-sm text-gray-500">{t('cdoc.loading')}</p>}
      {files && shown.length === 0 && !error && <p className="text-sm text-gray-500 dark:text-gray-400">{t('cdoc.att.none')}</p>}
      {shown.length > 0 && (
        <ul className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
          {shown.map((f) => (
            <li key={f.id} className="min-w-0 space-y-1.5">
              <Thumb file={f} onOpen={() => setViewing(f)} />
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={f.title}>{f.title}</p>
              <div className="flex flex-wrap items-center gap-1">
                <CategoryChip category={f.category} />
                {!patientMode && (
                  <span className={`text-[11px] ${f.visibleToPatient ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`}>
                    {f.visibleToPatient ? t('cdoc.att.visible') : t('cdoc.att.hidden')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {formatDate(`${(f.documentDate ?? f.createdAt).slice(0, 10)}T12:00:00`)} · {formatFileSize(f.sizeBytes, language)}
                {f.uploadedBy.role === 'PATIENT' ? ` · ${t('cdoc.att.byPatient')}` : ` · ${f.uploadedBy.name}`}
              </p>
              <div className="flex flex-wrap gap-1">
                <button type="button" className={smallBtn} onClick={() => setViewing(f)}>{t('cdoc.att.open')}</button>
                {canEdit(f) && <button type="button" className={smallBtn} onClick={() => setEditing(f)}>{t('cdoc.att.edit')}</button>}
                {canDelete(f) && <button type="button" className={`${smallBtn} text-red-600 dark:text-red-400`} onClick={() => setDeleting(f)}>{t('cdoc.att.delete')}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {toUpload && (
        <UploadDialog
          files={toUpload}
          categories={categories}
          patientMode={patientMode}
          consultationId={consultationId}
          patientId={patientId}
          onClose={() => setToUpload(null)}
          onDone={(ids) => {
            onUploaded?.(ids);
            void load();
          }}
        />
      )}
      {viewing && <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />}
      {editing && (
        <EditDialog
          file={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          file={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            void load();
          }}
        />
      )}
    </section>
  );
}
