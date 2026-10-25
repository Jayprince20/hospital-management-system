'use client';

import { useEffect, type ReactNode } from 'react';
import type { AdmissionStatus, BedStatus, DoseStatus } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { BED_DOT, DOSE_STYLE } from '@/lib/inpatient';

export function DialogShell({ title, subtitle, children, footer, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; footer: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`bg-white dark:bg-gray-800 rounded-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="p-5 space-y-4">{children}</div>
        <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

export const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-transparent';
export const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
export const cancelBtn = 'px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700';
export const primaryBtn = 'px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg disabled:opacity-50';
export const dangerBtn = 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50';
export const smallBtn = 'px-2.5 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50';
export const cardClass = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700';

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{message}</div>;
}

export const messageOf = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export function BedStatusBadge({ status }: { status: BedStatus }) {
  const { t } = useLanguage();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
      <span className={`w-2.5 h-2.5 rounded-full ${BED_DOT[status]}`} aria-hidden="true" />
      {t(`inp.bed.${status}`)}
    </span>
  );
}

export function DoseBadge({ status, label }: { status: DoseStatus; label?: string }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${DOSE_STYLE[status]}`}>{label ?? t(`inp.dose.${status}`)}</span>;
}

const ADMISSION_STATUS_STYLE: Record<AdmissionStatus, string> = {
  ADMITTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  DISCHARGED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export function AdmissionStatusBadge({ status }: { status: AdmissionStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ADMISSION_STATUS_STYLE[status]}`}>{t(`inp.status.${status}`)}</span>;
}

/** Run fn now and, when ms is given, again every ms while the tab is visible */
export function usePolling(fn: () => void, ms: number | null) {
  useEffect(() => {
    fn();
    if (!ms) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fn();
    }, ms);
    return () => clearInterval(timer);
  }, [fn, ms]);
}

/** "3 jours" / "1 jour" */
export function useDaysLabel() {
  const { t } = useLanguage();
  return (days: number) => (days <= 1 ? t('inp.days.one', { count: Math.max(days, 1) }) : t('inp.days.many', { count: days }));
}
