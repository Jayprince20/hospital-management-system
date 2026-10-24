'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';
import {
  availableActions,
  canReceive,
  canRecordInvoice,
  invoiceBalance,
  personName,
  receivedPercentOf,
  remainingOf,
  type PurchaseOrderAction,
  type PurchaseOrderDetail,
  type SupplierInvoice,
} from '@/lib/purchasing';
import { InvoiceDialog, PaymentDialog, ReceiveDialog } from '@/components/purchasing/dialogs';
import { InvoiceActions } from '@/components/purchasing/tabs';
import {
  DialogShell,
  ErrorBox,
  InvoiceStatusBadge,
  PoStatusBadge,
  ProgressBar,
  ReasonDialog,
  cancelBtn,
  cardClass,
  dangerBtn,
  inputClass,
  labelClass,
  messageOf,
  primaryBtn,
  smallBtn,
  useIsAdmin,
  usePurchaseOrderPdf,
} from '@/components/purchasing/ui';

type ReasonAction = 'reject' | 'cancel' | 'close';

export default function PurchaseOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const { t, formatCurrency, formatDate, formatDateTime } = useLanguage();
  const toast = useToast();
  const openPdf = usePurchaseOrderPdf();
  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [sending, setSending] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [recordingInvoice, setRecordingInvoice] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [disputing, setDisputing] = useState<SupplierInvoice | null>(null);
  const [paying, setPaying] = useState<SupplierInvoice | null>(null);

  const load = useCallback(() => {
    api
      .getPurchaseOrder(id)
      .then((o) => { setOrder(o); setError(''); })
      .catch((err) => setError(messageOf(err, t('pur.loadFailed'))));
  }, [id, t]);
  useEffect(() => load(), [load]);

  if (!order) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/purchasing" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('pur.backToList')}</Link>
        <ErrorBox message={error} />
        {!error && <p className="text-sm text-gray-500">{t('pur.loading')}</p>}
      </div>
    );
  }

  const actions = availableActions(order.status, user?.role, order.receipts.length > 0);
  const itemName = (itemId: string) => order.items.find((i) => i.id === itemId)?.itemName ?? '—';
  const rejectedNote = order.status === 'DRAFT' && order.cancelReason ? order.cancelReason : null;

  const run = async (action: PurchaseOrderAction, extra: { reason?: string; email?: string } = {}) => {
    setBusy(true);
    try {
      const res = await api.purchaseOrderAction(order.id, action, extra);
      if (action === 'submit') toast.success(res.autoApproved ? t('pur.done.autoApproved') : t('pur.done.submitted'));
      else if (action === 'send') toast.success(t('pur.done.sent'), extra.email ? (res.emailed ? t('pur.done.emailed', { email: extra.email }) : t('pur.done.emailFailed')) : undefined);
      else toast.success(t(`pur.done.${action}`));
      load();
    } catch (err) {
      toast.error(t('pur.actionFailed'), messageOf(err, ''));
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const onAction = (action: PurchaseOrderAction) => {
    if (action === 'reject' || action === 'cancel' || action === 'close') setReasonAction(action);
    else if (action === 'send') setSending(true);
    else run(action).catch(() => undefined);
  };

  const timeline: Array<{ key: string; at?: string | null; who?: string; extra?: string }> = [
    { key: 'created', at: order.createdAt, who: personName(order.createdBy) },
    { key: 'submitted', at: order.submittedAt },
    { key: 'approved', at: order.approvedAt, who: personName(order.approvedBy) },
    { key: 'ordered', at: order.orderedAt, extra: order.sentToEmail ? t('pur.timeline.emailedTo', { email: order.sentToEmail }) : undefined },
    { key: 'received', at: order.receivedAt },
    ...(order.cancelledAt ? [{ key: 'cancelled', at: order.cancelledAt, extra: order.cancelReason ?? undefined }] : []),
  ];

  return (
    <div className="space-y-4">
      <Link href="/dashboard/purchasing" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('pur.backToList')}</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{order.orderNumber}</h1>
            <PoStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {order.supplier.name}
            {order.expectedAt ? ` · ${t('pur.expectedOn', { date: formatDate(order.expectedAt.slice(0, 10)) })}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cancelBtn} onClick={() => openPdf(order.id, order.orderNumber)}>{t('pur.pdf')}</button>
          {order.status === 'DRAFT' && <Link href={`/dashboard/purchasing/${order.id}/edit`} className={cancelBtn}>{t('pur.edit')}</Link>}
          {order.status === 'DRAFT' && <button type="button" className={cancelBtn} onClick={() => setDeleting(true)}>{t('pur.delete')}</button>}
          {actions.map((a) => (
            <button key={a} type="button" disabled={busy} onClick={() => onAction(a)} className={a === 'cancel' || a === 'reject' ? dangerBtn : a === 'close' ? cancelBtn : primaryBtn}>
              {t(`pur.action.${a}`)}
            </button>
          ))}
          {canReceive(order.status) && <button type="button" className={primaryBtn} onClick={() => setReceiving(true)}>{t('pur.receive')}</button>}
        </div>
      </div>

      <ErrorBox message={error} />
      {rejectedNote && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{rejectedNote}</div>}
      {order.status === 'SUBMITTED' && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm">
          {isAdmin ? t('pur.awaitingYourApproval') : t('pur.awaitingApproval', { threshold: formatCurrency(order.threshold) })}
        </div>
      )}
      {order.status === 'DRAFT' && order.approvalRequired && !isAdmin && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm">{t('pur.form.approvalRequired', { threshold: formatCurrency(order.threshold) })}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardClass} p-4 lg:col-span-2 space-y-3`}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">{t('pur.lines')}</h2>
            {order.status !== 'DRAFT' && order.status !== 'CANCELLED' && <div className="w-48"><ProgressBar percent={receivedPercentOf(order.items)} /></div>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left">{t('pur.product')}</th>
                  <th className="px-3 py-2 text-right">{t('pur.ordered')}</th>
                  <th className="px-3 py-2 text-right">{t('pur.receivedQty')}</th>
                  <th className="px-3 py-2 text-right">{t('pur.remaining')}</th>
                  <th className="px-3 py-2 text-right">{t('pur.unitPrice')}</th>
                  <th className="px-3 py-2 text-right">{t('pur.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {order.items.map((item) => {
                  const remaining = remainingOf(item);
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <span className="font-medium text-gray-900 dark:text-white">{item.itemName}</span>
                        <span className="block text-xs text-gray-500">{t(item.medicationId ? 'pur.kind.MEDICATION' : 'pur.kind.INVENTORY')}{item.inventoryItem?.unit ? ` · ${item.inventoryItem.unit}` : ''}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{item.quantityReceived}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${remaining > 0 && order.status === 'PARTIALLY_RECEIVED' ? 'text-amber-700 dark:text-amber-400 font-semibold' : ''}`}>{remaining}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td colSpan={5} className="px-3 py-3 text-right font-semibold">{t('pur.total')}</td>
                  <td className="px-3 py-3 text-right text-lg font-bold tabular-nums text-gray-900 dark:text-white">{formatCurrency(order.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {order.notes && <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-medium">{t('pur.notes')} :</span> {order.notes}</p>}
        </div>

        <div className="space-y-4">
          <div className={`${cardClass} p-4`}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">{t('pur.supplier')}</h2>
            <p className="font-medium text-gray-900 dark:text-white">{order.supplier.name}</p>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
              {(order.supplier.contactName) && <p>{order.supplier.contactPerson || order.supplier.contactName}</p>}
              {order.supplier.phone && <p>{order.supplier.phone}</p>}
              {order.supplier.email && <p>{order.supplier.email}</p>}
              {order.supplier.address && <p>{order.supplier.address}</p>}
            </div>
          </div>
          <div className={`${cardClass} p-4`}>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">{t('pur.timeline.title')}</h2>
            <ol className="space-y-2">
              {timeline.map((step) => (
                <li key={step.key} className="flex gap-2 text-sm">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${step.at ? (step.key === 'cancelled' ? 'bg-red-500' : 'bg-lime-500') : 'bg-gray-300 dark:bg-gray-600'}`} aria-hidden="true" />
                  <div>
                    <p className={step.at ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>{t(`pur.timeline.${step.key}`)}</p>
                    {step.at && <p className="text-xs text-gray-500">{formatDateTime(step.at)}{step.who ? ` · ${step.who}` : ''}</p>}
                    {step.extra && <p className="text-xs text-gray-500">{step.extra}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {(order.receipts.length > 0 || canReceive(order.status)) && (
        <div className={`${cardClass} p-4 space-y-3`}>
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('pur.receipts')}</h2>
          {order.receipts.length === 0 && <p className="text-sm text-gray-500">{t('pur.noReceipt')}</p>}
          {order.receipts.map((r) => (
            <div key={r.id} className="border border-gray-100 dark:border-gray-700 rounded-lg">
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/40 flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-medium text-gray-900 dark:text-white">{r.number}{r.deliveryNoteRef ? ` · ${t('pur.rcv.deliveryNoteShort', { ref: r.deliveryNoteRef })}` : ''}</span>
                <span className="text-gray-500">{formatDateTime(r.receivedAt)}{personName(r.receivedBy) ? ` · ${personName(r.receivedBy)}` : ''}</span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {r.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-1.5">{l.itemName ?? itemName(l.itemId)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{t('pur.rcv.acceptedCount', { count: l.quantityReceived })}</td>
                      <td className="px-3 py-1.5 text-red-600 dark:text-red-400">{l.quantityRejected > 0 ? t('pur.rcv.rejectedCount', { count: l.quantityRejected, reason: l.rejectionReason ?? '' }) : ''}</td>
                      <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{l.batchNumber ? t('pur.rcv.batchInfo', { batch: l.batchNumber, date: l.expiryDate ? formatDate(l.expiryDate.slice(0, 10)) : '—' }) : ''}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{l.quantityReceived} × {formatCurrency(l.unitCost)} = <strong>{formatCurrency(l.quantityReceived * l.unitCost)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.notes && <p className="px-3 py-2 text-xs text-gray-500">{r.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {(order.invoices.length > 0 || canRecordInvoice(order.status)) && (
        <div className={`${cardClass} p-4 space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">{t('pur.invoices')}</h2>
            {canRecordInvoice(order.status) && <button type="button" className={smallBtn} onClick={() => setRecordingInvoice(true)}>{t('pur.inv.record')}</button>}
          </div>
          {order.invoices.length === 0 && <p className="text-sm text-gray-500">{t('pur.noInvoice')}</p>}
          {order.invoices.map((inv) => (
            <div key={inv.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">{inv.invoiceNumber}</span>
                  <InvoiceStatusBadge status={inv.status} />
                </div>
                <InvoiceActions invoice={inv} isAdmin={isAdmin} onApprove={() => invoiceAction(inv, 'approve')} onResolve={() => invoiceAction(inv, 'resolve')} onDispute={() => setDisputing(inv)} onPay={() => setPaying(inv)} />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('pur.inv.summary', { date: formatDate(inv.invoiceDate.slice(0, 10)), due: formatDate(inv.dueDate.slice(0, 10)), amount: formatCurrency(inv.amount), balance: formatCurrency(invoiceBalance(inv)) })}
              </p>
              {inv.matchNotes && <p className="text-sm text-amber-800 dark:text-amber-300 whitespace-pre-line">{inv.matchNotes}</p>}
              {inv.payments && inv.payments.length > 0 && (
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                  {inv.payments.map((p) => (
                    <li key={p.id}>{t('pur.pay.line', { date: formatDate(p.paidAt.slice(0, 10)), amount: formatCurrency(p.amount), method: t(`pur.pay.method.${p.method}`) })}{p.reference ? ` · ${p.reference}` : ''}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {reasonAction && (
        <ReasonDialog
          title={t(`pur.reasonTitle.${reasonAction}`, { number: order.orderNumber })}
          message={t(`pur.reasonHelp.${reasonAction}`)}
          confirmLabel={t(`pur.action.${reasonAction}`)}
          danger={reasonAction !== 'close'}
          onClose={() => setReasonAction(null)}
          onConfirm={async (reason) => {
            await run(reasonAction, { reason });
            setReasonAction(null);
          }}
        />
      )}
      {sending && <SendDialog order={order} onClose={() => setSending(false)} onSend={async (email) => { await run('send', email ? { email } : {}); setSending(false); }} />}
      {receiving && (
        <ReceiveDialog
          order={order}
          onClose={() => setReceiving(false)}
          onDone={(fully) => { setReceiving(false); toast.success(fully ? t('pur.rcv.doneFull') : t('pur.rcv.donePartial')); load(); }}
        />
      )}
      {recordingInvoice && <InvoiceDialog order={order} onClose={() => setRecordingInvoice(false)} onDone={() => { setRecordingInvoice(false); toast.success(t('pur.inv.recorded')); load(); }} />}
      {disputing && (
        <ReasonDialog
          title={t('pur.inv.disputeTitle', { number: disputing.invoiceNumber })}
          confirmLabel={t('pur.inv.dispute')}
          danger
          onClose={() => setDisputing(null)}
          onConfirm={async (reason) => {
            await api.supplierInvoiceAction(disputing.id, 'dispute', reason);
            toast.success(t('pur.inv.done.dispute', { number: disputing.invoiceNumber }));
            setDisputing(null);
            load();
          }}
        />
      )}
      {paying && <PaymentDialog invoice={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); toast.success(t('pur.pay.done')); load(); }} />}
      <ConfirmModal
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          try {
            await api.deletePurchaseOrder(order.id);
            toast.success(t('pur.done.deleted'));
            router.push('/dashboard/purchasing');
          } catch (err) {
            toast.error(t('pur.actionFailed'), messageOf(err, ''));
            setDeleting(false);
          }
        }}
        title={t('pur.deleteTitle', { number: order.orderNumber })}
        message={t('pur.deleteMessage')}
        confirmText={t('pur.delete')}
        cancelText={t('pur.cancel')}
      />
    </div>
  );

  async function invoiceAction(inv: SupplierInvoice, action: 'approve' | 'resolve') {
    try {
      await api.supplierInvoiceAction(inv.id, action);
      toast.success(t(`pur.inv.done.${action}`, { number: inv.invoiceNumber }));
      load();
    } catch (err) {
      toast.error(t('pur.actionFailed'), messageOf(err, ''));
    }
  }
}

/** Mark the order as sent to the supplier, optionally e-mailing the bon de commande */
function SendDialog({ order, onClose, onSend }: { order: PurchaseOrderDetail; onClose: () => void; onSend: (email?: string) => Promise<void> }) {
  const { t } = useLanguage();
  const [byEmail, setByEmail] = useState(Boolean(order.supplier.email));
  const [email, setEmail] = useState(order.supplier.email ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setError('');
    if (byEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t('pur.send.invalidEmail'));
    setBusy(true);
    try {
      await onSend(byEmail ? email.trim() : undefined);
    } catch (err) {
      setError(messageOf(err, t('pur.actionFailed')));
      setBusy(false);
    }
  };
  return (
    <DialogShell
      title={t('pur.send.title', { number: order.orderNumber })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose} disabled={busy}>{t('pur.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={busy}>{t('pur.action.send')}</button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-300">{t('pur.send.help')}</p>
      <ErrorBox message={error} />
      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={byEmail} onChange={(e) => setByEmail(e.target.checked)} className="w-4 h-4 text-lime-600 rounded" />
        {t('pur.send.byEmail')}
      </label>
      {byEmail && (
        <div>
          <label className={labelClass} htmlFor="send-email">{t('pur.send.email')}</label>
          <input id="send-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
      )}
    </DialogShell>
  );
}
