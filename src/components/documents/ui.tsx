'use client';

import { useCallback, useState } from 'react';
import { api, type MedicalDocument, type MedicalDocumentStatus, type ReferralStatus, type ReferralUrgency } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { documentLabelKey, hasPdf } from '@/lib/medical-documents';
import { smallBtn } from '@/components/inpatient/ui';

// Dialog shell, form classes and helpers are shared with the inpatient screens
export { DialogShell, ErrorBox, messageOf, inputClass, labelClass, cancelBtn, primaryBtn, dangerBtn, smallBtn, cardClass } from '@/components/inpatient/ui';

const STATUS_STYLE: Record<MedicalDocumentStatus, string> = {
  ISSUED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  REVOKED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export function DocumentStatusBadge({ status }: { status: MedicalDocumentStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[status]}`}>{t(`mdoc.status.${status}`)}</span>;
}

const REFERRAL_STYLE: Record<ReferralStatus, string> = {
  SENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  ACKNOWLEDGED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export function ReferralStatusBadge({ status }: { status: ReferralStatus | null }) {
  const { t } = useLanguage();
  if (!status) return null;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${REFERRAL_STYLE[status]}`}>{t(`mdoc.referral.status.${status}`)}</span>;
}

const URGENCY_STYLE: Record<ReferralUrgency, string> = {
  ROUTINE: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  URGENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  EMERGENCY: 'bg-red-600 text-white',
};

export function UrgencyBadge({ urgency }: { urgency: ReferralUrgency | null }) {
  const { t } = useLanguage();
  if (!urgency) return null;
  return <span className={`px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${URGENCY_STYLE[urgency]}`}>{t(`mdoc.urgency.${urgency}`)}</span>;
}

/** "Arrêt de travail", "Certificat d'aptitude", "Lettre de référence"… */
export function useDocumentLabel() {
  const { t } = useLanguage();
  return useCallback((doc: Pick<MedicalDocument, 'type' | 'certificateKind' | 'direction'>) => t(documentLabelKey(doc)), [t]);
}

/** Open a document PDF, with a toast when the server refuses */
export function useDocumentPdf() {
  const { t, language } = useLanguage();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const open = useCallback(
    async (doc: Pick<MedicalDocument, 'id'>, copy?: 'patient' | 'employer') => {
      setBusy(`${doc.id}:${copy ?? ''}`);
      try {
        await api.openMedicalDocumentPdf(doc.id, { lang: language === 'en' ? 'en' : 'fr', copy });
      } catch (err) {
        toast.error(t('mdoc.pdfFailed'), err instanceof Error ? err.message : undefined);
      } finally {
        setBusy(null);
      }
    },
    [language, t, toast]
  );
  return { open, busy };
}

/** PDF buttons for a document: two copies for a sick leave, one otherwise, none for an incoming referral */
export function PdfButtons({ doc, patientView = false }: { doc: MedicalDocument; patientView?: boolean }) {
  const { t } = useLanguage();
  const { open, busy } = useDocumentPdf();
  if (!hasPdf(doc)) return null;
  // A patient can't print a revoked document (the server refuses it)
  if (patientView && doc.status === 'REVOKED') return null;
  if (doc.type === 'SICK_LEAVE') {
    return (
      <span className="inline-flex flex-wrap gap-1.5">
        <button type="button" className={smallBtn} disabled={busy !== null} onClick={() => open(doc, 'employer')}>{t('mdoc.pdf.employer')}</button>
        <button type="button" className={smallBtn} disabled={busy !== null} onClick={() => open(doc, 'patient')}>{t('mdoc.pdf.patient')}</button>
      </span>
    );
  }
  return (
    <button type="button" className={smallBtn} disabled={busy !== null} onClick={() => open(doc)}>{t('mdoc.pdf.single')}</button>
  );
}
