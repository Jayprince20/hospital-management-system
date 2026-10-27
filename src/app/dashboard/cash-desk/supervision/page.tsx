'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { todayIso, type CashDeskDaily, type CashierSessionSummary, type InvoiceRefund } from '@/lib/cash-desk';
import { DepositDialog, RefundDecisionDialog } from '@/components/cash-desk/dialogs';
import {
  ErrorBox,
  MethodTotals,
  SessionStatusBadge,
  StatCard,
  VarianceText,
  cardClass,
  inputClass,
  messageOf,
  smallBtn,
  tdClass,
  thClass,
  useCashDeskPdf,
} from '@/components/cash-desk/ui';

export default function CashDeskSupervisionPage() {
  const { t, formatCurrency, formatDateTime, formatTime } = useLanguage();
  const toast = useToast();
  const pdf = useCashDeskPdf();
  const [date, setDate] = useState(todayIso());
  const [daily, setDaily] = useState<CashDeskDaily | null>(null);
  const [refunds, setRefunds] = useState<InvoiceRefund[]>([]);
  const [error, setError] = useState('');
  const [deposit, setDeposit] = useState<CashierSessionSummary | null>(null);
  const [deciding, setDeciding] = useState<{ refund: InvoiceRefund; approve: boolean } | null>(null);

  const load = useCallback(() => {
    Promise.all([api.getCashDeskDaily(date), api.getRefunds({ status: 'REQUESTED' })])
      .then(([d, r]) => {
        setDaily(d);
        setRefunds(r);
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('cd.loadFailed'))));
  }, [date, t]);
  useEffect(() => load(), [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('cd.sup.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('cd.sup.subtitle')}</p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1" htmlFor="cd-sup-date">{t('cd.sup.date')}</label>
          <input id="cd-sup-date" type="date" value={date} max={todayIso()} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      <ErrorBox message={error} />
      {!daily ? (
        !error && <p className="text-gray-500">{t('cd.loading')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={t('cd.sup.takings')}
              value={formatCurrency(Object.values(daily.totals.byMethod).reduce((sum, v) => sum + v, 0))}
              hint={t('cd.paymentsCount', { count: daily.totals.paymentsCount })}
            />
            <StatCard label={t('cd.sup.openTills')} value={String(daily.openTills)} tone={daily.openTills > 0 ? 'warn' : 'default'} />
            <StatCard label={t('cd.sup.pendingDeposits')} value={String(daily.pendingDeposits)} tone={daily.pendingDeposits > 0 ? 'warn' : 'default'} />
            <StatCard
              label={t('cd.sup.variance')}
              value={`${daily.totals.variance > 0 ? '+' : ''}${formatCurrency(daily.totals.variance)}`}
              tone={daily.totals.variance === 0 ? 'good' : daily.totals.variance < 0 ? 'bad' : 'warn'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className={`${cardClass} p-4 lg:col-span-2 space-y-3`}>
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('cd.sup.deskByMethod')}</h2>
              <MethodTotals byMethod={daily.totals.byMethod} />
            </section>
            <section className={`${cardClass} p-4 space-y-2 text-sm`}>
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('cd.sup.otherMoney')}</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <dt className="text-gray-500 dark:text-gray-400">{t('cd.sup.electronic', { method: t('cd.method.MTN_MOMO') })}</dt>
                <dd className="text-right tabular-nums">{formatCurrency(daily.electronic.MTN_MOMO)}</dd>
                <dt className="text-gray-500 dark:text-gray-400">{t('cd.sup.electronic', { method: t('cd.method.ORANGE_MONEY') })}</dt>
                <dd className="text-right tabular-nums">{formatCurrency(daily.electronic.ORANGE_MONEY)}</dd>
                <dt className="text-gray-500 dark:text-gray-400">{t('cd.sup.insurer')}</dt>
                <dd className="text-right tabular-nums">{formatCurrency(daily.insurerSettlements)}</dd>
                <dt className="text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-1.5">{t('cd.payIns')}</dt>
                <dd className="text-right tabular-nums border-t border-gray-200 dark:border-gray-700 pt-1.5">{formatCurrency(daily.totals.payIns)}</dd>
                <dt className="text-gray-500 dark:text-gray-400">{t('cd.payOuts')}</dt>
                <dd className="text-right tabular-nums">{formatCurrency(daily.totals.payOuts)}</dd>
                <dt className="text-gray-500 dark:text-gray-400">{t('cd.sup.refunds')}</dt>
                <dd className="text-right tabular-nums">{formatCurrency(daily.totals.cashRefunds + daily.totals.otherRefunds)}</dd>
                <dt className="text-gray-500 dark:text-gray-400">{t('cd.sup.deposits')}</dt>
                <dd className="text-right tabular-nums">{formatCurrency(daily.totals.deposits)}</dd>
              </dl>
            </section>
          </div>

          <section className={cardClass}>
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('cd.sup.sessions')}</h2>
            </div>
            {daily.sessions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">{t('cd.sup.noSessions')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className={thClass}>{t('cd.sessionNumber')}</th>
                      <th className={thClass}>{t('cd.cashier')}</th>
                      <th className={thClass}>{t('cd.statusLabel')}</th>
                      <th className={thClass}>{t('cd.hours')}</th>
                      <th className={`${thClass} text-right`}>{t('cd.sup.takingsShort')}</th>
                      <th className={`${thClass} text-right`}>{t('cd.expectedCash')}</th>
                      <th className={`${thClass} text-right`}>{t('cd.countedCash')}</th>
                      <th className={`${thClass} text-right`}>{t('cd.variance')}</th>
                      <th className={thClass}>{t('cd.deposit.label')}</th>
                      <th className={thClass}><span className="sr-only">{t('cd.actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {daily.sessions.map((s) => (
                      <tr key={s.id}>
                        <td className={tdClass}>
                          <Link href={`/dashboard/cash-desk/sessions/${s.id}`} className="font-medium text-lime-700 dark:text-lime-400 hover:underline">{s.number}</Link>
                        </td>
                        <td className={tdClass}>{s.cashier.name}</td>
                        <td className={tdClass}><SessionStatusBadge status={s.status} /></td>
                        <td className={`${tdClass} tabular-nums whitespace-nowrap`}>{formatTime(s.openedAt)} – {s.closedAt ? formatTime(s.closedAt) : '…'}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{formatCurrency(Object.values(s.totals.byMethod).reduce((sum, v) => sum + v, 0))}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{formatCurrency(s.totals.expectedCash)}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{s.countedCash === null ? '—' : formatCurrency(s.countedCash)}</td>
                        <td className={`${tdClass} text-right`}><VarianceText variance={s.variance} /></td>
                        <td className={tdClass}>
                          {s.status === 'OPEN' ? (
                            '—'
                          ) : s.depositReceivedAt ? (
                            <span className="text-green-700 dark:text-green-400" title={formatDateTime(s.depositReceivedAt)}>
                              {formatCurrency(s.depositAmount)} · {s.depositReceivedBy?.name ?? ''}
                            </span>
                          ) : (
                            <button type="button" className={smallBtn} onClick={() => setDeposit(s)}>{t('cd.deposit.confirm')}</button>
                          )}
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
        </>
      )}

      <section className={cardClass}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('cd.sup.refundsToApprove')}</h2>
        </div>
        {refunds.length === 0 ? (
          <p className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">{t('cd.sup.noRefunds')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className={thClass}>{t('cd.refund.number')}</th>
                  <th className={thClass}>{t('cd.invoice')}</th>
                  <th className={thClass}>{t('cd.reason')}</th>
                  <th className={thClass}>{t('cd.refund.requestedBy')}</th>
                  <th className={thClass}>{t('cd.methodLabel')}</th>
                  <th className={`${thClass} text-right`}>{t('cd.amount')}</th>
                  <th className={thClass}><span className="sr-only">{t('cd.actions')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {refunds.map((r) => (
                  <tr key={r.id}>
                    <td className={`${tdClass} font-mono text-xs`}>{r.number}</td>
                    <td className={tdClass}>
                      <Link href={`/dashboard/billing/${r.invoiceId}`} className="text-lime-700 dark:text-lime-400 hover:underline">{r.invoiceNumber}</Link>
                      <span className="block text-xs text-gray-500">{r.patientName}</span>
                    </td>
                    <td className={`${tdClass} max-w-xs`}>{r.reason}</td>
                    <td className={tdClass}>
                      {r.requestedBy?.name ?? '—'}
                      <span className="block text-xs text-gray-500">{formatDateTime(r.requestedAt)}</span>
                    </td>
                    <td className={tdClass}>{t(`cd.method.${r.method}`)}</td>
                    <td className={`${tdClass} text-right font-medium tabular-nums`}>{formatCurrency(r.amount)}</td>
                    <td className={`${tdClass} text-right whitespace-nowrap space-x-1`}>
                      <button type="button" className={smallBtn} onClick={() => setDeciding({ refund: r, approve: true })}>{t('cd.refund.approve')}</button>
                      <button type="button" className={smallBtn} onClick={() => setDeciding({ refund: r, approve: false })}>{t('cd.refund.reject')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {deposit && (
        <DepositDialog
          session={deposit}
          onClose={() => setDeposit(null)}
          onDone={() => {
            toast.success(t('cd.deposit.savedToast', { number: deposit.number }));
            setDeposit(null);
            load();
          }}
        />
      )}
      {deciding && (
        <RefundDecisionDialog
          refund={deciding.refund}
          approve={deciding.approve}
          onClose={() => setDeciding(null)}
          onDone={() => {
            toast.success(t(deciding.approve ? 'cd.refund.approvedToast' : 'cd.refund.rejectedToast', { number: deciding.refund.number }));
            setDeciding(null);
            load();
          }}
        />
      )}
    </div>
  );
}
