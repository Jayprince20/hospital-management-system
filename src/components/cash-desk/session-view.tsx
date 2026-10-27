'use client';

import { useLanguage } from '@/context/language-context';
import { DENOMINATIONS, type CashierSessionDetail } from '@/lib/cash-desk';
import { DrawerBreakdown, MethodTotals, RefundStatusBadge, VarianceText, cardClass, smallBtn, tdClass, thClass, useCashDeskPdf } from './ui';

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={cardClass}>
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">{text}</p>;
}

/** Takings, drawer, payments, cash in/out and refunds of one till session */
export function SessionDetailView({ session, movementAction }: { session: CashierSessionDetail; movementAction?: React.ReactNode }) {
  const { t, formatCurrency, formatTime, formatDateTime } = useLanguage();
  const pdf = useCashDeskPdf();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className={`${cardClass} p-4 lg:col-span-2 space-y-3`}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">{t('cd.byMethod')}</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('cd.paymentsCount', { count: session.totals.paymentsCount })}</span>
          </div>
          <MethodTotals byMethod={session.totals.byMethod} />
          {session.totals.otherRefunds > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('cd.otherRefundsNote', { amount: formatCurrency(session.totals.otherRefunds) })}</p>
          )}
        </section>
        <section className={`${cardClass} p-4 space-y-3`}>
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('cd.drawer')}</h2>
          <DrawerBreakdown session={session} />
          {session.status === 'CLOSED' && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm border-t border-gray-200 dark:border-gray-700 pt-2">
              <dt className="text-gray-500 dark:text-gray-400">{t('cd.countedCash')}</dt>
              <dd className="text-right tabular-nums">{formatCurrency(session.countedCash)}</dd>
              <dt className="text-gray-500 dark:text-gray-400">{t('cd.variance')}</dt>
              <dd className="text-right"><VarianceText variance={session.variance} /></dd>
            </dl>
          )}
        </section>
      </div>

      {session.status === 'CLOSED' && (session.closingNotes || session.denominations) && (
        <Section title={t('cd.closing')}>
          <div className="p-4 space-y-3">
            {session.closingNotes && <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap"><span className="font-medium">{t('cd.close.notes')} :</span> {session.closingNotes}</p>}
            {session.denominations && (
              <div className="flex flex-wrap gap-2">
                {DENOMINATIONS.filter((d) => (session.denominations?.[d.key] ?? 0) > 0).map((d) => (
                  <span key={d.key} className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs tabular-nums">
                    {session.denominations?.[d.key]} × {formatCurrency(d.value)} {t(`cd.close.${d.kind}Short`)}
                  </span>
                ))}
              </div>
            )}
            {session.depositReceivedAt ? (
              <p className="text-sm text-green-700 dark:text-green-400">
                {t('cd.deposit.done', { amount: formatCurrency(session.depositAmount), name: session.depositReceivedBy?.name ?? '—', date: formatDateTime(session.depositReceivedAt) })}
                {session.depositNotes ? ` — ${session.depositNotes}` : ''}
              </p>
            ) : (
              <p className="text-sm text-amber-700 dark:text-amber-400">{t('cd.deposit.pending')}</p>
            )}
          </div>
        </Section>
      )}

      <Section title={t('cd.payments')}>
        {session.payments.length === 0 ? (
          <Empty text={t('cd.noPayments')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className={thClass}>{t('cd.time')}</th>
                  <th className={thClass}>{t('cd.receiptNumber')}</th>
                  <th className={thClass}>{t('cd.invoice')}</th>
                  <th className={thClass}>{t('cd.patient')}</th>
                  <th className={thClass}>{t('cd.methodLabel')}</th>
                  <th className={`${thClass} text-right`}>{t('cd.amount')}</th>
                  <th className={thClass}><span className="sr-only">{t('cd.receipt')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {session.payments.map((p) => (
                  <tr key={p.id}>
                    <td className={`${tdClass} tabular-nums`}>{formatTime(p.processedAt)}</td>
                    <td className={`${tdClass} font-mono text-xs`}>{p.receiptNumber ?? '—'}</td>
                    <td className={tdClass}>{p.invoiceNumber}</td>
                    <td className={tdClass}>{p.patientName}</td>
                    <td className={tdClass}>
                      {t(`cd.method.${p.method}`)}
                      {p.reference ? <span className="block text-xs text-gray-500">{p.reference}</span> : null}
                    </td>
                    <td className={`${tdClass} text-right font-medium tabular-nums`}>{formatCurrency(p.amount)}</td>
                    <td className={`${tdClass} text-right`}>
                      {p.receiptNumber && <button type="button" className={smallBtn} onClick={() => pdf.receipt(p.id, p.receiptNumber)}>{t('cd.printReceipt')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={t('cd.movements')} action={movementAction}>
        {session.movements.length === 0 ? (
          <Empty text={t('cd.noMovements')} />
        ) : (
          <table className="w-full">
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {session.movements.map((m) => (
                <tr key={m.id}>
                  <td className={`${tdClass} tabular-nums w-20`}>{formatTime(m.createdAt)}</td>
                  <td className={tdClass}>
                    <span className="font-medium">{t(`cd.movement.${m.type}`)}</span> · {m.reason}
                    {m.reference ? <span className="text-xs text-gray-500"> ({m.reference})</span> : null}
                  </td>
                  <td className={`${tdClass} text-right font-medium tabular-nums ${m.type === 'PAY_IN' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    {m.type === 'PAY_IN' ? '+' : '−'} {formatCurrency(m.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {session.refunds.length > 0 && (
        <Section title={t('cd.refundsPaid')}>
          <table className="w-full">
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {session.refunds.map((r) => (
                <tr key={r.id}>
                  <td className={`${tdClass} font-mono text-xs`}>{r.number}</td>
                  <td className={tdClass}>{r.invoiceNumber} · {r.patientName}</td>
                  <td className={tdClass}>{t(`cd.method.${r.method}`)}</td>
                  <td className={tdClass}><RefundStatusBadge status={r.status} /></td>
                  <td className={`${tdClass} text-right font-medium tabular-nums text-red-700 dark:text-red-400`}>− {formatCurrency(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}
