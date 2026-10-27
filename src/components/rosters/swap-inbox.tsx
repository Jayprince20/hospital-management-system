'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type ShiftSwap, type SwapStatus } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { ShiftChip, cardClass, messageOf, smallBtn, useDayLabel } from './ui';

const STATUS_STYLE: Record<SwapStatus, string> = {
  PENDING_PEER: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PENDING_MANAGER: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * Shift swaps: the ones I asked for, the ones a colleague asked me to answer, and — for an
 * admin or head of department — the ones waiting for approval.
 */
export function SwapInbox({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const dayLabel = useDayLabel();
  const [mine, setMine] = useState<ShiftSwap[] | null>(null);
  const [toApprove, setToApprove] = useState<ShiftSwap[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api.getShiftSwaps('mine').then(setMine).catch(() => setMine([]));
    // Only managers get anything here; others get an empty list or a 403
    api.getShiftSwaps('to-approve').then(setToApprove).catch(() => setToApprove([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, fn: () => Promise<void>, done: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(t(done));
      load();
      onChanged?.();
    } catch (err) {
      toast.error(t('ros.actionFailed'), messageOf(err, ''));
    } finally {
      setBusy(null);
    }
  };

  const describe = (s: ShiftSwap) => (
    <div className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
      <p className="flex flex-wrap items-center gap-1.5">
        <ShiftChip shiftType={s.fromShift.shiftType} size="xs" />
        <span>{dayLabel(s.fromShift.date)}</span>
        <span className="text-gray-500 dark:text-gray-400">{t('ros.swap.from', { name: s.requesterName ?? s.fromShift.userName })}</span>
        <span aria-hidden="true">→</span>
        <span className="text-gray-500 dark:text-gray-400">{s.peerName ?? ''}</span>
      </p>
      {s.toShift && (
        <p className="flex flex-wrap items-center gap-1.5 text-gray-600 dark:text-gray-300">
          {t('ros.swap.inReturnShort')} <ShiftChip shiftType={s.toShift.shiftType} size="xs" /> {dayLabel(s.toShift.date)}
        </p>
      )}
      {s.message && <p className="text-xs text-gray-500 dark:text-gray-400">« {s.message} »</p>}
    </div>
  );

  const toAnswer = (mine ?? []).filter((s) => s.status === 'PENDING_PEER' && s.peerId === user?.id);
  const sent = (mine ?? []).filter((s) => !(s.status === 'PENDING_PEER' && s.peerId === user?.id));

  return (
    <section className={`${cardClass} p-5 space-y-5`} aria-labelledby="swap-inbox-title">
      <h2 id="swap-inbox-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('ros.swap.inbox')}</h2>

      {toApprove.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('ros.swap.toApprove')}</h3>
          <ul className="space-y-2">
            {toApprove.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-sky-50 dark:bg-sky-900/20">
                {describe(s)}
                <div className="flex gap-2 shrink-0">
                  <button type="button" disabled={busy === s.id} onClick={() => act(s.id, () => api.decideShiftSwap(s.id, false), 'ros.swap.rejectedToast')} className={smallBtn}>{t('ros.swap.reject')}</button>
                  <button type="button" disabled={busy === s.id} onClick={() => act(s.id, () => api.decideShiftSwap(s.id, true), 'ros.swap.approvedToast')} className="px-2.5 py-1 text-xs font-medium rounded-md bg-brand hover:bg-brand-hover text-white disabled:opacity-50">{t('ros.swap.approve')}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('ros.swap.toAnswer')}</h3>
        {toAnswer.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('ros.swap.noneToAnswer')}</p>
        ) : (
          <ul className="space-y-2">
            {toAnswer.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                {describe(s)}
                <div className="flex gap-2 shrink-0">
                  <button type="button" disabled={busy === s.id} onClick={() => act(s.id, () => api.answerShiftSwap(s.id, false), 'ros.swap.declinedToast')} className={smallBtn}>{t('ros.swap.decline')}</button>
                  <button type="button" disabled={busy === s.id} onClick={() => act(s.id, () => api.answerShiftSwap(s.id, true), 'ros.swap.acceptedToast')} className="px-2.5 py-1 text-xs font-medium rounded-md bg-brand hover:bg-brand-hover text-white disabled:opacity-50">{t('ros.swap.accept')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {sent.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('ros.swap.history')}</h3>
          <ul className="space-y-2">
            {sent.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                {describe(s)}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[s.status]}`}>{t(`ros.swapStatus.${s.status}`)}</span>
                  {s.requesterId === user?.id && (s.status === 'PENDING_PEER' || s.status === 'PENDING_MANAGER') && (
                    <button type="button" disabled={busy === s.id} onClick={() => act(s.id, () => api.cancelShiftSwap(s.id), 'ros.swap.cancelledToast')} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                      {t('ros.swap.cancel')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
