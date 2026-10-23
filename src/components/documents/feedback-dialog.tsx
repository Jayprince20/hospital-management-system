'use client';

import { useState } from 'react';
import { api, type MedicalDocument } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { localDay } from '@/lib/medical-documents';
import { DialogShell, ErrorBox, cancelBtn, inputClass, labelClass, messageOf, primaryBtn } from './ui';

/**
 * Record the answer to a referral: for an outgoing one, the receiving side's feedback
 * (contre-référence); for an incoming one, our reply to the referring facility.
 */
export function FeedbackDialog({ referral, onClose, onSaved }: { referral: MedicalDocument; onClose: () => void; onSaved: (doc: MedicalDocument) => void }) {
  const { t } = useLanguage();
  const incoming = referral.direction === 'INCOMING';
  const [feedback, setFeedback] = useState('');
  const [from, setFrom] = useState(incoming ? '' : [referral.toDoctor, referral.toFacility].filter(Boolean).join(', '));
  const [receivedAt, setReceivedAt] = useState(localDay());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!feedback.trim()) return setError(t('mdoc.feedback.required'));
    if (receivedAt > localDay()) return setError(t('mdoc.feedback.future'));
    setSaving(true);
    setError('');
    try {
      const doc = await api.recordReferralFeedback(referral.id, {
        feedback: feedback.trim(),
        ...(from.trim() ? { feedbackFrom: from.trim() } : {}),
        receivedAt,
      });
      onSaved(doc);
    } catch (err) {
      setError(messageOf(err, t('mdoc.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={incoming ? t('mdoc.feedback.replyTitle') : t('mdoc.feedback.title')}
      subtitle={`${referral.number} · ${referral.patient.name}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('mdoc.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('mdoc.feedback.save')}</button>
        </>
      }
    >
      <div>
        <label htmlFor="mdoc-feedback" className={labelClass}>{incoming ? t('mdoc.feedback.replyText') : t('mdoc.feedback.text')}<span className="text-red-500"> *</span></label>
        <textarea id="mdoc-feedback" rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="mdoc-feedback-from" className={labelClass}>{incoming ? t('mdoc.feedback.replyTo') : t('mdoc.feedback.from')}</label>
          <input id="mdoc-feedback-from" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="mdoc-feedback-date" className={labelClass}>{incoming ? t('mdoc.feedback.replyDate') : t('mdoc.feedback.date')}</label>
          <input id="mdoc-feedback-date" type="date" max={localDay()} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className={inputClass} />
        </div>
      </div>
      <ErrorBox message={error} />
    </DialogShell>
  );
}
