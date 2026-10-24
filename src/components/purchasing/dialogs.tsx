'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import {
  SUPPLIER_PAYMENT_METHODS,
  addDaysIso,
  invoiceBalance,
  isoDay,
  receiptInputFrom,
  receiptProblems,
  remainingOf,
  type InvoiceMatch,
  type PurchaseOrderDetail,
  type ReceiptDraftLine,
  type SupplierInvoice,
  type SupplierPaymentMethod,
} from '@/lib/purchasing';
import { DialogShell, ErrorBox, cancelBtn, inputClass, labelClass, messageOf, primaryBtn } from './ui';

const cellInput = 'w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-lime-500 focus:border-transparent';

/** Goods receipt against an order: what arrived per line, batch and expiry for medications */
export function ReceiveDialog({ order, onClose, onDone }: { order: PurchaseOrderDetail; onClose: () => void; onDone: (fully: boolean) => void }) {
  const { t, formatCurrency } = useLanguage();
  const open = order.items.filter((i) => remainingOf(i) > 0);
  const [lines, setLines] = useState<ReceiptDraftLine[]>(
    open.map((i) => ({
      itemId: i.id,
      isMedication: Boolean(i.medicationId),
      remaining: remainingOf(i),
      quantityReceived: String(remainingOf(i)),
      quantityRejected: '',
      rejectionReason: '',
      batchNumber: '',
      expiryDate: '',
      unitCost: String(i.unitPrice),
    }))
  );
  const [deliveryNoteRef, setDeliveryNoteRef] = useState('');
  const [notes, setNotes] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const problems = receiptProblems(lines);
  const problemsAt = (index: number) => problems.filter((p) => p.index === index);
  const update = (index: number, patch: Partial<ReceiptDraftLine>) => setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const value = lines.reduce((s, l) => s + (Number(l.quantityReceived) || 0) * (Number(l.unitCost) || 0), 0);

  const submit = async () => {
    setShowErrors(true);
    if (problems.length) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.receivePurchaseOrder(order.id, receiptInputFrom(lines, { deliveryNoteRef, notes }));
      onDone(res.order?.status === 'RECEIVED');
    } catch (err) {
      setError(messageOf(err, t('pur.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={t('pur.rcv.title')}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('pur.rcv.title')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('pur.rcv.subtitle', { number: order.orderNumber, supplier: order.supplier.name })}</p>
        </div>
        <div className="p-5 space-y-4">
          <ErrorBox message={error} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="rcv-ref">{t('pur.rcv.deliveryNote')}</label>
              <input id="rcv-ref" type="text" value={deliveryNoteRef} onChange={(e) => setDeliveryNoteRef(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="rcv-notes">{t('pur.notes')}</label>
              <input id="rcv-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-2 py-2 text-left">{t('pur.product')}</th>
                  <th className="px-2 py-2 text-right">{t('pur.remaining')}</th>
                  <th className="px-2 py-2 text-right w-24">{t('pur.rcv.accepted')}</th>
                  <th className="px-2 py-2 text-right w-24">{t('pur.rcv.rejected')}</th>
                  <th className="px-2 py-2 text-left w-40">{t('pur.rcv.rejectionReason')}</th>
                  <th className="px-2 py-2 text-left w-32">{t('pur.rcv.batch')}</th>
                  <th className="px-2 py-2 text-left w-36">{t('pur.rcv.expiry')}</th>
                  <th className="px-2 py-2 text-right w-28">{t('pur.rcv.unitCost')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {open.map((item, i) => {
                  const l = lines[i];
                  const lineProblems = showErrors ? problemsAt(i) : [];
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-2 py-2">
                        <span className="font-medium text-gray-900 dark:text-white">{item.itemName}</span>
                        <span className="block text-xs text-gray-500">{t(item.medicationId ? 'pur.kind.MEDICATION' : 'pur.kind.INVENTORY')}</span>
                        {lineProblems.map((p) => (
                          <span key={p.key} className="block text-xs text-red-600 dark:text-red-400">{t(p.key)}</span>
                        ))}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{l.remaining}</td>
                      <td className="px-2 py-2"><input type="number" min={0} step={1} value={l.quantityReceived} onChange={(e) => update(i, { quantityReceived: e.target.value })} className={`${cellInput} text-right`} aria-label={t('pur.rcv.accepted')} /></td>
                      <td className="px-2 py-2"><input type="number" min={0} step={1} value={l.quantityRejected} onChange={(e) => update(i, { quantityRejected: e.target.value })} className={`${cellInput} text-right`} aria-label={t('pur.rcv.rejected')} /></td>
                      <td className="px-2 py-2">
                        <input type="text" value={l.rejectionReason} onChange={(e) => update(i, { rejectionReason: e.target.value })} disabled={!(Number(l.quantityRejected) > 0)} placeholder={t('pur.rcv.rejectionPlaceholder')} className={cellInput} aria-label={t('pur.rcv.rejectionReason')} />
                      </td>
                      <td className="px-2 py-2">
                        {l.isMedication ? <input type="text" value={l.batchNumber} onChange={(e) => update(i, { batchNumber: e.target.value })} className={cellInput} aria-label={t('pur.rcv.batch')} /> : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-2 py-2">
                        {l.isMedication ? <input type="date" min={addDaysIso(isoDay(), 1)} value={l.expiryDate} onChange={(e) => update(i, { expiryDate: e.target.value })} className={cellInput} aria-label={t('pur.rcv.expiry')} /> : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-2 py-2"><input type="number" min={0} step={1} value={l.unitCost} onChange={(e) => update(i, { unitCost: e.target.value })} className={`${cellInput} text-right`} aria-label={t('pur.rcv.unitCost')} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {showErrors && problemsAt(-1).map((p) => <p key={p.key} className="text-sm text-red-600 dark:text-red-400">{t(p.key)}</p>)}
          <p className="text-sm text-gray-600 dark:text-gray-300 text-right">{t('pur.rcv.value')} <strong className="tabular-nums">{formatCurrency(value)}</strong></p>
        </div>
        <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button type="button" className={cancelBtn} onClick={onClose} disabled={busy}>{t('pur.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={busy}>{busy ? t('pur.saving') : t('pur.rcv.confirm')}</button>
        </div>
      </div>
    </div>
  );
}

/** Record the supplier's invoice; the answer shows the 3-way match (ordered / received / invoiced) */
export function InvoiceDialog({ order, onClose, onDone }: { order: PurchaseOrderDetail; onClose: () => void; onDone: () => void }) {
  const { t, formatCurrency } = useLanguage();
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(isoDay());
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<InvoiceMatch | null>(null);

  const submit = async () => {
    setError('');
    if (!invoiceNumber.trim() || !invoiceDate || !(Number(amount) > 0)) return setError(t('pur.inv.err.required'));
    setBusy(true);
    try {
      const created = await api.createSupplierInvoice({
        supplierId: order.supplierId,
        purchaseOrderId: order.id,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        ...(dueDate ? { dueDate } : {}),
        amount: Number(amount),
      });
      if (created.match) setMatch(created.match);
      else onDone();
    } catch (err) {
      setError(messageOf(err, t('pur.actionFailed')));
    } finally {
      setBusy(false);
    }
  };

  if (match) {
    return (
      <DialogShell title={t('pur.inv.matchTitle')} onClose={onDone} wide footer={<button type="button" className={primaryBtn} onClick={onDone}>{t('pur.close')}</button>}>
        <MatchSummary match={match} />
      </DialogShell>
    );
  }

  return (
    <DialogShell
      title={t('pur.inv.record')}
      subtitle={t('pur.inv.recordSubtitle', { number: order.orderNumber, supplier: order.supplier.name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose} disabled={busy}>{t('pur.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={busy}>{busy ? t('pur.saving') : t('pur.save')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="inv-number">{t('pur.inv.number')} *</label>
        <input id="inv-number" type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="inv-date">{t('pur.inv.date')} *</label>
          <input id="inv-date" type="date" max={isoDay()} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="inv-due">{t('pur.inv.dueDate')}</label>
          <input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          <p className="text-xs text-gray-500 mt-1">{t('pur.inv.dueDateHint')}</p>
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="inv-amount">{t('pur.inv.amount')} *</label>
        <input id="inv-amount" type="number" min={0} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        <p className="text-xs text-gray-500 mt-1">{t('pur.inv.orderTotal', { amount: formatCurrency(order.totalAmount) })}</p>
      </div>
    </DialogShell>
  );
}

export function MatchSummary({ match }: { match: InvoiceMatch }) {
  const { t, formatCurrency } = useLanguage();
  const rows: Array<[string, number]> = [
    ['pur.match.ordered', match.orderedValue],
    ['pur.match.received', match.receivedValue],
    ['pur.match.previouslyInvoiced', match.previouslyInvoiced],
    ['pur.match.difference', match.difference],
  ];
  return (
    <div className="space-y-3">
      <div className={`p-3 rounded-lg text-sm font-medium ${match.ok ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'}`}>
        {match.ok ? t('pur.match.ok') : t('pur.match.differences')}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {rows.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-700 py-1">
            <dt className="text-gray-600 dark:text-gray-400">{t(key)}</dt>
            <dd className="font-medium tabular-nums text-gray-900 dark:text-white">{formatCurrency(value)}</dd>
          </div>
        ))}
      </dl>
      {match.notes.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
          {match.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Payment of an approved supplier invoice (administrators) */
export function PaymentDialog({ invoice, onClose, onDone }: { invoice: SupplierInvoice; onClose: () => void; onDone: () => void }) {
  const { t, formatCurrency } = useLanguage();
  const balance = invoiceBalance(invoice);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<SupplierPaymentMethod>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(isoDay());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    const value = Number(amount);
    if (!(value > 0)) return setError(t('pur.pay.err.amount'));
    if (value > balance) return setError(t('pur.pay.err.tooMuch'));
    setBusy(true);
    try {
      await api.recordSupplierPayment(invoice.id, { amount: value, method, paidAt, ...(reference.trim() ? { reference: reference.trim() } : {}) });
      onDone();
    } catch (err) {
      setError(messageOf(err, t('pur.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={t('pur.pay.title')}
      subtitle={t('pur.pay.subtitle', { number: invoice.invoiceNumber, balance: formatCurrency(balance) })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose} disabled={busy}>{t('pur.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={busy}>{busy ? t('pur.saving') : t('pur.pay.confirm')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="pay-amount">{t('pur.amount')} *</label>
          <input id="pay-amount" type="number" min={1} max={balance} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pay-date">{t('pur.pay.date')} *</label>
          <input id="pay-date" type="date" max={isoDay()} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="pay-method">{t('pur.pay.method')}</label>
        <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as SupplierPaymentMethod)} className={inputClass}>
          {SUPPLIER_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`pur.pay.method.${m}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="pay-ref">{t('pur.pay.reference')}</label>
        <input id="pay-ref" type="text" value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}
