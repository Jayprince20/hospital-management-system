'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type ImagingModality, type ImagingOrderStatus, type ImagingPriority } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { PRIORITY_STYLE, STATUS_STYLE, WORKLIST_TABS, isRadiologistProfile, timelineIndex } from '@/lib/imaging';

// Dialog shell, form classes and helpers are shared with the inpatient screens
export { DialogShell, ErrorBox, messageOf, inputClass, labelClass, cancelBtn, primaryBtn, dangerBtn, smallBtn, cardClass } from '@/components/inpatient/ui';

export function ImagingStatusBadge({ status }: { status: ImagingOrderStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[status]}`}>{t(`img.status.${status}`)}</span>;
}

export function PriorityBadge({ priority }: { priority: ImagingPriority }) {
  const { t } = useLanguage();
  if (priority === 'ROUTINE') return null;
  return <span className={`px-2 py-0.5 rounded-md text-xs font-bold whitespace-nowrap ${PRIORITY_STYLE[priority]}`}>{t(`img.priority.${priority}`)}</span>;
}

export function ModalityBadge({ modality }: { modality: ImagingModality }) {
  const { t } = useLanguage();
  return <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 whitespace-nowrap">{t(`img.modality.${modality}`)}</span>;
}

export function CriticalBadge() {
  const { t } = useLanguage();
  return <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-red-600 text-white whitespace-nowrap">{t('img.critical')}</span>;
}

export function ContrastBadge() {
  const { t } = useLanguage();
  return <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 whitespace-nowrap">{t('img.contrast')}</span>;
}

/** Ordered → scheduled → arrived → performed → reported, with the current step highlighted */
export function StatusTimeline({ status }: { status: ImagingOrderStatus }) {
  const { t } = useLanguage();
  if (status === 'CANCELLED') return <ImagingStatusBadge status={status} />;
  const current = timelineIndex(status);
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label={t('img.timeline')}>
      {WORKLIST_TABS.map((step, i) => (
        <li key={step} className="flex items-center gap-1">
          <span
            className={`px-2 py-0.5 rounded-full font-medium ${
              i < current
                ? 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300'
                : i === current
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}
            aria-current={i === current ? 'step' : undefined}
          >
            {t(`img.step.${step}`)}
          </span>
          {i < WORKLIST_TABS.length - 1 && <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">›</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Whether the signed-in doctor may report (radiology department or speciality). The server
 * decides; this only avoids offering the report editor to doctors it would refuse.
 */
export function useIsRadiologist(): boolean {
  const { user } = useAuth();
  const [radiologist, setRadiologist] = useState(false);
  const doctorId = user?.role === 'DOCTOR' ? user.doctorId : undefined;
  useEffect(() => {
    if (!doctorId) return;
    let live = true;
    api
      .getDoctor(doctorId)
      .then((d) => live && setRadiologist(isRadiologistProfile(d.department, d.specializations)))
      .catch(() => live && setRadiologist(false));
    return () => {
      live = false;
    };
  }, [doctorId]);
  return Boolean(doctorId) && radiologist;
}

/** Open the report PDF, with a toast when the server refuses */
export function useImagingPdf() {
  const { t, language } = useLanguage();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const open = useCallback(
    async (orderId: string) => {
      setBusy(orderId);
      try {
        await api.openImagingReportPdf(orderId, language === 'en' ? 'en' : 'fr');
      } catch (err) {
        toast.error(t('img.pdfFailed'), err instanceof Error ? err.message : undefined);
      } finally {
        setBusy(null);
      }
    },
    [language, t, toast]
  );
  return { open, busy };
}
