'use client';

import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { api, LabSampleLookup } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { REJECTION_REASONS, isValidBarcode, normaliseBarcode } from '@/lib/lab';
import { ContainerBadge, DialogShell, ErrorBox, LabPriorityBadge, SampleStatusChip, cancelBtn, cardClass, dangerBtn, inputClass, labelClass, messageOf, primaryBtn } from './ui';

/**
 * "Scanner un tube": keyboard-wedge scanners type the digits then Enter. Looks the tube up and
 * offers to receive it at the lab or reject it.
 */
export function ScanPanel({ onChanged }: { onChanged?: () => void }) {
  const { t, formatDateTime } = useLanguage();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [found, setFound] = useState<LabSampleLookup | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const reset = () => {
    setFound(null);
    setCode('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const lookup = async (e: FormEvent) => {
    e.preventDefault();
    const barcode = normaliseBarcode(code);
    setError('');
    setFound(null);
    if (!isValidBarcode(barcode)) return setError(t('labw.scan.badCode'));
    setBusy(true);
    try {
      setFound(await api.lookupLabSample(barcode));
    } catch (err) {
      setError(messageOf(err, t('labw.scan.notFound')));
    } finally {
      setBusy(false);
    }
  };

  const receive = async () => {
    if (!found) return;
    setBusy(true);
    try {
      await api.receiveLabSample(found.sample.barcode);
      toast.success(t('labw.scan.received', { code: found.sample.barcode }));
      onChanged?.();
      reset();
    } catch (err) {
      setError(messageOf(err, t('labw.actionFailed')));
    } finally {
      setBusy(false);
    }
  };

  const patientName =
    found?.order.patientName ?? found?.order.patient?.name ?? [found?.order.patient?.firstName, found?.order.patient?.lastName].filter(Boolean).join(' ');

  return (
    <div className={`${cardClass} p-4`}>
      <form onSubmit={lookup} className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <label htmlFor="lab-scan" className={labelClass}>{t('labw.scan.label')}</label>
          <input
            id="lab-scan"
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder={t('labw.scan.placeholder')}
            className={`${inputClass} text-lg tracking-widest font-mono`}
          />
        </div>
        <button type="submit" disabled={busy || !code.trim()} className={primaryBtn}>{t('labw.scan.find')}</button>
      </form>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      {found && (
        <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-gray-900 dark:text-white">{found.sample.barcode}</span>
            <ContainerBadge container={found.sample.container} />
            <SampleStatusChip status={found.sample.status} />
            <LabPriorityBadge priority={found.order.priority} />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">{patientName || '—'}</span>
            {found.order.patient?.patientId ? ` · ${found.order.patient.patientId}` : ''}
            {found.order.number ? ` · ${found.order.number}` : ''}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {found.items.map((i) => i.labTest?.name ?? i.name ?? i.code).filter(Boolean).join(', ')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('labw.scan.collectedAt', { date: formatDateTime(found.sample.collectedAt) })}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {found.sample.status === 'COLLECTED' && (
              <>
                <button type="button" onClick={receive} disabled={busy} className={primaryBtn}>{t('labw.scan.receive')}</button>
                <button type="button" onClick={() => setRejecting(true)} disabled={busy} className={dangerBtn}>{t('labw.scan.reject')}</button>
              </>
            )}
            {found.sample.status === 'RECEIVED' && <p className="text-sm text-green-700 dark:text-green-400">{t('labw.scan.alreadyReceived')}</p>}
            {found.sample.status === 'REJECTED' && <p className="text-sm text-red-700 dark:text-red-400">{t('labw.scan.alreadyRejected')}</p>}
            <Link href={`/dashboard/laboratory/orders/${found.order.id}`} className="px-4 py-2 text-sm text-lime-700 dark:text-lime-400 hover:underline">
              {t('labw.scan.openOrder')}
            </Link>
          </div>
        </div>
      )}
      {rejecting && found && (
        <RejectDialog
          barcode={found.sample.barcode}
          onClose={() => setRejecting(false)}
          onDone={() => {
            setRejecting(false);
            onChanged?.();
            reset();
          }}
        />
      )}
    </div>
  );
}

export function RejectDialog({ barcode, onClose, onDone }: { barcode: string; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [reason, setReason] = useState<string>('HEMOLYSED');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (reason === 'OTHER' && !note.trim()) return setError(t('labw.reject.noteRequired'));
    setSaving(true);
    setError('');
    try {
      await api.rejectLabSample(barcode, reason, note.trim() || undefined);
      toast.warning(t('labw.reject.done', { code: barcode }), t('labw.reject.recollect'));
      onDone();
    } catch (err) {
      setError(messageOf(err, t('labw.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={t('labw.reject.title', { code: barcode })}
      subtitle={t('labw.reject.subtitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('labw.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={dangerBtn}>{t('labw.reject.confirm')}</button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className={labelClass}>{t('labw.reject.reason')}</legend>
        {REJECTION_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
            <input type="radio" name="reject-reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
            {t(`labw.reject.${r}`)}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="reject-note" className={labelClass}>{t('labw.reject.note')}</label>
        <textarea id="reject-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>
      {error && <ErrorBox message={error} />}
    </DialogShell>
  );
}
