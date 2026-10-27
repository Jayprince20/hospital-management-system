'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, type MedicalDocument } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { ReasonDialog } from '@/components/inpatient';
import { canRevoke } from '@/lib/medical-documents';
import { DocumentStatusBadge, PdfButtons, ReferralStatusBadge, UrgencyBadge, useDocumentLabel } from './ui';

const revokeBtn =
  'px-2.5 py-1 text-xs font-medium rounded-md border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30';

/** One-line description under the title: period, destination, kind… */
function useDocumentDetail() {
  const { t, formatDate } = useLanguage();
  return (doc: MedicalDocument): string => {
    if (doc.type === 'SICK_LEAVE' && doc.validFrom && doc.validUntil) {
      return t('mdoc.leave.period', { from: formatDate(doc.validFrom), to: formatDate(doc.validUntil), days: doc.leaveDays ?? 0 });
    }
    if (doc.type === 'MEDICAL_CERTIFICATE') return doc.purpose ?? '';
    if (doc.type === 'REFERRAL') {
      if (doc.direction === 'INCOMING') return t('mdoc.ref.fromLine', { facility: doc.fromFacility ?? '—' });
      return t('mdoc.ref.toLine', { facility: [doc.toFacility, doc.toSpecialty].filter(Boolean).join(' · ') || '—' });
    }
    return '';
  };
}

/**
 * Documents as a table: what, for whom, by whom, status, PDF and revoke. `showPatient` adds the
 * patient column (the documents page); the patient record leaves it out.
 */
export function DocumentTable({ documents, showPatient = true, onChanged }: { documents: MedicalDocument[]; showPatient?: boolean; onChanged?: () => void }) {
  const { t, formatDate } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const label = useDocumentLabel();
  const detail = useDocumentDetail();
  const [revoking, setRevoking] = useState<MedicalDocument | null>(null);

  if (documents.length === 0) {
    return <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('mdoc.list.empty')}</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 font-medium">{t('mdoc.list.document')}</th>
              {showPatient && <th className="px-4 py-2 font-medium">{t('mdoc.list.patient')}</th>}
              <th className="px-4 py-2 font-medium">{t('mdoc.list.doctor')}</th>
              <th className="px-4 py-2 font-medium">{t('mdoc.list.date')}</th>
              <th className="px-4 py-2 font-medium">{t('mdoc.list.status')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('mdoc.list.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {documents.map((doc) => (
              <tr key={doc.id} className={doc.status === 'REVOKED' ? 'opacity-70' : ''}>
                <td className="px-4 py-3 align-top">
                  <p className="font-medium text-gray-900 dark:text-white">{label(doc)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{doc.number}</p>
                  {detail(doc) && <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{detail(doc)}</p>}
                  {doc.status === 'REVOKED' && doc.revokeReason && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{t('mdoc.list.revokedBecause', { reason: doc.revokeReason })}</p>
                  )}
                </td>
                {showPatient && (
                  <td className="px-4 py-3 align-top">
                    <Link href={`/dashboard/patients/${doc.patient.id}`} className="text-gray-900 dark:text-white hover:underline">{doc.patient.name}</Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{doc.patient.patientId}</p>
                  </td>
                )}
                <td className="px-4 py-3 align-top text-gray-700 dark:text-gray-300">{doc.doctor.name}</td>
                <td className="px-4 py-3 align-top text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDate(doc.issuedAt)}</td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-wrap gap-1">
                    <DocumentStatusBadge status={doc.status} />
                    {doc.type === 'REFERRAL' && <ReferralStatusBadge status={doc.referralStatus} />}
                    {doc.type === 'REFERRAL' && doc.urgency && doc.urgency !== 'ROUTINE' && <UrgencyBadge urgency={doc.urgency} />}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-right">
                  <div className="inline-flex flex-wrap justify-end gap-1.5">
                    <PdfButtons doc={doc} />
                    {canRevoke(doc, user) && (
                      <button type="button" className={revokeBtn} onClick={() => setRevoking(doc)}>{t('mdoc.revoke')}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {revoking && (
        <ReasonDialog
          title={t('mdoc.revoke.title', { number: revoking.number })}
          label={t('mdoc.revoke.reason')}
          confirmLabel={t('mdoc.revoke.confirm')}
          danger
          onClose={() => setRevoking(null)}
          onConfirm={async (reason) => {
            await api.revokeMedicalDocument(revoking.id, reason);
            toast.success(t('mdoc.revoke.done', { number: revoking.number }));
            setRevoking(null);
            onChanged?.();
          }}
        />
      )}
    </>
  );
}
