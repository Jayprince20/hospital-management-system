'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { indicatorStatus, initialConnectivity, nextConnectivity, pingInterval, type IndicatorStatus, type LinkState } from '@/lib/offline/connectivity';
import { discard as discardItem, listItems, OUTBOX_CHANGE_EVENT, replay, retryItem, type OutboxItem } from '@/lib/offline/outbox';
import { mayCacheFor } from '@/lib/offline/session';
import { OFFLINE_QUEUED_EVENT, setLinkState } from '@/lib/offline/state';
import type { OfflineWriteKind } from '@/lib/offline/classifier';

interface OfflineContextValue {
  link: LinkState;
  status: IndicatorStatus;
  isOffline: boolean;
  items: OutboxItem[];
  pending: number;
  failed: number;
  syncing: boolean;
  authRequired: boolean;
  syncNow: () => Promise<void>;
  retry: (key: string) => Promise<void>;
  discard: (key: string) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

const REPLAY_EVERY_MS = 30_000;

/**
 * Connectivity (browser flag + /api/ping heartbeat) and the outbox of bedside entries made
 * offline, replayed on reconnection, focus, every 30 s and through Background Sync.
 */
export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [conn, dispatch] = useReducer(nextConnectivity, undefined, () => initialConnectivity(typeof navigator === 'undefined' ? true : navigator.onLine));
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const userId = user && mayCacheFor(user.role) ? user.id : null;
  const linkRef = useRef(conn.link);
  // Toasts and translations through refs: their identity may change every render
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  useEffect(() => {
    toastRef.current = toast;
    tRef.current = t;
  }, [toast, t]);

  useEffect(() => {
    linkRef.current = conn.link;
    setLinkState(conn.link);
  }, [conn.link]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    try {
      setItems(await listItems(userId));
    } catch {
      // IndexedDB unavailable (private mode): nothing queued
    }
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (!userId || linkRef.current === 'offline') return;
    setSyncing(true);
    try {
      const result = await replay(userId, (item) => api.replayOutboxItem(item));
      setAuthRequired(result.authRequired);
      if (result.sent > 0) toastRef.current.success(tRef.current('off.synced.title'), tRef.current('off.synced.body', { n: result.sent }));
      if (result.failed > 0) toastRef.current.warning(tRef.current('off.failed.title'), tRef.current('off.failed.body', { n: result.failed }));
    } catch {
      // Retried on the next trigger
    } finally {
      setSyncing(false);
      void refresh();
    }
  }, [userId, refresh]);

  // Browser connectivity events
  useEffect(() => {
    const on = () => dispatch({ type: 'browser-online' });
    const off = () => dispatch({ type: 'browser-offline' });
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Heartbeat: 60 s online, 15 s offline (and right away while checking)
  useEffect(() => {
    let cancelled = false;
    const delay = conn.link === 'checking' ? 0 : pingInterval(conn);
    const timer = setTimeout(async () => {
      const ok = await api.ping();
      if (!cancelled) dispatch(ok ? { type: 'ping-ok', at: Date.now() } : { type: 'ping-fail' });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [conn]);

  // Back online: send what waited
  const wasOnline = useRef(conn.link === 'online');
  useEffect(() => {
    if (conn.link === 'online' && !wasOnline.current) void syncNow();
    wasOnline.current = conn.link === 'online';
  }, [conn.link, syncNow]);

  // Outbox changes, focus, periodic replay, service worker wake-ups
  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    const onFocus = () => void syncNow();
    const onSwMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === 'replay') void syncNow();
    };
    window.addEventListener(OUTBOX_CHANGE_EVENT, onChange);
    window.addEventListener('focus', onFocus);
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    const timer = setInterval(() => void syncNow(), REPLAY_EVERY_MS);
    return () => {
      window.removeEventListener(OUTBOX_CHANGE_EVENT, onChange);
      window.removeEventListener('focus', onFocus);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
      clearInterval(timer);
    };
  }, [refresh, syncNow]);

  // A write was queued: say so, and ask for a Background Sync where the browser has it
  useEffect(() => {
    const onQueued = (event: Event) => {
      const kind = (event as CustomEvent<{ kind: OfflineWriteKind }>).detail?.kind;
      const tr = tRef.current;
      toastRef.current.info(tr('off.queued.title'), tr('off.queued.body', { kind: kind ? tr(`off.kind.${kind}`) : '' }));
      void navigator.serviceWorker?.ready
        .then((reg) => (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync?.register('bb-outbox'))
        .catch(() => undefined);
    };
    window.addEventListener(OFFLINE_QUEUED_EVENT, onQueued);
    return () => window.removeEventListener(OFFLINE_QUEUED_EVENT, onQueued);
  }, []);

  const retry = useCallback(
    async (key: string) => {
      await retryItem(key);
      await syncNow();
    },
    [syncNow]
  );

  const discard = useCallback(async (key: string) => {
    await discardItem(key);
  }, []);

  const value = useMemo<OfflineContextValue>(() => {
    const pending = items.filter((i) => i.status === 'pending').length;
    const failed = items.filter((i) => i.status === 'failed').length;
    return {
      link: conn.link,
      status: indicatorStatus({ link: conn.link, pending, failed, syncing, authRequired }),
      isOffline: conn.link === 'offline',
      items,
      pending,
      failed,
      syncing,
      authRequired,
      syncNow,
      retry,
      discard,
    };
  }, [conn.link, items, syncing, authRequired, syncNow, retry, discard]);

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within an OfflineProvider');
  return ctx;
}

/** Entries of one kind (optionally for one patient/admission/pregnancy) still waiting for the server */
export function usePendingWrites(kind: OfflineWriteKind, scopeId?: string | null): OutboxItem[] {
  const { items } = useOffline();
  return useMemo(() => items.filter((i) => i.kind === kind && (scopeId === undefined || i.scopeId === scopeId)), [items, kind, scopeId]);
}
