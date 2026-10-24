'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import {
  DENOMINATIONS,
  DESK_METHODS,
  cashVariance,
  denominationTotal,
  invalidCount,
  normalizeCounts,
  type CashMovementType,
  type CashierSessionSummary,
  type DeskPaymentMethod,
  type InvoiceRefund,
} from '@/lib/cash-desk';
import { DialogShell, ErrorBox, VarianceText, cancelBtn, dangerBtn, inputClass, labelClass, messageOf, primaryBtn, useCashDeskPdf } from './ui';

const toAmount = (raw: string) => {
  const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

export function OpenTillDialog({ onClose, onOpened }: { onClose: () => void; onOpened: (s: CashierSessionSummary) => void }) {
  const { t } = useLanguage();
  const [float, setFloat] = useState('0');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const amount = toAmount(float);
    if (!Number.isFinite(amount) || amount < 0) return setError(t('cd.floatInvalid'));
    setSaving(true);
    setError('');
    try {
      onOpened(await api.openCashierSession(amount));
    } catch (err) {
      setError(messageOf(err, t('cd.actionFailed')));
      setSaving(false);
    }
  };
  return (
    <DialogShell
      title={t('cd.openTitle')}
      subtitle={t('cd.openHint')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('cd.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={saving}>{t('cd.openMyTill')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="cd-float">{t('cd.float')}</label>
        <input id="cd-float" inputMode="numeric" value={float} onChange={(e) => setFloat(e.target.value)} className={inputClass} autoFocus />
      </div>
    </DialogShell>
  );
}

/** Cash added to (PAY_IN) or taken out of (PAY_OUT) the drawer, with a reason */
export function MovementDialog({ session, onClose, onDone }: { session: CashierSessionSummary; onClose: () => void; onDone: () => void }) {
  const { t, formatCurrency } = useLanguage();
  const [type, setType] = useState<CashMovementType>('PAY_OUT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const value = toAmount(amount);
    if (!Number.isFinite(value) || value <= 0) return setError(t('cd.amountInvalid'));
    if (reason.trim().length < 3) return setError(t('cd.reasonRequired'));
    if (type === 'PAY_OUT' && value > session.totals.expectedCash) return setError(t('cd.notEnoughCash'));
    setSaving(true);
    setError('');
    try {
      await api.addCashMovement(session.id, { type, amount: value, reason: reason.trim(), ...(reference.trim() ? { reference: reference.trim() } : {}) });
      onDone();
    } catch (err) {
      setError(messageOf(err, t('cd.actionFailed')));
      setSaving(false);
    }
  };
  return (
    <DialogShell
      title={t('cd.movement.title')}
      subtitle={t('cd.movement.inDrawer', { amount: formatCurrency(session.totals.expectedCash) })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('cd.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={saving}>{saving ? t('cd.saving') : t('cd.save')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <fieldset className="flex gap-2">
        <legend className="sr-only">{t('cd.movement.type')}</legend>
        {(['PAY_OUT', 'PAY_IN'] as CashMovementType[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            aria-pressed={type === k}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${type === k ? 'border-lime-600 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
          >
            {t(`cd.movement.${k}`)}
          </button>
        ))}
      </fieldset>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t(`cd.movement.${type}.hint`)}</p>
      <div>
        <label className={labelClass} htmlFor="cd-mv-amount">{t('cd.amount')} *</label>
        <input id="cd-mv-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} autoFocus />
      </div>
      <div>
        <label className={labelClass} htmlFor="cd-mv-reason">{t('cd.reason')} *</label>
        <input id="cd-mv-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder={t(`cd.movement.${type}.placeholder`)} />
      </div>
      <div>
        <label className={labelClass} htmlFor="cd-mv-ref">{t('cd.reference')}</label>
        <input id="cd-mv-ref" value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}

/** Closing count by notes and coins; a difference must be explained before closing */
export function CloseTillDialog({ session, onClose, onClosed }: { session: CashierSessionSummary; onClose: () => void; onClosed: (s: CashierSessionSummary) => void }) {
  const { t, formatCurrency } = useLanguage();
  const pdf = useCashDeskPdf();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [closed, setClosed] = useState<CashierSessionSummary | null>(null);
  const expected = session.totals.expectedCash;
  const counted = denominationTotal(counts);
  const variance = cashVariance(counted, expected);
  const hasInvalid = Object.values(counts).some(invalidCount);

  const submit = async () => {
    if (hasInvalid) return setError(t('cd.close.countInvalid'));
    if (variance !== 0 && !notes.trim()) return setError(t('cd.close.explain'));
    setSaving(true);
    setError('');
    try {
      setClosed(await api.closeCashierSession(session.id, { denominations: normalizeCounts(counts), ...(notes.trim() ? { notes: notes.trim() } : {}) }));
    } catch (err) {
      setError(messageOf(err, t('cd.actionFailed')));
    } finally {
      setSaving(false);
    }
  };

  if (closed) {
    return (
      <DialogShell
        title={t('cd.close.doneTitle', { number: closed.number })}
        onClose={() => onClosed(closed)}
        footer={
          <>
            <button type="button" className={cancelBtn} onClick={() => pdf.report(closed.id, closed.number)}>{t('cd.zReport')}</button>
            <button type="button" className={primaryBtn} onClick={() => onClosed(closed)}>{t('cd.done')}</button>
          </>
        }
      >
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500 dark:text-gray-400">{t('cd.expectedCash')}</dt>
          <dd className="text-right tabular-nums">{formatCurrency(closed.totals.expectedCash)}</dd>
          <dt className="text-gray-500 dark:text-gray-400">{t('cd.countedCash')}</dt>
          <dd className="text-right tabular-nums">{formatCurrency(closed.countedCash)}</dd>
          <dt className="text-gray-500 dark:text-gray-400">{t('cd.variance')}</dt>
          <dd className="text-right"><VarianceText variance={closed.variance} withLabel /></dd>
        </dl>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('cd.close.handover')}</p>
      </DialogShell>
    );
  }

  const row = (key: string, value: number) => {
    const raw = counts[key] ?? '';
    const n = normalizeCounts({ [key]: raw })[key];
    return (
      <tr key={key}>
        <td className="py-1 pr-3 text-sm text-gray-700 dark:text-gray-300 tabular-nums">{formatCurrency(value)}</td>
        <td className="py-1 pr-3 w-28">
          <input
            inputMode="numeric"
            value={raw}
            onChange={(e) => setCounts((prev) => ({ ...prev, [key]: e.target.value }))}
            aria-label={t('cd.close.countOf', { value: formatCurrency(value) })}
            className={`w-full px-2 py-1 border rounded-md text-right text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${invalidCount(raw) ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
          />
        </td>
        <td className="py-1 text-right text-sm text-gray-900 dark:text-white tabular-nums">{formatCurrency(n * value)}</td>
      </tr>
    );
  };

  return (
    <DialogShell
      wide
      title={t('cd.close.title', { number: session.number })}
      subtitle={t('cd.close.hint')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose} disabled={saving}>{t('cd.cancel')}</button>
          <button type="button" className={dangerBtn} onClick={submit} disabled={saving}>{saving ? t('cd.saving') : t('cd.closeTill')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {(['note', 'coin'] as const).map((kind) => (
          <div key={kind}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{t(`cd.close.kind.${kind}`)}</h3>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-400">
                  <th className="text-left font-medium pb-1">{t('cd.close.value')}</th>
                  <th className="text-left font-medium pb-1">{t('cd.close.count')}</th>
                  <th className="text-right font-medium pb-1">{t('cd.close.subtotal')}</th>
                </tr>
              </thead>
              <tbody>{DENOMINATIONS.filter((d) => d.kind === kind).map((d) => row(d.key, d.value))}</tbody>
            </table>
          </div>
        ))}
      </div>
      <dl className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 p-3 text-sm">
        <div>
          <dt className="text-gray-500 dark:text-gray-400">{t('cd.expectedCash')}</dt>
          <dd className="font-semibold tabular-nums">{formatCurrency(expected)}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">{t('cd.countedCash')}</dt>
          <dd className="font-semibold tabular-nums">{formatCurrency(counted)}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">{t('cd.variance')}</dt>
          <dd><VarianceText variance={variance} withLabel /></dd>
        </div>
      </dl>
      <div>
        <label className={labelClass} htmlFor="cd-close-notes">{t('cd.close.notes')}{variance !== 0 ? ' *' : ''}</label>
        <textarea id="cd-close-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder={variance !== 0 ? t('cd.close.explainPlaceholder') : ''} />
      </div>
    </DialogShell>
  );
}

/** Admin confirms the cash handed over after closing (versement) */
export function DepositDialog({ session, onClose, onDone }: { session: CashierSessionSummary; onClose: () => void; onDone: () => void }) {
  const { t, formatCurrency } = useLanguage();
  const [amount, setAmount] = useState(String(session.countedCash ?? 0));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const value = toAmount(amount);
  const differs = Number.isFinite(value) && value !== (session.countedCash ?? 0);
  const submit = async () => {
    if (!Number.isFinite(value) || value < 0) return setError(t('cd.amountInvalid'));
    if (differs && !notes.trim()) return setError(t('cd.deposit.explain'));
    setSaving(true);
    setError('');
    try {
      await api.confirmCashierDeposit(session.id, { amount: value, ...(notes.trim() ? { notes: notes.trim() } : {}) });
      onDone();
    } catch (err) {
      setError(messageOf(err, t('cd.actionFailed')));
      setSaving(false);
    }
  };
  return (
    <DialogShell
      title={t('cd.deposit.title', { number: session.number })}
      subtitle={t('cd.deposit.hint', { name: session.cashier.name, amount: formatCurrency(session.countedCash) })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('cd.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={saving}>{t('cd.deposit.confirm')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="cd-dep-amount">{t('cd.deposit.amount')} *</label>
        <input id="cd-dep-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} autoFocus />
      </div>
      <div>
        <label className={labelClass} htmlFor="cd-dep-notes">{t('cd.notes')}{differs ? ' *' : ''}</label>
        <textarea id="cd-dep-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}

/** Ask for money to be given back to the patient; an admin approves before it is paid at a till */
export function RefundRequestDialog({
  invoiceId,
  invoiceNumber,
  refundable,
  payments,
  onClose,
  onDone,
}: {
  invoiceId: string;
  invoiceNumber: string;
  refundable: number;
  payments: Array<{ id: string; receiptNumber?: string | null; amount: number; method: string; processedAt: string }>;
  onClose: () => void;
  onDone: (refund: InvoiceRefund) => void;
}) {
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const [amount, setAmount] = useState(String(refundable));
  const [method, setMethod] = useState<DeskPaymentMethod>('CASH');
  const [paymentId, setPaymentId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const value = toAmount(amount);
    if (!Number.isFinite(value) || value <= 0) return setError(t('cd.amountInvalid'));
    if (value > refundable) return setError(t('cd.refund.tooMuch', { amount: formatCurrency(refundable) }));
    if (reason.trim().length < 5) return setError(t('cd.refund.reasonRequired'));
    setSaving(true);
    setError('');
    try {
      onDone(await api.requestRefund({ invoiceId, amount: value, method, reason: reason.trim(), ...(paymentId ? { paymentId } : {}) }));
    } catch (err) {
      setError(messageOf(err, t('cd.actionFailed')));
      setSaving(false);
    }
  };
  return (
    <DialogShell
      title={t('cd.refund.requestTitle')}
      subtitle={t('cd.refund.requestHint', { number: invoiceNumber, amount: formatCurrency(refundable) })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('cd.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={saving}>{t('cd.refund.request')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="cd-rf-amount">{t('cd.amount')} *</label>
          <input id="cd-rf-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="cd-rf-method">{t('cd.refund.method')} *</label>
          <select id="cd-rf-method" value={method} onChange={(e) => setMethod(e.target.value as DeskPaymentMethod)} className={inputClass}>
            {DESK_METHODS.map((m) => (
              <option key={m} value={m}>{t(`cd.method.${m}`)}</option>
            ))}
          </select>
        </div>
      </div>
      {payments.length > 0 && (
        <div>
          <label className={labelClass} htmlFor="cd-rf-payment">{t('cd.refund.payment')}</label>
          <select id="cd-rf-payment" value={paymentId} onChange={(e) => setPaymentId(e.target.value)} className={inputClass}>
            <option value="">{t('cd.refund.anyPayment')}</option>
            {payments.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.receiptNumber, formatDateTime(p.processedAt), t(`cd.method.${p.method}`), formatCurrency(p.amount)].filter(Boolean).join(' · ')}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelClass} htmlFor="cd-rf-reason">{t('cd.reason')} *</label>
        <textarea id="cd-rf-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder={t('cd.refund.reasonPlaceholder')} />
      </div>
    </DialogShell>
  );
}

/** Admin approves or rejects a refund request (a rejection needs a note) */
export function RefundDecisionDialog({ refund, approve, onClose, onDone }: { refund: InvoiceRefund; approve: boolean; onClose: () => void; onDone: () => void }) {
  const { t, formatCurrency } = useLanguage();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!approve && !note.trim()) return setError(t('cd.reasonRequired'));
    setSaving(true);
    setError('');
    try {
      await api.decideRefund(refund.id, { approve, ...(note.trim() ? { note: note.trim() } : {}) });
      onDone();
    } catch (err) {
      setError(messageOf(err, t('cd.actionFailed')));
      setSaving(false);
    }
  };
  return (
    <DialogShell
      title={t(approve ? 'cd.refund.approveTitle' : 'cd.refund.rejectTitle', { number: refund.number })}
      subtitle={t('cd.refund.summary', { amount: formatCurrency(refund.amount), patient: refund.patientName, invoice: refund.invoiceNumber, method: t(`cd.method.${refund.method}`) })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('cd.cancel')}</button>
          <button type="button" className={approve ? primaryBtn : dangerBtn} onClick={submit} disabled={saving}>{t(approve ? 'cd.refund.approve' : 'cd.refund.reject')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-medium">{t('cd.reason')} :</span> {refund.reason}</p>
      <div>
        <label className={labelClass} htmlFor="cd-rf-note">{t('cd.refund.note')}{approve ? '' : ' *'}</label>
        <textarea id="cd-rf-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}

/** Give an approved refund back to the patient from my till */
export function PayRefundDialog({ refund, session, onClose, onDone }: { refund: InvoiceRefund; session: CashierSessionSummary; onClose: () => void; onDone: () => void }) {
  const { t, formatCurrency } = useLanguage();
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const notEnough = refund.method === 'CASH' && refund.amount > session.totals.expectedCash;
  const submit = async () => {
    if (notEnough) return setError(t('cd.notEnoughCash'));
    setSaving(true);
    setError('');
    try {
      await api.payRefund(refund.id, reference.trim() ? { reference: reference.trim() } : {});
      onDone();
    } catch (err) {
      setError(messageOf(err, t('cd.actionFailed')));
      setSaving(false);
    }
  };
  const summary = useMemo(
    () => t('cd.refund.summary', { amount: formatCurrency(refund.amount), patient: refund.patientName, invoice: refund.invoiceNumber, method: t(`cd.method.${refund.method}`) }),
    [t, formatCurrency, refund]
  );
  return (
    <DialogShell
      title={t('cd.refund.payTitle', { number: refund.number })}
      subtitle={summary}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('cd.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={saving || notEnough}>{t('cd.refund.pay')}</button>
        </>
      }
    >
      <ErrorBox message={error || (notEnough ? t('cd.notEnoughCash') : '')} />
      <p className="text-sm text-gray-600 dark:text-gray-300">{t(refund.method === 'CASH' ? 'cd.refund.payCashHint' : 'cd.refund.payOtherHint')}</p>
      {refund.method !== 'CASH' && (
        <div>
          <label className={labelClass} htmlFor="cd-rf-ref">{t('cd.reference')}</label>
          <input id="cd-rf-ref" value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
        </div>
      )}
    </DialogShell>
  );
}
