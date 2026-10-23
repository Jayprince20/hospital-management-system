'use client';

import { useMemo, useState } from 'react';
import type { SalePaymentMethod } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { PAYMENT_METHODS, changeDue, paymentNeedsReference } from '@/lib/pharmacy-pos';
import { DialogShell, ErrorBox, cancelBtn, inputClass, labelClass, primaryBtn } from './ui';

export interface PaymentChoice {
  paymentMethod: SalePaymentMethod;
  amountTendered?: number;
  paymentReference?: string;
}

/** Cash notes customers usually hand over, to tender in one tap */
function quickAmounts(total: number): number[] {
  const steps = [500, 1000, 2000, 5000, 10000];
  const out = new Set<number>([total]);
  for (const step of steps) {
    const rounded = Math.ceil(total / step) * step;
    if (rounded > total) out.add(rounded);
    if (out.size >= 5) break;
  }
  return [...out].sort((a, b) => a - b);
}

export function PaymentDialog({
  total,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  total: number;
  saving: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (choice: PaymentChoice) => void;
}) {
  const { t, formatCurrency } = useLanguage();
  const [method, setMethod] = useState<SalePaymentMethod>('CASH');
  const [tendered, setTendered] = useState('');
  const [reference, setReference] = useState('');
  const [localError, setLocalError] = useState('');
  const tenderedAmount = tendered.trim() ? Number(tendered.replace(/\s/g, '').replace(',', '.')) : null;
  const change = changeDue(total, tenderedAmount);
  const quick = useMemo(() => quickAmounts(total), [total]);

  const confirm = () => {
    if (method === 'CASH') {
      if (tenderedAmount === null || change === null) return setLocalError(t('pos.pay.notEnoughCash'));
      return onConfirm({ paymentMethod: 'CASH', amountTendered: Math.round(tenderedAmount) });
    }
    if (paymentNeedsReference(method) && !reference.trim()) return setLocalError(t('pos.pay.referenceRequired'));
    onConfirm({ paymentMethod: method, paymentReference: reference.trim() });
  };

  return (
    <DialogShell
      title={t('pos.pay.title')}
      subtitle={t('pos.pay.amountDue', { amount: formatCurrency(total) })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose} disabled={saving}>{t('pos.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={confirm} disabled={saving}>
            {saving ? t('pos.saving') : t('pos.pay.confirm')}
          </button>
        </>
      }
    >
      <ErrorBox message={localError || error} />
      <div>
        <span className={labelClass}>{t('pos.pay.method')}</span>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMethod(m); setLocalError(''); }}
              aria-pressed={method === m}
              className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                method === m
                  ? 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t(`pos.method.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {method === 'CASH' ? (
        <div className="space-y-3">
          <div>
            <label className={labelClass} htmlFor="pay-tendered">{t('pos.pay.tendered')}</label>
            <input
              id="pay-tendered"
              inputMode="numeric"
              value={tendered}
              onChange={(e) => { setTendered(e.target.value); setLocalError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && confirm()}
              className={`${inputClass} text-lg`}
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quick.map((amount) => (
                <button key={amount} type="button" onClick={() => setTendered(String(amount))} className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  {amount === total ? t('pos.pay.exact') : formatCurrency(amount)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('pos.pay.change')}</span>
            <span className={`text-2xl font-bold ${change === null ? 'text-gray-400' : 'text-lime-700 dark:text-lime-400'}`}>
              {change === null ? '—' : formatCurrency(change)}
            </span>
          </div>
        </div>
      ) : (
        <div>
          <label className={labelClass} htmlFor="pay-ref">{method === 'CARD' ? t('pos.pay.cardRef') : t('pos.pay.momoRef')}</label>
          <input
            id="pay-ref"
            value={reference}
            onChange={(e) => { setReference(e.target.value); setLocalError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && confirm()}
            className={inputClass}
            autoFocus
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{method === 'CARD' ? t('pos.pay.cardHint') : t('pos.pay.momoHint')}</p>
        </div>
      )}
    </DialogShell>
  );
}
