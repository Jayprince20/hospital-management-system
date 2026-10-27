'use client';

import { useEffect, useState } from 'react';
import { api, type MedicalDocument } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { formatCode } from '@/lib/medical-documents';
import { DocumentStatusBadge, PdfButtons, useDocumentLabel } from './ui';

/** Patient portal: the certificates, sick leaves and referral letters issued for me */
export function MyMedicalDocuments() {
  const { t, formatDate } = useLanguage();
  const label = useDocumentLabel();
  const [documents, setDocuments] = useState<MedicalDocument[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api
      .getMyMedicalDocuments()
      .then((docs) => live && setDocuments(docs))
      .catch((err) => live && setError(err instanceof Error ? err.message : t('mdoc.loadFailed')));
    return () => {
      live = false;
    };
  }, [t]);

  // Incoming referrals are the other facility's letters: nothing for the patient to download here
  const visible = (documents ?? []).filter((d) => !(d.type === 'REFERRAL' && d.direction === 'INCOMING'));

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('mdoc.mine.title')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('mdoc.mine.subtitle')}</p>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {documents === null && !error && <p className="text-sm text-gray-500 dark:text-gray-400">{t('mdoc.loading')}</p>}
      {documents !== null && visible.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('mdoc.mine.empty')}</p>
      )}
      <ul className="space-y-2">
        {visible.map((doc) => (
          <li key={doc.id} className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{label(doc)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('mdoc.mine.issuedBy', { date: formatDate(doc.issuedAt), doctor: doc.doctor.name })}
              </p>
              {doc.type === 'SICK_LEAVE' && doc.validFrom && doc.validUntil && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {t('mdoc.leave.period', { from: formatDate(doc.validFrom), to: formatDate(doc.validUntil), days: doc.leaveDays ?? 0 })}
                </p>
              )}
              {doc.status === 'ISSUED' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('mdoc.mine.code', { code: formatCode(doc.verificationCode) })}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <DocumentStatusBadge status={doc.status} />
              <PdfButtons doc={doc} patientView />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
