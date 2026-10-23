'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, LabResultStatus, LabSampleStatus } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { containerColour, flagClass, flagSymbol, isBiologistProfile } from '@/lib/lab';

export { DialogShell, ErrorBox, cancelBtn, cardClass, dangerBtn, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from '@/components/inpatient/ui';

const RESULT_STYLE: Record<LabResultStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  ENTERED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  VALIDATED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  RELEASED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

export function ResultStatusChip({ status }: { status: LabResultStatus | undefined }) {
  const { t } = useLanguage();
  const s = status ?? 'PENDING';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_STYLE[s]}`}>{t(`labw.result.${s}`)}</span>;
}

const SAMPLE_STYLE: Record<LabSampleStatus, string> = {
  COLLECTED: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  RECEIVED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

export function SampleStatusChip({ status }: { status: LabSampleStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SAMPLE_STYLE[status]}`}>{t(`labw.sample.${status}`)}</span>;
}

const PRIORITY_STYLE: Record<string, string> = {
  STAT: 'bg-red-600 text-white',
  URGENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  ROUTINE: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export function LabPriorityBadge({ priority }: { priority: string }) {
  const { t } = useLanguage();
  if (priority === 'ROUTINE') return null;
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.ROUTINE}`}>{t(`labw.priority.${priority}`)}</span>;
}

export function ContainerBadge({ container }: { container: string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
      <span className={`w-2.5 h-2.5 rounded-full ${containerColour(container)}`} aria-hidden="true" />
      {container || '—'}
    </span>
  );
}

export function CriticalMarker() {
  const { t } = useLanguage();
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">{t('labw.critical')}</span>;
}

/** A value with its unit and ↑/↓/!! flag, coloured */
export function FlaggedValue({ value, unit, flag }: { value: string; unit?: string | null; flag?: string | null }) {
  const symbol = flagSymbol(flag);
  return (
    <span className={flagClass(flag)}>
      {value}
      {unit ? <span className="font-normal text-gray-500 dark:text-gray-400"> {unit}</span> : null}
      {symbol ? <span className="ml-1">{symbol}</span> : null}
    </span>
  );
}

/**
 * Whether the signed-in doctor may validate (lab/biology department or speciality). The server
 * decides; this only avoids offering validation to doctors it would refuse.
 */
export function useIsBiologist(): boolean {
  const { user } = useAuth();
  const [biologist, setBiologist] = useState(false);
  const doctorId = user?.role === 'DOCTOR' ? user.doctorId : undefined;
  useEffect(() => {
    if (!doctorId) return;
    let live = true;
    api
      .getDoctor(doctorId)
      .then((d) => live && setBiologist(isBiologistProfile(d.department, d.specializations)))
      .catch(() => live && setBiologist(false));
    return () => {
      live = false;
    };
  }, [doctorId]);
  return Boolean(doctorId) && biologist;
}

/** Open the results report or labels, with a toast when the server refuses */
export function useLabPdf() {
  const { t, language } = useLanguage();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const report = useCallback(
    async (orderId: string) => {
      setBusy(`report:${orderId}`);
      try {
        await api.openLabReportPdf(orderId, language === 'en' ? 'en' : 'fr');
      } catch (err) {
        toast.error(t('labw.pdfFailed'), err instanceof Error ? err.message : undefined);
      } finally {
        setBusy(null);
      }
    },
    [language, t, toast]
  );
  const labels = useCallback(
    async (orderId: string, sampleIds?: string[]) => {
      setBusy(`labels:${orderId}`);
      try {
        await api.openLabLabels(orderId, sampleIds);
      } catch (err) {
        toast.error(t('labw.labelsFailed'), err instanceof Error ? err.message : undefined);
      } finally {
        setBusy(null);
      }
    },
    [t, toast]
  );
  return { report, labels, busy };
}
