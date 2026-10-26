/**
 * Offline outbox: bedside writes made without a connection, kept in IndexedDB and replayed in
 * order when the server answers again. Each item keeps the Idempotency-Key generated for the
 * user's action, so a replay that already reached the server is answered from its first result.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { OfflineWriteKind } from './classifier';

export interface OutboxItem {
  /** Idempotency-Key sent with every attempt */
  key: string;
  userId: string;
  /** Insertion order (replays follow it) */
  seq: number;
  method: 'POST';
  /** API path with its query string, without the base URL */
  path: string;
  body: Record<string, unknown> | null;
  kind: OfflineWriteKind;
  scopeId: string | null;
  /** When the user saved it (bedside time) */
  createdAt: number;
  status: 'pending' | 'failed';
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  lastStatus: number | null;
}

/** What happened when one item was sent */
export type SendOutcome =
  | { kind: 'ok' }
  | { kind: 'client-error'; status: number; message: string }
  | { kind: 'server-error'; status: number; message?: string }
  | { kind: 'network' }
  | { kind: 'auth' };

export interface ReplayResult {
  sent: number;
  failed: number;
  remaining: number;
  /** The session expired and could not be refreshed: the queue waits for a new login */
  authRequired: boolean;
  /** Stopped on a network/server error (order is kept: later items wait) */
  stopped: boolean;
}

interface OutboxDb extends DBSchema {
  outbox: { key: string; value: OutboxItem; indexes: { byUser: string } };
}

const DB_NAME = 'bb-offline';
export const OUTBOX_CHANGE_EVENT = 'bb-outbox-change';
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const BASE_BACKOFF_MS = 2000;

let dbPromise: Promise<IDBPDatabase<OutboxDb>> | null = null;

function db(): Promise<IDBPDatabase<OutboxDb>> {
  if (!dbPromise) {
    dbPromise = openDB<OutboxDb>(DB_NAME, 1, {
      upgrade(database) {
        const store = database.createObjectStore('outbox', { keyPath: 'key' });
        store.createIndex('byUser', 'userId');
      },
    });
  }
  return dbPromise;
}

/** Tests: start from an empty database */
export async function resetOutboxForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

function changed(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OUTBOX_CHANGE_EVENT));
}

/** Exponential backoff after a failed attempt: 2 s, 4 s, 8 s… capped at 5 minutes */
export function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

/** A uuid v4 for the Idempotency-Key (one per user action, reused on every retry) */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let lastSeq = 0;
function nextSeq(now: number): number {
  lastSeq = Math.max(lastSeq + 1, now * 1000);
  return lastSeq;
}

export async function enqueue(input: {
  key: string;
  userId: string;
  path: string;
  body: Record<string, unknown> | null;
  kind: OfflineWriteKind;
  scopeId: string | null;
  now?: number;
}): Promise<OutboxItem> {
  const now = input.now ?? Date.now();
  const item: OutboxItem = {
    key: input.key,
    userId: input.userId,
    seq: nextSeq(now),
    method: 'POST',
    path: input.path,
    body: input.body,
    kind: input.kind,
    scopeId: input.scopeId,
    createdAt: now,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    lastError: null,
    lastStatus: null,
  };
  const d = await db();
  // Same key twice (double click while offline): keep the first one
  if (!(await d.get('outbox', item.key))) await d.put('outbox', item);
  changed();
  return (await d.get('outbox', item.key))!;
}

export async function listItems(userId: string): Promise<OutboxItem[]> {
  const items = await (await db()).getAllFromIndex('outbox', 'byUser', userId);
  return items.sort((a, b) => a.seq - b.seq);
}

export async function outboxCounts(userId: string): Promise<{ pending: number; failed: number }> {
  const items = await listItems(userId);
  return { pending: items.filter((i) => i.status === 'pending').length, failed: items.filter((i) => i.status === 'failed').length };
}

export async function discard(key: string): Promise<void> {
  await (await db()).delete('outbox', key);
  changed();
}

/** A failed item is tried again as it is (same key, same body) */
export async function retryItem(key: string): Promise<void> {
  const d = await db();
  const item = await d.get('outbox', key);
  if (!item) return;
  await d.put('outbox', { ...item, status: 'pending', nextAttemptAt: 0, lastError: null, lastStatus: null });
  changed();
}

let running: Promise<ReplayResult> | null = null;

/**
 * Send the user's pending items, oldest first. A network or server error stops the run (later
 * items wait, so the order is kept) and schedules a backoff; a 4xx marks the item failed for
 * review and the run goes on; an expired session stops everything until the next login.
 */
export function replay(userId: string, send: (item: OutboxItem) => Promise<SendOutcome>, now: () => number = Date.now): Promise<ReplayResult> {
  if (running) return running;
  running = (async () => {
    const result: ReplayResult = { sent: 0, failed: 0, remaining: 0, authRequired: false, stopped: false };
    try {
      const d = await db();
      const items = (await listItems(userId)).filter((i) => i.status === 'pending');
      for (const item of items) {
        if (item.nextAttemptAt > now()) {
          // Waiting for its backoff: the ones after it wait too
          result.stopped = true;
          break;
        }
        let outcome: SendOutcome;
        try {
          outcome = await send(item);
        } catch {
          outcome = { kind: 'network' };
        }
        if (outcome.kind === 'ok') {
          await d.delete('outbox', item.key);
          result.sent += 1;
          continue;
        }
        if (outcome.kind === 'client-error') {
          await d.put('outbox', { ...item, status: 'failed', attempts: item.attempts + 1, lastError: outcome.message, lastStatus: outcome.status });
          result.failed += 1;
          continue;
        }
        if (outcome.kind === 'auth') {
          result.authRequired = true;
          result.stopped = true;
          break;
        }
        const attempts = item.attempts + 1;
        await d.put('outbox', {
          ...item,
          attempts,
          nextAttemptAt: now() + backoffMs(attempts),
          lastError: outcome.kind === 'server-error' ? outcome.message ?? `Erreur serveur ${outcome.status}` : null,
          lastStatus: outcome.kind === 'server-error' ? outcome.status : null,
        });
        result.stopped = true;
        break;
      }
      result.remaining = (await listItems(userId)).filter((i) => i.status === 'pending').length;
      return result;
    } finally {
      running = null;
      changed();
    }
  })();
  return running;
}
