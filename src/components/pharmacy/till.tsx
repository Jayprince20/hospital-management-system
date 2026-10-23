'use client';

import { useState } from 'react';
import { api, type CashSessionSummary } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { DialogShell, ErrorBox, cancelBtn, cardClass, inputClass, labelClass, messageOf, primaryBtn, dangerBtn, usePharmacyPdf } from './ui';

const toAmount = (raw: string) => {
  const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

export function OpenTillDialog({ onClose, onOpened }: { onClose: () => void; onOpened: (s: CashSessionSummary) => void }) {
  const { t } = useLanguage();
  const [float, setFloat] = useState('0');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const amount = toAmount(float);
    if (!Number.isFinite(amount) || amount < 0) return setError(t('pos.till.floatInvalid'));
    setSaving(true);
    setError('');
    try {
      onOpened(await api.openCashSession(amount));
    } catch (err) {
      setError(messageOf(err, t('pos.actionFailed')));
      setSaving(false);
    }
  };
  return (
    <DialogShell
      title={t('pos.till.openTitle')}
      subtitle={t('pos.till.openHint')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('pos.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={saving}>{t('pos.till.open')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="till-float">{t('pos.till.float')}</label>
        <input id="till-float" inputMode="numeric" value={float} onChange={(e) => setFloat(e.target.value)} className={inputClass} autoFocus />
      </div>
    </DialogShell>
  );
}

export function CloseTillDialog({ session, onClose, onClosed }: { session: CashSessionSummary; onClose: () => void; onClosed: (s: CashSessionSummary) => void }) {
  const { t, formatCurrency } = useLanguage();
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [closed, setClosed] = useState<CashSessionSummary | null>(null);
  const openPdf = usePharmacyPdf();
  const expected = session.totals.expectedCashNow;
  const countedAmount = toAmount(counted);
  const variance = counted.trim() && Number.isFinite(countedAmount) ? countedAmount - expected : null;

  const submit = async () => {
    if (!counted.trim() || !Number.isFinite(countedAmount) || countedAmount < 0) return setError(t('pos.till.countedInvalid'));
    setSaving(true);
    setError('');
    try {
      const result = await api.closeCashSession(session.id, { countedCash: countedAmount, ...(notes.trim() ? { notes: notes.trim() } : {}) });
      setClosed(result);
      setSaving(false);
    } catch (err) {
      setError(messageOf(err, t('pos.actionFailed')));
      setSaving(false);
    }
  };

  if (closed) {
    return (
      <DialogShell
        title={t('pos.till.closedTitle', { number: closed.number })}
        onClose={() => onClosed(closed)}
        footer={
          <>
            <button type="button" className={cancelBtn} onClick={() => openPdf('session-report', closed.id)}>{t('pos.till.zReport')}</button>
            <button type="button" className={primaryBtn} onClick={() => onClosed(closed)}>{t('pos.done')}</button>
          </>
        }
      >
        <TillFigures expected={closed.expectedCash ?? expected} counted={closed.countedCash ?? countedAmount} variance={closed.variance ?? (variance ?? 0)} />
      </DialogShell>
    );
  }

  return (
    <DialogShell
      title={t('pos.till.closeTitle', { number: session.number })}
      subtitle={t('pos.till.closeHint')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('pos.cancel')}</button>
          <button type="button" className={dangerBtn} onClick={submit} disabled={saving}>{t('pos.till.close')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-500 dark:text-gray-400">{t('pos.till.float')}</dt>
        <dd className="text-right text-gray-900 dark:text-white">{formatCurrency(session.openingFloat)}</dd>
        <dt className="text-gray-500 dark:text-gray-400">{t('pos.till.cashSales')}</dt>
        <dd className="text-right text-gray-900 dark:text-white">{formatCurrency(session.totals.byMethod.CASH)}</dd>
        <dt className="text-gray-500 dark:text-gray-400">{t('pos.till.cashRefunds')}</dt>
        <dd className="text-right text-gray-900 dark:text-white">− {formatCurrency(session.totals.refunds.CASH)}</dd>
        <dt className="font-semibold text-gray-700 dark:text-gray-200">{t('pos.till.expected')}</dt>
        <dd className="text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(expected)}</dd>
      </dl>
      <div>
        <label className={labelClass} htmlFor="till-counted">{t('pos.till.counted')}</label>
        <input id="till-counted" inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value)} className={inputClass} autoFocus />
      </div>
      {variance !== null && <VarianceLine variance={variance} />}
      <div>
        <label className={labelClass} htmlFor="till-notes">{t('pos.notes')}</label>
        <textarea id="till-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}

export function VarianceLine({ variance }: { variance: number }) {
  const { t, formatCurrency } = useLanguage();
  const tone = variance === 0 ? 'text-green-700 dark:text-green-400' : variance > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400';
  const label = variance === 0 ? t('pos.till.balanced') : variance > 0 ? t('pos.till.over') : t('pos.till.short');
  return (
    <p className={`text-sm font-semibold ${tone}`}>
      {t('pos.till.variance')} : {variance > 0 ? '+' : ''}{formatCurrency(variance)} · {label}
    </p>
  );
}

function TillFigures({ expected, counted, variance }: { expected: number; counted: number; variance: number }) {
  const { t, formatCurrency } = useLanguage();
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-500 dark:text-gray-400">{t('pos.till.expected')}</dt>
        <dd className="text-right text-gray-900 dark:text-white">{formatCurrency(expected)}</dd>
        <dt className="text-gray-500 dark:text-gray-400">{t('pos.till.counted')}</dt>
        <dd className="text-right text-gray-900 dark:text-white">{formatCurrency(counted)}</dd>
      </dl>
      <VarianceLine variance={variance} />
    </div>
  );
}

/** Status strip at the top of the counter: which till is open and how much it took */
export function TillBar({ session, loading, onOpen, onClose }: { session: CashSessionSummary | null; loading: boolean; onOpen: () => void; onClose: () => void }) {
  const { t, formatCurrency, formatTime } = useLanguage();
  if (loading) return <div className={`${cardClass} p-4 text-sm text-gray-500`}>{t('pos.loading')}</div>;
  if (!session) {
    return (
      <div className={`${cardClass} p-4 flex flex-wrap items-center justify-between gap-3 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20`}>
        <p className="text-sm text-amber-800 dark:text-amber-200">{t('pos.till.closedBanner')}</p>
        <button type="button" className={primaryBtn} onClick={onOpen}>{t('pos.till.open')}</button>
      </div>
    );
  }
  return (
    <div className={`${cardClass} p-4 flex flex-wrap items-center justify-between gap-3`}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" aria-hidden="true" />
          {t('pos.till.openLabel', { number: session.number })}
        </span>
        <span className="text-gray-600 dark:text-gray-300">{t('pos.till.since', { time: formatTime(session.openedAt), name: session.openedByName ?? '—' })}</span>
        <span className="text-gray-600 dark:text-gray-300">{t('pos.till.salesCount', { count: session.totals.salesCount })}</span>
        <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(session.totals.net)}</span>
        <span className="text-gray-500 dark:text-gray-400">{t('pos.till.cashInDrawer', { amount: formatCurrency(session.totals.expectedCashNow) })}</span>
      </div>
      <button type="button" className={dangerBtn} onClick={onClose}>{t('pos.till.close')}</button>
    </div>
  );
}

/** Opens/closes the till and keeps the current session in sync */
export function useTillToasts() {
  const toast = useToast();
  const { t } = useLanguage();
  return {
    opened: (s: CashSessionSummary) => toast.success(t('pos.till.openedToast', { number: s.number })),
    closed: (s: CashSessionSummary) => toast.success(t('pos.till.closedToast', { number: s.number })),
  };
}
