'use client';

import { useCallback } from 'react';
import type { PharmacySaleStatus, SalePaymentMethod } from '@/lib/api';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { EXPIRY_BADGE, expiryStatus } from '@/lib/pharmacy-pos';

// Dialog shell, form classes and helpers are shared with the inpatient screens
export {
  DialogShell,
  ErrorBox,
  messageOf,
  inputClass,
  labelClass,
  cancelBtn,
  primaryBtn,
  dangerBtn,
  smallBtn,
  cardClass,
  usePolling,
} from '@/components/inpatient/ui';

const SALE_STATUS_STYLE: Record<PharmacySaleStatus, string> = {
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  PARTIALLY_RETURNED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  RETURNED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  VOIDED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export function SaleStatusBadge({ status }: { status: PharmacySaleStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${SALE_STATUS_STYLE[status]}`}>{t(`pos.saleStatus.${status}`)}</span>;
}

/** Expiry date with a colour: expired, within 30 days, within 90 days, fine */
export function ExpiryBadge({ date, withDate = true }: { date: string | null | undefined; withDate?: boolean }) {
  const { t, formatDate } = useLanguage();
  if (!date) return <span className="text-xs text-gray-400">—</span>;
  const status = expiryStatus(date);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${EXPIRY_BADGE[status]}`}>
      {withDate ? formatDate(date) : null}
      {status === 'EXPIRED' && <span>· {t('pos.expiry.expired')}</span>}
    </span>
  );
}

export function RxBadge() {
  const { t } = useLanguage();
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" title={t('pos.rxOnlyHint')}>
      {t('pos.rxOnly')}
    </span>
  );
}

export function useMethodLabel() {
  const { t } = useLanguage();
  return (method: SalePaymentMethod) => t(`pos.method.${method}`);
}

/** Open a receipt or Z report PDF; shows the server's message when it fails */
export function usePharmacyPdf() {
  const toast = useToast();
  const { t, language } = useLanguage();
  return useCallback(
    async (kind: 'receipt' | 'session-report', id: string) => {
      try {
        await api.openPharmacyPdf(kind, id, language === 'en' ? 'en' : 'fr');
      } catch (err) {
        toast.error(t('pos.pdfFailed'), err instanceof Error ? err.message : undefined);
      }
    },
    [toast, t, language]
  );
}
