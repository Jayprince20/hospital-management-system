'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { DESK_METHODS, REFUND_STATUS_STYLE, type CashierSessionSummary, type DeskPaymentMethod, type RefundStatus } from '@/lib/cash-desk';
import { cardClass } from '@/components/inpatient/ui';

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

/** The logged-in cashier's open till (null when closed); `loading` only on the first fetch */
export function useMyTill() {
  const [session, setSession] = useState<CashierSessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    try {
      setSession(await api.getMyCashierSession());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { session, loading, error, reload, setSession };
}

/** Z/X report and payment receipt PDFs; shows the server's message when they fail */
export function useCashDeskPdf() {
  const toast = useToast();
  const { t } = useLanguage();
  const report = useCallback(
    async (id: string, number?: string) => {
      try {
        await api.openCashierReportPdf(id, number);
      } catch (err) {
        toast.error(t('cd.pdfFailed'), err instanceof Error ? err.message : undefined);
      }
    },
    [toast, t]
  );
  const receipt = useCallback(
    async (paymentId: string, receiptNumber?: string | null) => {
      try {
        await api.openPaymentReceiptPdf(paymentId, receiptNumber);
      } catch (err) {
        toast.error(t('cd.receiptFailed'), err instanceof Error ? err.message : undefined);
      }
    },
    [toast, t]
  );
  return { report, receipt };
}

export function SessionStatusBadge({ status }: { status: 'OPEN' | 'CLOSED' }) {
  const { t } = useLanguage();
  const style = status === 'OPEN' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${style}`}>{t(`cd.status.${status}`)}</span>;
}

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${REFUND_STATUS_STYLE[status]}`}>{t(`cd.refund.status.${status}`)}</span>;
}

/** Signed variance in colour: green balanced, blue surplus, red shortage */
export function VarianceText({ variance, withLabel = false }: { variance: number | null; withLabel?: boolean }) {
  const { t, formatCurrency } = useLanguage();
  if (variance === null) return <span className="text-gray-400">—</span>;
  const tone = variance === 0 ? 'text-green-700 dark:text-green-400' : variance > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400';
  const label = variance === 0 ? t('cd.balanced') : variance > 0 ? t('cd.surplus') : t('cd.shortage');
  return (
    <span className={`font-semibold tabular-nums ${tone}`}>
      {variance > 0 ? '+' : ''}
      {formatCurrency(variance)}
      {withLabel ? ` · ${label}` : ''}
    </span>
  );
}

/** Takings per payment method */
export function MethodTotals({ byMethod }: { byMethod: Record<DeskPaymentMethod, number> }) {
  const { t, formatCurrency } = useLanguage();
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {DESK_METHODS.map((m) => (
        <div key={m} className="rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2">
          <dt className="text-xs text-gray-500 dark:text-gray-400">{t(`cd.method.${m}`)}</dt>
          <dd className="font-semibold text-gray-900 dark:text-white tabular-nums">{formatCurrency(byMethod[m] ?? 0)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** How the expected cash in the drawer is made up */
export function DrawerBreakdown({ session }: { session: CashierSessionSummary }) {
  const { t, formatCurrency } = useLanguage();
  const rows: Array<[string, string]> = [
    [t('cd.float'), formatCurrency(session.openingFloat)],
    [t('cd.cashPayments'), `+ ${formatCurrency(session.totals.byMethod.CASH ?? 0)}`],
    [t('cd.payIns'), `+ ${formatCurrency(session.totals.payIns)}`],
    [t('cd.payOuts'), `− ${formatCurrency(session.totals.payOuts)}`],
    [t('cd.cashRefunds'), `− ${formatCurrency(session.totals.cashRefunds)}`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
          <dd className="text-right text-gray-900 dark:text-white tabular-nums">{value}</dd>
        </div>
      ))}
      <dt className="font-semibold text-gray-700 dark:text-gray-200 border-t border-gray-200 dark:border-gray-700 pt-1.5">{t('cd.expectedCash')}</dt>
      <dd className="text-right font-semibold text-gray-900 dark:text-white tabular-nums border-t border-gray-200 dark:border-gray-700 pt-1.5">{formatCurrency(session.totals.expectedCash)}</dd>
    </dl>
  );
}

/** Shown on payment forms when the cashier has no open till: payments are refused until one is opened */
export function NoTillBanner() {
  const { t } = useLanguage();
  return (
    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
      <span>{t('cd.noTillBanner')}</span>
      <Link href="/dashboard/cash-desk" className="font-semibold underline">{t('cd.openMyTill')}</Link>
    </div>
  );
}

export function StatCard({ label, value, tone = 'default', hint }: { label: string; value: string; tone?: 'default' | 'warn' | 'good' | 'bad'; hint?: string }) {
  const toneClass = { default: 'text-gray-900 dark:text-white', warn: 'text-amber-700 dark:text-amber-400', good: 'text-green-700 dark:text-green-400', bad: 'text-red-700 dark:text-red-400' }[tone];
  return (
    <div className={`${cardClass} p-4`}>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export const thClass = 'px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase';
export const tdClass = 'px-4 py-2 text-sm text-gray-700 dark:text-gray-300';

/** After a desk payment: the receipt number with a print button (printing opens the PDF) */
export function ReceiptReadyBanner({ paymentId, receiptNumber, amount, onDismiss }: { paymentId: string; receiptNumber: string | null; amount: number; onDismiss: () => void }) {
  const { t, formatCurrency } = useLanguage();
  const pdf = useCashDeskPdf();
  return (
    <div role="status" className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-200 flex flex-wrap items-center justify-between gap-2">
      <span>{receiptNumber ? t('cd.receiptReady', { number: receiptNumber, amount: formatCurrency(amount) }) : t('cd.paymentRecorded', { amount: formatCurrency(amount) })}</span>
      <span className="flex gap-2">
        {receiptNumber && (
          <button type="button" className="px-3 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium" onClick={() => pdf.receipt(paymentId, receiptNumber)}>
            {t('cd.printReceipt')}
          </button>
        )}
        <button type="button" className="px-2 py-1 rounded-md hover:bg-green-100 dark:hover:bg-green-800/40" onClick={onDismiss} aria-label={t('cd.close')}>✕</button>
      </span>
    </div>
  );
}
