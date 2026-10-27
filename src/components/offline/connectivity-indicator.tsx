'use client';

import { useEffect, useRef, useState } from 'react';
import { useOffline } from '@/context/offline-context';
import { useLanguage } from '@/context/language-context';
import type { OutboxItem } from '@/lib/offline/outbox';

const STYLE: Record<string, string> = {
  online: 'text-ink-muted dark:text-gray-400',
  offline: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700',
  syncing: 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-900/40 dark:text-sky-100 dark:border-sky-700',
  failed: 'bg-red-50 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-100 dark:border-red-700',
  auth: 'bg-red-50 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-100 dark:border-red-700',
};

/** Header pill: online / offline / syncing / entries to review, opening the outbox panel */
export function ConnectivityIndicator() {
  const { status, pending, failed, link } = useOffline();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label =
    status === 'offline'
      ? t('off.status.offline')
      : status === 'syncing'
        ? t('off.status.syncing', { n: pending })
        : status === 'failed'
          ? t('off.status.failed', { n: failed })
          : status === 'auth'
            ? t('off.status.auth', { n: pending })
            : link === 'checking'
              ? t('off.status.checking')
              : t('off.status.online');

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        className={`flex items-center gap-2 h-9 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          status === 'online' ? 'w-9 justify-center hover:bg-canvas dark:hover:bg-gray-800' : `px-3 border ${STYLE[status]}`
        }`}
      >
        <span
          aria-hidden="true"
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            status === 'online' ? 'bg-green-500' : status === 'offline' ? 'bg-amber-500' : status === 'syncing' ? 'bg-sky-500 animate-pulse' : 'bg-red-500'
          }`}
        />
        {/* Online: just the dot (the label is for screen readers); otherwise the state in words */}
        <span className={status === 'online' ? 'sr-only' : 'hidden md:inline max-w-56 truncate'}>{label}</span>
        {status !== 'online' && (pending > 0 || failed > 0) && <span className="md:hidden">{pending + failed}</span>}
      </button>
      <span role="status" aria-live="polite" className="sr-only">{status === 'online' ? '' : label}</span>
      {open && <OutboxPanel onClose={() => setOpen(false)} />}
    </div>
  );
}

function OutboxPanel({ onClose }: { onClose: () => void }) {
  const { items, syncNow, retry, discard, syncing, isOffline, authRequired } = useOffline();
  const { t, formatDateTime } = useLanguage();
  const [confirming, setConfirming] = useState<string | null>(null);
  const pendingItems = items.filter((i) => i.status === 'pending');
  const failedItems = items.filter((i) => i.status === 'failed');

  const row = (item: OutboxItem) => (
    <li key={item.key} className="py-2 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink dark:text-white">{t(`off.kind.${item.kind}`)}</p>
        <p className="text-xs text-ink-muted dark:text-gray-400">
          {t('off.panel.savedAt', { when: formatDateTime(new Date(item.createdAt)) })}
          {item.status === 'pending' && item.attempts > 0 && item.nextAttemptAt > 0
            ? ` · ${t('off.panel.nextTry', { when: formatDateTime(new Date(item.nextAttemptAt), { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })}`
            : ''}
        </p>
        {item.lastError && <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{item.lastError}</p>}
      </div>
      {item.status === 'failed' && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          {confirming === item.key ? (
            <>
              <span className="text-xs text-red-700 dark:text-red-300">{t('off.panel.discardConfirm')}</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => setConfirming(null)} className="px-2 py-1 text-xs rounded-lg border border-line dark:border-gray-600">
                  {t('off.panel.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(null);
                    void discard(item.key);
                  }}
                  className="px-2 py-1 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white"
                >
                  {t('off.panel.confirm')}
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-1">
              <button type="button" onClick={() => void retry(item.key)} disabled={isOffline} className="px-2 py-1 text-xs rounded-lg border border-line dark:border-gray-600 disabled:opacity-50">
                {t('off.panel.retry')}
              </button>
              <button type="button" onClick={() => setConfirming(item.key)} className="px-2 py-1 text-xs rounded-lg border border-red-300 text-red-700 dark:text-red-300 dark:border-red-700">
                {t('off.panel.discard')}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );

  return (
    <div role="dialog" aria-label={t('off.panel.title')} className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] z-50 rounded-2xl border border-line dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-ink dark:text-white">{t('off.panel.title')}</h2>
        <button type="button" onClick={onClose} className="text-xs text-ink-muted hover:text-ink dark:text-gray-400" aria-label={t('off.panel.close')}>
          ✕
        </button>
      </div>
      {authRequired && pendingItems.length > 0 && <p className="text-xs rounded-lg bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200 p-2">{t('off.panel.authHelp')}</p>}
      {items.length === 0 && <p className="text-sm text-ink-muted dark:text-gray-400">{t('off.panel.empty')}</p>}
      {failedItems.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">{t('off.panel.failed')} ({failedItems.length})</h3>
          <p className="text-xs text-ink-muted dark:text-gray-400 mt-1">{t('off.panel.failedHelp')}</p>
          <ul className="divide-y divide-line dark:divide-gray-700">{failedItems.map(row)}</ul>
        </section>
      )}
      {pendingItems.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400">{t('off.panel.pending')} ({pendingItems.length})</h3>
          <ul className="divide-y divide-line dark:divide-gray-700 max-h-64 overflow-y-auto">{pendingItems.map(row)}</ul>
        </section>
      )}
      {pendingItems.length > 0 && (
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing || isOffline}
          className="w-full px-3 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold disabled:opacity-50"
        >
          {t('off.panel.syncNow')}
        </button>
      )}
    </div>
  );
}

/** Small amber chip for rows entered offline and not on the server yet */
export function PendingSyncBadge({ className = '' }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 ${className}`}>
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {t('off.pending')}
    </span>
  );
}

/** For forms that need the server: disables submit and says why while offline */
export function useOnlineOnly(): { offline: boolean; hint: string | undefined } {
  const { isOffline } = useOffline();
  const { t } = useLanguage();
  return { offline: isOffline, hint: isOffline ? t('off.unavailable') : undefined };
}

export function OfflineUnavailableNote({ className = '' }: { className?: string }) {
  const { isOffline } = useOffline();
  const { t } = useLanguage();
  if (!isOffline) return null;
  return (
    <p role="status" className={`text-xs font-medium text-amber-800 dark:text-amber-200 ${className}`}>
      {t('off.unavailable')}
    </p>
  );
}
