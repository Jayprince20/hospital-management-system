'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type MedicalDocument, type PendingReferrals } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { ReasonDialog } from '@/components/inpatient';
import { daysWaiting, isReferralOverdue } from '@/lib/medical-documents';
import { FeedbackDialog, NewDocumentDialog, PdfButtons, ReferralStatusBadge, UrgencyBadge } from '@/components/documents';
import { ErrorBox, cardClass, primaryBtn, smallBtn } from '@/components/documents/ui';

type Tab = 'sent' | 'received' | 'completed';

const smallPrimary = 'px-2.5 py-1 text-xs font-medium rounded-md bg-lime-600 hover:bg-lime-700 text-white disabled:opacity-50';

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function ReferralCard({
  referral,
  actions,
}: {
  referral: MedicalDocument;
  actions: React.ReactNode;
}) {
  const { t, formatDate } = useLanguage();
  const [open, setOpen] = useState(false);
  const incoming = referral.direction === 'INCOMING';
  const waiting = referral.daysWaiting ?? daysWaiting(referral.issuedAt);
  const overdue = isReferralOverdue(referral);
  const pending = referral.referralStatus === 'SENT' || referral.referralStatus === 'ACKNOWLEDGED';

  return (
    <li className={`${cardClass} p-4 ${overdue ? 'border-red-300 dark:border-red-700' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/dashboard/patients/${referral.patient.id}`} className="font-semibold text-gray-900 dark:text-white hover:underline">{referral.patient.name}</Link>
            <span className="text-xs text-gray-500 dark:text-gray-400">{referral.patient.patientId}</span>
            <UrgencyBadge urgency={referral.urgency} />
            <ReferralStatusBadge status={referral.referralStatus} />
            {overdue && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{t('mdoc.ref.overdue')}</span>}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
            {incoming
              ? t('mdoc.ref.fromLine', { facility: [referral.fromFacility, referral.fromDoctor].filter(Boolean).join(' · ') || '—' })
              : t('mdoc.ref.toLine', { facility: [referral.toFacility, referral.toSpecialty, referral.toDoctor].filter(Boolean).join(' · ') || '—' })}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {referral.number} · {formatDate(referral.issuedAt)} · {referral.doctor.name}
            {pending && !incoming ? ` · ${t('mdoc.ref.waiting', { count: waiting })}` : ''}
          </p>
          {referral.reason && <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{referral.reason}</p>}
          {referral.referralStatus === 'CANCELLED' && referral.cancelReason && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{t('mdoc.ref.cancelledBecause', { reason: referral.cancelReason })}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {actions}
          <PdfButtons doc={referral} />
          <button type="button" className={smallBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? t('mdoc.ref.hide') : t('mdoc.ref.details')}
          </button>
        </div>
      </div>
      {open && (
        <dl className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('mdoc.ref.summary')} value={referral.clinicalSummary} />
          <Field label={t('mdoc.ref.investigations')} value={referral.investigations} />
          <Field label={t('mdoc.ref.treatment')} value={referral.currentTreatment} />
          <Field label={t('mdoc.ref.question')} value={referral.question} />
          {referral.acknowledgedAt && <Field label={t('mdoc.ref.acknowledgedAt')} value={formatDate(referral.acknowledgedAt)} />}
          {referral.feedback && (
            <div className="md:col-span-2 rounded-lg bg-green-50 dark:bg-green-900/20 p-3">
              <p className="text-xs font-medium uppercase text-green-800 dark:text-green-300">
                {incoming ? t('mdoc.ref.ourReply') : t('mdoc.ref.feedback')}
                {referral.feedbackAt ? ` · ${formatDate(referral.feedbackAt)}` : ''}
                {referral.feedbackFrom ? ` · ${referral.feedbackFrom}` : ''}
              </p>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mt-1">{referral.feedback}</p>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}

export default function ReferralsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const canRecordIncoming = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const [tab, setTab] = useState<Tab>('sent');
  const [pending, setPending] = useState<PendingReferrals | null>(null);
  const [received, setReceived] = useState<MedicalDocument[] | null>(null);
  const [completed, setCompleted] = useState<MedicalDocument[] | null>(null);
  const [error, setError] = useState('');
  const [feedbackFor, setFeedbackFor] = useState<MedicalDocument | null>(null);
  const [cancelling, setCancelling] = useState<MedicalDocument | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const fail = useCallback((err: unknown) => setError(err instanceof Error ? err.message : t('mdoc.loadFailed')), [t]);

  const load = useCallback(() => {
    setError('');
    api.getPendingReferrals().then(setPending).catch(fail);
    api
      .getMedicalDocuments({ type: 'REFERRAL', direction: 'INCOMING', limit: 100 })
      .then((res) => setReceived(res.documents))
      .catch(fail);
    // Closed referrals: answered or cancelled, newest first
    Promise.all([
      api.getMedicalDocuments({ type: 'REFERRAL', referralStatus: 'COMPLETED', limit: 100 }),
      api.getMedicalDocuments({ type: 'REFERRAL', referralStatus: 'CANCELLED', limit: 100 }),
    ])
      .then(([done, cancelled]) =>
        setCompleted([...done.documents, ...cancelled.documents].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)))
      )
      .catch(fail);
  }, [fail]);

  useEffect(() => {
    load();
  }, [load]);

  const acknowledge = async (referral: MedicalDocument) => {
    setBusy(referral.id);
    try {
      await api.acknowledgeReferral(referral.id);
      toast.success(t('mdoc.ref.acknowledged', { number: referral.number }));
      load();
    } catch (err) {
      toast.error(t('mdoc.actionFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const pendingActions = (referral: MedicalDocument) => (
    <>
      {referral.referralStatus === 'SENT' && (
        <button type="button" className={smallBtn} disabled={busy === referral.id} onClick={() => acknowledge(referral)}>{t('mdoc.ref.acknowledge')}</button>
      )}
      <button type="button" className={smallPrimary} onClick={() => setFeedbackFor(referral)}>{t('mdoc.ref.recordFeedback')}</button>
      <button type="button" className={smallBtn} onClick={() => setCancelling(referral)}>{t('mdoc.ref.cancel')}</button>
    </>
  );

  const counts = pending?.counts;
  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'sent', label: t('mdoc.ref.tab.sent'), count: pending?.referrals.length },
    { id: 'received', label: t('mdoc.ref.tab.received'), count: received?.filter((r) => r.referralStatus !== 'COMPLETED' && r.referralStatus !== 'CANCELLED').length },
    { id: 'completed', label: t('mdoc.ref.tab.completed') },
  ];

  const list = tab === 'sent' ? pending?.referrals ?? null : tab === 'received' ? received : completed;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('mdoc.ref.page.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('mdoc.ref.page.subtitle')}</p>
        </div>
        {canRecordIncoming && (
          <button type="button" onClick={() => setRecording(true)} className={`${primaryBtn} text-sm`}>{t('mdoc.ref.recordIncoming')}</button>
        )}
      </div>

      {counts && (
        <div className="grid grid-cols-3 gap-3">
          <div className={`${cardClass} p-4`}>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('mdoc.ref.count.sent')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.sent}</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('mdoc.ref.count.acknowledged')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.acknowledged}</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('mdoc.ref.count.overdue')}</p>
            <p className={`text-2xl font-bold ${counts.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{counts.overdue}</p>
          </div>
        </div>
      )}

      <div role="tablist" className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === item.id ? 'border-lime-600 text-lime-700 dark:text-lime-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 && <span className="ml-1.5 px-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">{item.count}</span>}
          </button>
        ))}
      </div>

      <ErrorBox message={error} />

      {list === null && !error && <p className="text-sm text-gray-500 dark:text-gray-400">{t('mdoc.loading')}</p>}
      {list !== null && list.length === 0 && (
        <p className={`${cardClass} p-6 text-center text-sm text-gray-500 dark:text-gray-400`}>{t(`mdoc.ref.empty.${tab}`)}</p>
      )}
      {list && list.length > 0 && (
        <ul className="space-y-3">
          {list.map((referral) => (
            <ReferralCard
              key={referral.id}
              referral={referral}
              actions={
                tab === 'sent' ? (
                  pendingActions(referral)
                ) : tab === 'received' && referral.referralStatus !== 'COMPLETED' && referral.referralStatus !== 'CANCELLED' ? (
                  <button type="button" className={smallPrimary} onClick={() => setFeedbackFor(referral)}>{t('mdoc.ref.reply')}</button>
                ) : null
              }
            />
          ))}
        </ul>
      )}

      {feedbackFor && (
        <FeedbackDialog
          referral={feedbackFor}
          onClose={() => setFeedbackFor(null)}
          onSaved={(doc) => {
            toast.success(t('mdoc.feedback.saved', { number: doc.number }));
            setFeedbackFor(null);
            load();
          }}
        />
      )}
      {cancelling && (
        <ReasonDialog
          title={t('mdoc.ref.cancelTitle', { number: cancelling.number })}
          label={t('mdoc.ref.cancelReason')}
          confirmLabel={t('mdoc.ref.cancelConfirm')}
          danger
          onClose={() => setCancelling(null)}
          onConfirm={async (reason) => {
            await api.cancelReferral(cancelling.id, reason);
            toast.success(t('mdoc.ref.cancelled', { number: cancelling.number }));
            setCancelling(null);
            load();
          }}
        />
      )}
      {recording && (
        <NewDocumentDialog
          incoming
          onClose={() => setRecording(false)}
          onIssued={() => {
            setTab('received');
            load();
          }}
        />
      )}
    </div>
  );
}
