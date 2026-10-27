'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { Modal } from '@/components/ui';

interface PatientDataProtectionProps {
  patientId: string;
  /** Hospital ID (PAT-…) the admin must type to confirm an erasure */
  hospitalId: string;
  anonymized: boolean;
  onAnonymized: () => void;
}

const ERASED = ['identity', 'address', 'emergency', 'insurance', 'notifications', 'login', 'dob'];
const KEPT = ['consultations', 'prescriptions', 'lab', 'invoices'];

/** Admin-only: export a patient file, or anonymise the patient on an erasure request */
export function PatientDataProtection({ patientId, hospitalId, anonymized, onAnonymized }: PatientDataProtectionProps) {
  const { t } = useLanguage();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [errors, setErrors] = useState<{ reason?: string; confirm?: string; submit?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const file = await api.exportPatientData(patientId);
      toast.success(t('privacy.dp.exported'), t('privacy.dp.exportedMsg', { file }));
    } catch (err) {
      toast.error(t('privacy.dp.exportFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setReason('');
    setConfirmId('');
    setErrors({});
  };

  const handleAnonymize = async () => {
    const next: typeof errors = {};
    if (reason.trim().length < 10) next.reason = t('privacy.anon.errReason');
    if (confirmId.trim() !== hospitalId) next.confirm = t('privacy.anon.errConfirm');
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await api.anonymizePatient(patientId, { reason: reason.trim(), confirmPatientId: confirmId.trim() });
      toast.success(t('privacy.anon.success'));
      closeModal();
      onAnonymized();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : t('privacy.anon.failed') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{t('privacy.dp.title')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('privacy.dp.subtitle')}</p>
      </div>

      {anonymized && (
        <div className="mx-4 mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">{t('privacy.dp.anonymized')}</p>
          <p className="mt-0.5">{t('privacy.dp.anonymizedHint')}</p>
        </div>
      )}

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-col">
          <p className="text-sm text-gray-600 dark:text-gray-300 flex-1">{t('privacy.dp.exportHint')}</p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="mt-3 self-start inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? t('privacy.dp.exporting') : t('privacy.dp.export')}
          </button>
        </div>
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 p-4 flex flex-col">
          <p className="text-sm text-gray-600 dark:text-gray-300 flex-1">{t('privacy.dp.anonymizeHint')}</p>
          <button
            onClick={() => setShowModal(true)}
            disabled={anonymized}
            className="mt-3 self-start px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('privacy.dp.anonymize')}
          </button>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} size="lg">
        <Modal.Header>{t('privacy.anon.title')}</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{t('privacy.anon.warning')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('privacy.anon.erased')}</p>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300 list-disc pl-5">
                  {ERASED.map((key) => (
                    <li key={key}>{t(`privacy.anon.erased.${key}`)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('privacy.anon.kept')}</p>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300 list-disc pl-5">
                  {KEPT.map((key) => (
                    <li key={key}>{t(`privacy.anon.kept.${key}`)}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('privacy.anon.reason')}</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder={t('privacy.anon.reasonPlaceholder')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              {errors.reason && <p className="mt-1 text-sm text-red-500">{errors.reason}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('privacy.anon.confirmLabel', { id: hospitalId })}
              </label>
              <input
                type="text"
                value={confirmId}
                onChange={(e) => setConfirmId(e.target.value)}
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              {errors.confirm && <p className="mt-1 text-sm text-red-500">{errors.confirm}</p>}
            </div>
            {errors.submit && <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={closeModal}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            {t('privacy.anon.cancel')}
          </button>
          <button
            onClick={handleAnonymize}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? t('privacy.anon.submitting') : t('privacy.anon.submit')}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
