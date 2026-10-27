'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import type { CashierSessionDetail, CashierSessionSummary, InvoiceRefund } from '@/lib/cash-desk';
import { CloseTillDialog, MovementDialog, OpenTillDialog, PayRefundDialog } from '@/components/cash-desk/dialogs';
import { SessionDetailView } from '@/components/cash-desk/session-view';
import {
  ErrorBox,
  SessionStatusBadge,
  StatCard,
  VarianceText,
  cancelBtn,
  cardClass,
  dangerBtn,
  messageOf,
  primaryBtn,
  smallBtn,
  tdClass,
  thClass,
  useCashDeskPdf,
  useMyTill,
} from '@/components/cash-desk/ui';

export default function CashDeskPage() {
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const toast = useToast();
  const pdf = useCashDeskPdf();
  const { session, loading, error: tillError, reload } = useMyTill();
  const [detail, setDetail] = useState<CashierSessionDetail | null>(null);
  const [toPay, setToPay] = useState<InvoiceRefund[]>([]);
  const [history, setHistory] = useState<CashierSessionSummary[] | null>(null);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [paying, setPaying] = useState<InvoiceRefund | null>(null);

  const loadDetail = useCallback((id: string) => {
    Promise.all([api.getCashierSession(id), api.getRefunds({ status: 'APPROVED' })])
      .then(([d, refunds]) => {
        setDetail(d);
        setToPay(refunds);
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('cd.loadFailed'))));
  }, [t]);

  const loadHistory = useCallback(() => {
    api
      .getCashierSessions({ limit: 20 })
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  // Each new summary of my open till (after a payment, a movement…) reloads its detail
  useEffect(() => {
    if (session) loadDetail(session.id);
  }, [session, loadDetail]);

  useEffect(() => loadHistory(), [loadHistory]);

  const refresh = async () => {
    await reload();
    loadHistory();
  };

  if (loading) return <p className="text-gray-500 dark:text-gray-400">{t('cd.loading')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('cd.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('cd.subtitle')}</p>
        </div>
        {session && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={cancelBtn} onClick={() => pdf.report(session.id, session.number)}>{t('cd.xReport')}</button>
            <button type="button" className={dangerBtn} onClick={() => setClosing(true)}>{t('cd.closeTill')}</button>
          </div>
        )}
      </div>

      <ErrorBox message={tillError ? t('cd.loadFailed') : error} />

      {!session ? (
        <div className={`${cardClass} p-6 flex flex-wrap items-center justify-between gap-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20`}>
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-100">{t('cd.closedTitle')}</p>
            <p className="text-sm text-amber-800 dark:text-amber-200">{t('cd.closedHint')}</p>
          </div>
          <button type="button" className={primaryBtn} onClick={() => setOpening(true)}>{t('cd.openMyTill')}</button>
        </div>
      ) : (
        <>
          <div className={`${cardClass} p-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm`}>
            <span className="inline-flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" aria-hidden="true" />
              {t('cd.openLabel', { number: session.number })}
            </span>
            <span className="text-gray-600 dark:text-gray-300">{t('cd.openedAt', { date: formatDateTime(session.openedAt) })}</span>
            <span className="text-gray-600 dark:text-gray-300">{t('cd.floatValue', { amount: formatCurrency(session.openingFloat) })}</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={t('cd.expectedCash')} value={formatCurrency(session.totals.expectedCash)} hint={t('cd.expectedCashHint')} />
            <StatCard label={t('cd.cashPayments')} value={formatCurrency(session.totals.byMethod.CASH ?? 0)} />
            <StatCard
              label={t('cd.otherMethods')}
              value={formatCurrency(Object.entries(session.totals.byMethod).filter(([m]) => m !== 'CASH').reduce((sum, [, v]) => sum + v, 0))}
            />
            <StatCard label={t('cd.paymentsCountLabel')} value={String(session.totals.paymentsCount)} />
          </div>

          {toPay.length > 0 && (
            <section className={cardClass}>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">{t('cd.refundsToPay')}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('cd.refundsToPayHint')}</p>
              </div>
              <table className="w-full">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {toPay.map((r) => (
                    <tr key={r.id}>
                      <td className={`${tdClass} font-mono text-xs`}>{r.number}</td>
                      <td className={tdClass}>
                        <Link href={`/dashboard/billing/${r.invoiceId}`} className="text-lime-700 dark:text-lime-400 hover:underline">{r.invoiceNumber}</Link> · {r.patientName}
                        <span className="block text-xs text-gray-500">{r.reason}</span>
                      </td>
                      <td className={tdClass}>{t(`cd.method.${r.method}`)}</td>
                      <td className={`${tdClass} text-right font-medium tabular-nums`}>{formatCurrency(r.amount)}</td>
                      <td className={`${tdClass} text-right`}>
                        <button type="button" className={smallBtn} onClick={() => setPaying(r)}>{t('cd.refund.pay')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {detail && detail.id === session.id && (
            <SessionDetailView
              session={detail}
              movementAction={<button type="button" className={smallBtn} onClick={() => setMoving(true)}>{t('cd.movement.add')}</button>}
            />
          )}
        </>
      )}

      <section className={cardClass}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('cd.history')}</h2>
        </div>
        {history === null ? (
          <p className="px-4 py-6 text-sm text-gray-500">{t('cd.loading')}</p>
        ) : history.length === 0 ? (
          <p className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">{t('cd.noHistory')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className={thClass}>{t('cd.sessionNumber')}</th>
                  <th className={thClass}>{t('cd.statusLabel')}</th>
                  <th className={thClass}>{t('cd.opened')}</th>
                  <th className={thClass}>{t('cd.closed')}</th>
                  <th className={`${thClass} text-right`}>{t('cd.expectedCash')}</th>
                  <th className={`${thClass} text-right`}>{t('cd.countedCash')}</th>
                  <th className={`${thClass} text-right`}>{t('cd.variance')}</th>
                  <th className={thClass}>{t('cd.deposit.label')}</th>
                  <th className={thClass}><span className="sr-only">{t('cd.zReport')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {history.map((s) => (
                  <tr key={s.id}>
                    <td className={tdClass}>
                      <Link href={`/dashboard/cash-desk/sessions/${s.id}`} className="font-medium text-lime-700 dark:text-lime-400 hover:underline">{s.number}</Link>
                    </td>
                    <td className={tdClass}><SessionStatusBadge status={s.status} /></td>
                    <td className={tdClass}>{formatDateTime(s.openedAt)}</td>
                    <td className={tdClass}>{s.closedAt ? formatDateTime(s.closedAt) : '—'}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatCurrency(s.totals.expectedCash)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{s.countedCash === null ? '—' : formatCurrency(s.countedCash)}</td>
                    <td className={`${tdClass} text-right`}><VarianceText variance={s.variance} /></td>
                    <td className={tdClass}>
                      {s.status === 'OPEN' ? '—' : s.depositReceivedAt ? <span className="text-green-700 dark:text-green-400">{t('cd.deposit.received')}</span> : <span className="text-amber-700 dark:text-amber-400">{t('cd.deposit.waiting')}</span>}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <button type="button" className={smallBtn} onClick={() => pdf.report(s.id, s.number)}>{s.status === 'OPEN' ? t('cd.xReport') : t('cd.zReport')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {opening && (
        <OpenTillDialog
          onClose={() => setOpening(false)}
          onOpened={(s) => {
            setOpening(false);
            toast.success(t('cd.openedToast', { number: s.number }));
            void refresh();
          }}
        />
      )}
      {closing && session && (
        <CloseTillDialog
          session={session}
          onClose={() => setClosing(false)}
          onClosed={(s) => {
            setClosing(false);
            toast.success(t('cd.closedToast', { number: s.number }));
            void refresh();
          }}
        />
      )}
      {moving && session && (
        <MovementDialog
          session={session}
          onClose={() => setMoving(false)}
          onDone={() => {
            setMoving(false);
            toast.success(t('cd.movement.saved'));
            void refresh(); // the new session summary reloads the detail
          }}
        />
      )}
      {paying && session && (
        <PayRefundDialog
          refund={paying}
          session={session}
          onClose={() => setPaying(null)}
          onDone={() => {
            toast.success(t('cd.refund.paidToast', { number: paying.number }));
            setPaying(null);
            void refresh(); // the new session summary reloads the detail
          }}
        />
      )}
    </div>
  );
}
