'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type MedicalDocument } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { DocumentTable } from './document-list';
import { NewDocumentDialog, type DocumentPatient } from './new-document-dialog';
import { ErrorBox, cardClass, primaryBtn } from './ui';

/** The patient record's "Documents médicaux": what was issued for them, and issuing a new one */
export function PatientDocumentsPanel({ patient }: { patient: DocumentPatient }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const canIssue = user?.role === 'DOCTOR' || user?.role === 'ADMIN';
  const [documents, setDocuments] = useState<MedicalDocument[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api
      .getMedicalDocuments({ patientId: patient.id, limit: 100 })
      .then((res) => {
        setDocuments(res.documents);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('mdoc.loadFailed')));
  }, [patient.id, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={cardClass}>
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('mdoc.panel.title')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('mdoc.panel.subtitle')}</p>
        </div>
        {canIssue && (
          <button type="button" onClick={() => setCreating(true)} className={`${primaryBtn} text-sm`}>{t('mdoc.new.button')}</button>
        )}
      </div>
      <ErrorBox message={error} />
      {documents === null && !error ? (
        <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('mdoc.loading')}</p>
      ) : (
        documents && <DocumentTable documents={documents} showPatient={false} onChanged={load} />
      )}
      {creating && <NewDocumentDialog patient={patient} onClose={() => setCreating(false)} onIssued={load} />}
    </div>
  );
}
