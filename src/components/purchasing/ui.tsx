'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { INVOICE_STATUS_STYLE, PO_STATUS_STYLE, type PurchaseOrderStatus, type SupplierInvoiceStatus } from '@/lib/purchasing';
import { DialogShell, ErrorBox, cancelBtn, dangerBtn, inputClass, labelClass, primaryBtn } from '@/components/inpatient/ui';

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
} from '@/components/inpatient/ui';

export function PoStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${PO_STATUS_STYLE[status]}`}>{t(`pur.status.${status}`)}</span>;
}

export function InvoiceStatusBadge({ status }: { status: SupplierInvoiceStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${INVOICE_STATUS_STYLE[status]}`}>{t(`pur.inv.status.${status}`)}</span>;
}

export function ProgressBar({ percent }: { percent: number }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${value >= 100 ? 'bg-green-500' : 'bg-lime-500'}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-9 text-right">{value}%</span>
    </div>
  );
}

export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === 'ADMIN';
}

/** A dialog asking for a mandatory reason (reject, cancel, close, dispute) */
export function ReasonDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!reason.trim()) {
      setError(t('pur.reasonRequired'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('pur.actionFailed'));
      setBusy(false);
    }
  };
  return (
    <DialogShell
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose} disabled={busy}>{t('pur.cancel')}</button>
          <button type="button" className={danger ? dangerBtn : primaryBtn} onClick={submit} disabled={busy}>{confirmLabel}</button>
        </>
      }
    >
      {message && <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>}
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="pur-reason">{t('pur.reason')} *</label>
        <textarea id="pur-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} autoFocus />
      </div>
    </DialogShell>
  );
}

/** Extra supplier fields for purchasing, used in the inventory supplier forms */
export function SupplierTermsFields({
  value,
  onChange,
  fieldClass,
}: {
  value: { niu: string; paymentTermsDays: string; leadTimeDays: string };
  onChange: (next: { niu: string; paymentTermsDays: string; leadTimeDays: string }) => void;
  fieldClass: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="sup-niu">{t('pur.supplier.niu')}</label>
        <input id="sup-niu" type="text" value={value.niu} onChange={(e) => onChange({ ...value, niu: e.target.value })} className={fieldClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="sup-terms">{t('pur.supplier.paymentTerms')}</label>
        <input id="sup-terms" type="number" min={0} max={365} value={value.paymentTermsDays} onChange={(e) => onChange({ ...value, paymentTermsDays: e.target.value })} className={fieldClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="sup-lead">{t('pur.supplier.leadTime')}</label>
        <input id="sup-lead" type="number" min={0} max={365} value={value.leadTimeDays} onChange={(e) => onChange({ ...value, leadTimeDays: e.target.value })} className={fieldClass} />
      </div>
    </div>
  );
}

/** Open the bon de commande PDF; shows the server's message when it fails */
export function usePurchaseOrderPdf() {
  const toast = useToast();
  const { t } = useLanguage();
  return useCallback(
    async (id: string, orderNumber?: string) => {
      try {
        await api.openPurchaseOrderPdf(id, orderNumber);
      } catch (err) {
        toast.error(t('pur.pdfFailed'), err instanceof Error ? err.message : undefined);
      }
    },
    [toast, t]
  );
}
