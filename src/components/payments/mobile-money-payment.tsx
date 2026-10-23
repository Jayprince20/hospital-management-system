'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui';
import { api, localizeServerMessage, type MobileMoneyProvider, type MobileMoneyTransaction } from '@/lib/api';
import { formatCameroonPhone, normalizeCameroonPhone, operatorOf } from '@/lib/phone';
import { useLanguage } from '@/context/language-context';

// How often the open request is re-checked; the backend asks the operator at most every 5 s
const POLL_INTERVAL_MS = 4000;

export interface PayableInvoice {
  id: string;
  invoiceNumber: string;
  balance: number;
  patientName?: string;
  patientPhone?: string;
}

interface MobileMoneyPaymentProps {
  invoice: PayableInvoice;
  isOpen: boolean;
  onClose: () => void;
  /** Called when the request ends (paid, failed, expired or cancelled) so the caller can refresh */
  onFinished?: (transaction: MobileMoneyTransaction) => void;
  /** Staff collecting at the desk can play the payer's answer in sandbox mode; patients can't */
  canSimulate?: boolean;
  /** The patient pays for themselves (portal): wording addresses them directly */
  payerIsUser?: boolean;
}

type Step = 'form' | 'waiting' | 'done';

const OPERATOR_STYLES: Record<MobileMoneyProvider, { selected: string; dot: string }> = {
  MTN_MOMO: { selected: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20', dot: 'bg-yellow-400' },
  ORANGE_MONEY: { selected: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20', dot: 'bg-orange-500' },
};

function remainingLabel(expiresAt: string, now: number): string {
  const seconds = Math.max(0, Math.round((Date.parse(expiresAt) - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Collect an invoice payment by MTN Mobile Money or Orange Money, from request to receipt */
export function MobileMoneyPayment({ invoice, isOpen, onClose, onFinished, canSimulate = false, payerIsUser = false }: MobileMoneyPaymentProps) {
  const { t, formatCurrency } = useLanguage();
  const initialPhone = invoice.patientPhone ? normalizeCameroonPhone(invoice.patientPhone) ?? '' : '';
  const [step, setStep] = useState<Step>('form');
  const [phone, setPhone] = useState(initialPhone ? formatCameroonPhone(initialPhone) : '');
  const [provider, setProvider] = useState<MobileMoneyProvider>(operatorOf(initialPhone) ?? 'MTN_MOMO');
  const [providerChosen, setProviderChosen] = useState(false);
  const [amount, setAmount] = useState(String(Math.round(invoice.balance)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [transaction, setTransaction] = useState<MobileMoneyTransaction | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const finishedRef = useRef(false);

  const detected = operatorOf(phone);
  const operatorName = (p: MobileMoneyProvider) => (p === 'MTN_MOMO' ? t('pay.mtn') : t('pay.orange'));

  const finish = (tx: MobileMoneyTransaction) => {
    setTransaction(tx);
    setStep('done');
    if (!finishedRef.current) {
      finishedRef.current = true;
      onFinished?.(tx);
    }
  };

  // Poll the open request and tick the countdown
  useEffect(() => {
    if (step !== 'waiting' || !transaction) return;
    const id = transaction.id;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        const latest = await api.getMobileMoneyTransaction(id);
        if (latest.isComplete) finish(latest);
        else setTransaction(latest);
      } catch {
        // Network hiccup: try again on the next tick
      }
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, transaction?.id]);

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    const operator = operatorOf(value);
    if (operator && !providerChosen) setProvider(operator);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!normalizeCameroonPhone(phone)) {
      setError(t('pay.invalidPhone'));
      return;
    }
    const value = Number(amount);
    const max = Math.round(invoice.balance);
    if (!Number.isInteger(value) || value < 1 || value > max) {
      setError(t('pay.amountInvalid', { max: formatCurrency(max).replace(' FCFA', '') }));
      return;
    }
    setBusy(true);
    try {
      const tx = await api.payWithMobileMoney({
        invoiceId: invoice.id,
        provider,
        phoneNumber: phone,
        amount: value === max ? undefined : value,
      });
      finishedRef.current = false;
      setTransaction(tx);
      setNow(Date.now());
      setStep('waiting');
      // Orange live payments may need the payer to approve on Orange's page
      if (tx.paymentUrl) window.open(tx.paymentUrl, '_blank', 'noopener');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pay.failed.generic'));
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async () => {
    if (!transaction) return;
    setBusy(true);
    try {
      await api.cancelMobileMoneyTransaction(transaction.id);
      finish(await api.getMobileMoneyTransaction(transaction.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pay.failed.generic'));
    } finally {
      setBusy(false);
    }
  };

  const simulate = async (action: 'approve' | 'decline') => {
    if (!transaction) return;
    setBusy(true);
    setError('');
    try {
      await api.simulateMobileMoney(transaction.id, action);
      const latest = await api.getMobileMoneyTransaction(transaction.id);
      if (latest.isComplete) finish(latest);
      else setTransaction(latest);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pay.failed.generic'));
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setStep('form');
    setTransaction(null);
    setError('');
  };

  const failureText = (tx: MobileMoneyTransaction) => {
    if (tx.status === 'EXPIRED') return t('pay.failed.expired');
    if (tx.status === 'CANCELLED') return t('pay.failed.cancelled');
    return tx.failureReason ? localizeServerMessage(tx.failureReason) : t('pay.failed.generic');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" closeOnBackdrop={step !== 'waiting'}>
      <Modal.Header>{t('pay.title')}</Modal.Header>
      <Modal.Body>
        <div className="mb-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">{t('pay.invoice', { number: invoice.invoiceNumber })}</span>
            {invoice.patientName && <span className="font-medium text-gray-900 dark:text-white">{invoice.patientName}</span>}
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">{t('pay.balance')}</span>
            <span className="font-semibold text-orange-600">{formatCurrency(transaction?.invoice?.balance ?? invoice.balance)}</span>
          </div>
        </div>

        {step === 'form' && (
          <form id="mobile-money-form" onSubmit={submit} className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{t('pay.operator')}</p>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('pay.operator')}>
                {(['MTN_MOMO', 'ORANGE_MONEY'] as MobileMoneyProvider[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={provider === option}
                    onClick={() => {
                      setProvider(option);
                      setProviderChosen(true);
                    }}
                    className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-white transition-colors ${
                      provider === option ? OPERATOR_STYLES[option].selected : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span className={`h-3 w-3 rounded-full ${OPERATOR_STYLES[option].dot}`} />
                    {operatorName(option)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="mm-phone" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('pay.phone')}
              </label>
              <input
                id="mm-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder={t('pay.phoneHint')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              />
              {detected && detected === provider && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('pay.operatorDetected')}</p>
              )}
              {detected && detected !== provider && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  {t('pay.operatorMismatch', { operator: operatorName(detected) })}{' '}
                  <button type="button" onClick={() => setProvider(detected)} className="font-medium underline">
                    {t('pay.useOperator', { operator: operatorName(detected) })}
                  </button>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="mm-amount" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('pay.amount')}
              </label>
              <input
                id="mm-amount"
                type="number"
                inputMode="numeric"
                min={1}
                max={Math.round(invoice.balance)}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              />
            </div>
          </form>
        )}

        {step === 'waiting' && transaction && (
          <div className="space-y-4 text-center" aria-live="polite">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-lime-200 border-t-lime-600" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{t('pay.waiting.title')}</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {payerIsUser
                  ? t('pay.waiting.askSelf', { phone: transaction.phoneNumber })
                  : t('pay.waiting.ask', { phone: transaction.phoneNumber })}
              </p>
              <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(transaction.amount)} · {operatorName(transaction.provider)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('pay.waiting.expiresIn', { time: remainingLabel(transaction.expiresAt, now) })}
              </p>
            </div>
            {transaction.paymentUrl && (
              <a href={transaction.paymentUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-lime-700 underline">
                {t('pay.waiting.openPage')}
              </a>
            )}
            {canSimulate && transaction.gateway === 'SANDBOX' && (
              <div className="rounded-lg border-2 border-dashed border-sky-300 bg-sky-50 dark:bg-sky-900/20 p-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">{t('pay.sandbox.title')}</p>
                <p className="mt-1 text-sm text-sky-900 dark:text-sky-200">{t('pay.sandbox.text')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => simulate('approve')}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {t('pay.sandbox.approve')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => simulate('decline')}
                    className="rounded-lg border border-sky-600 px-3 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 disabled:opacity-50"
                  >
                    {t('pay.sandbox.decline')}
                  </button>
                </div>
                <p className="mt-2 text-xs text-sky-800/80 dark:text-sky-300/80">{t('pay.sandbox.hint')}</p>
              </div>
            )}
          </div>
        )}

        {step === 'done' && transaction && (
          transaction.isSuccessful ? (
            <div className="space-y-2 text-center" aria-live="polite">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">{t('pay.success.title')}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {t('pay.success.text', { amount: formatCurrency(transaction.amount), operator: operatorName(transaction.provider) })}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{payerIsUser ? t('pay.success.receiptSelf') : t('pay.success.receipt')}</p>
              {transaction.invoice && (
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {transaction.invoice.balance > 0
                    ? t('pay.success.balance', { amount: formatCurrency(transaction.invoice.balance) })
                    : t('pay.success.paidInFull')}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-center" aria-live="polite">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">{t('pay.failed.title')}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{failureText(transaction)}</p>
            </div>
          )
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        {step === 'form' && (
          <>
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              {t('pay.cancel')}
            </button>
            <button
              type="submit"
              form="mobile-money-form"
              disabled={busy}
              className="rounded-lg bg-lime-600 px-4 py-2 font-medium text-white hover:bg-lime-700 disabled:opacity-50"
            >
              {busy ? t('pay.sending') : t('pay.submit')}
            </button>
          </>
        )}
        {step === 'waiting' && (
          <button
            type="button"
            onClick={cancelRequest}
            disabled={busy}
            className="rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            {busy ? t('pay.waiting.cancelling') : t('pay.waiting.cancel')}
          </button>
        )}
        {step === 'done' && (
          <>
            {transaction && !transaction.isSuccessful && (
              <button type="button" onClick={retry} className="rounded-lg px-4 py-2 text-lime-700 hover:bg-lime-50 dark:hover:bg-lime-900/30">
                {t('pay.failed.retry')}
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-lg bg-lime-600 px-4 py-2 font-medium text-white hover:bg-lime-700">
              {t('pay.close')}
            </button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}
