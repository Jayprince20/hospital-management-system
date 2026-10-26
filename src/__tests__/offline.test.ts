import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OFFLINE_RULES } from '@/lib/offline/rules';
import { bedsideValue, isCacheableApiGet, isOnlineOnlyWrite, offlineWriteFor } from '@/lib/offline/classifier';
import {
  backoffMs,
  discard,
  enqueue,
  listItems,
  newIdempotencyKey,
  outboxCounts,
  replay,
  resetOutboxForTests,
  retryItem,
  type OutboxItem,
  type SendOutcome,
} from '@/lib/offline/outbox';
import { indicatorStatus, initialConnectivity, nextConnectivity, pingInterval, PING_INTERVAL_OFFLINE_MS, PING_INTERVAL_ONLINE_MS } from '@/lib/offline/connectivity';
import { apiCacheName, lastAuthenticatedAt, markAuthenticated, mayCacheFor, readProfile, saveProfile, shouldWipe, SESSION_TTL_MS, tokenClaims, wipeOfflineData } from '@/lib/offline/session';
import { isPending, pendingResult } from '@/lib/offline/pending';
import { swEnabled } from '@/components/offline/service-worker-register';

const PATIENT = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
}

describe('request classifier', () => {
  it('knows the offline-capable bedside writes and their bedside field', () => {
    expect(offlineWriteFor('POST', '/api/vitals')).toMatchObject({ kind: 'vitals', bedsideField: 'recordedAt', scopeId: null });
    expect(offlineWriteFor('POST', `/api/patients/${PATIENT}/immunizations`)).toMatchObject({ kind: 'immunization', bedsideField: null, scopeId: PATIENT });
    expect(offlineWriteFor('POST', `/api/patients/${PATIENT}/growth`)).toMatchObject({ kind: 'growth', scopeId: PATIENT });
    expect(offlineWriteFor('POST', `/api/pregnancies/${PATIENT}/visits`)).toMatchObject({ kind: 'ancVisit' });
    expect(offlineWriteFor('POST', `/api/admissions/${PATIENT}/administrations`)).toMatchObject({ kind: 'marAdministration', bedsideField: 'recordedAt' });
    expect(offlineWriteFor('POST', `/api/admissions/${PATIENT}/notes`)).toMatchObject({ kind: 'admissionNote' });
    expect(offlineWriteFor('POST', `/api/queue/tickets/${PATIENT}/triage`)).toMatchObject({ kind: 'triage' });
    expect(offlineWriteFor('POST', '/api/ed/encounters')).toMatchObject({ kind: 'edArrival', bedsideField: 'arrivedAt' });
  });

  it('keeps every other write online-only', () => {
    expect(offlineWriteFor('GET', '/api/vitals')).toBeNull();
    expect(offlineWriteFor('PATCH', `/api/patients/${PATIENT}/growth`)).toBeNull();
    expect(offlineWriteFor('POST', '/api/consultations')).toBeNull();
    expect(offlineWriteFor('POST', `/api/patients/${PATIENT}/attachments`)).toBeNull();
    expect(isOnlineOnlyWrite('POST', '/api/invoices')).toBe(true);
    expect(isOnlineOnlyWrite('DELETE', `/api/growth/${PATIENT}`)).toBe(true);
    expect(isOnlineOnlyWrite('POST', '/api/vitals')).toBe(false);
    expect(isOnlineOnlyWrite('GET', '/api/invoices')).toBe(false);
  });

  it('caches whitelisted GETs only, never credentials, files, PDFs or DICOM', () => {
    expect(isCacheableApiGet('GET', `/api/patients/${PATIENT}`)).toBe(true);
    expect(isCacheableApiGet('GET', '/api/mar/ward?wardId=x')).toBe(true);
    expect(isCacheableApiGet('GET', '/api/immunizations/due?status=ALL')).toBe(true);
    expect(isCacheableApiGet('GET', '/api/auth/me')).toBe(false);
    expect(isCacheableApiGet('GET', `/api/patients/${PATIENT}/attachments`)).toBe(false);
    expect(isCacheableApiGet('GET', `/api/attachments/${PATIENT}/file`)).toBe(false);
    expect(isCacheableApiGet('GET', `/api/patients/${PATIENT}/immunizations/card.pdf`)).toBe(false);
    expect(isCacheableApiGet('GET', '/api/dicomweb/studies')).toBe(false);
    expect(isCacheableApiGet('GET', '/api/invoices')).toBe(false);
    expect(isCacheableApiGet('POST', '/api/vitals')).toBe(false);
  });

  it('formats the bedside time for the endpoint', () => {
    const at = new Date('2026-10-26T23:30:00Z'); // 00:30 the next day in Douala (UTC+1)
    expect(bedsideValue('datetime', at)).toBe('2026-10-26T23:30:00.000Z');
    expect(bedsideValue('date', at)).toBe('2026-10-27');
  });

  it('the service worker rules are the same data as the app rules', () => {
    const source = readFileSync(path.join(process.cwd(), 'public', 'sw-rules.js'), 'utf8');
    const sandbox: { self: { BB_OFFLINE_RULES?: unknown } } = { self: {} };
    vm.runInNewContext(source, sandbox);
    expect(sandbox.self.BB_OFFLINE_RULES).toEqual(JSON.parse(JSON.stringify(OFFLINE_RULES)));
  });
});

describe('outbox', () => {
  beforeEach(async () => {
    await resetOutboxForTests();
  });
  afterEach(async () => {
    await resetOutboxForTests();
  });

  const add = (key: string, userId = 'u1', now = 1_000) =>
    enqueue({ key, userId, path: '/api/vitals', body: { patientId: PATIENT, heartRate: 80 }, kind: 'vitals', scopeId: null, now });

  it('keeps items per user, in order, and ignores a second enqueue of the same key', async () => {
    await add('k1', 'u1', 1000);
    await add('k2', 'u1', 1000);
    await add('k3', 'u2', 1000);
    await add('k1', 'u1', 2000);
    expect((await listItems('u1')).map((i) => i.key)).toEqual(['k1', 'k2']);
    expect((await listItems('u2')).map((i) => i.key)).toEqual(['k3']);
    expect(await outboxCounts('u1')).toEqual({ pending: 2, failed: 0 });
  });

  it('replays oldest first with the stored key, and removes what the server accepted', async () => {
    await add('a');
    await add('b');
    const seen: string[] = [];
    const result = await replay('u1', async (item) => {
      seen.push(item.key);
      return { kind: 'ok' };
    });
    expect(seen).toEqual(['a', 'b']);
    expect(result).toMatchObject({ sent: 2, failed: 0, remaining: 0, stopped: false });
    expect(await listItems('u1')).toEqual([]);
  });

  it('a 4xx marks the item for review and the run goes on', async () => {
    await add('a');
    await add('b');
    const result = await replay('u1', async (item): Promise<SendOutcome> =>
      item.key === 'a' ? { kind: 'client-error', status: 400, message: 'Valeur improbable' } : { kind: 'ok' }
    );
    expect(result).toMatchObject({ sent: 1, failed: 1, remaining: 0 });
    const [failed] = await listItems('u1');
    expect(failed).toMatchObject({ key: 'a', status: 'failed', lastError: 'Valeur improbable', lastStatus: 400 });
    expect(await outboxCounts('u1')).toEqual({ pending: 0, failed: 1 });
  });

  it('a network or server error stops the run (order kept) and backs off', async () => {
    await add('a');
    await add('b');
    let now = 10_000;
    const calls: string[] = [];
    const result = await replay(
      'u1',
      async (item) => {
        calls.push(item.key);
        return { kind: 'network' };
      },
      () => now
    );
    expect(calls).toEqual(['a']);
    expect(result).toMatchObject({ sent: 0, remaining: 2, stopped: true });
    const [a] = await listItems('u1');
    expect(a.attempts).toBe(1);
    expect(a.nextAttemptAt).toBe(10_000 + backoffMs(1));

    // Too early: nothing is sent
    now += 500;
    calls.length = 0;
    await replay('u1', async () => ({ kind: 'ok' }), () => now);
    expect(calls).toEqual([]);
    expect(await listItems('u1')).toHaveLength(2);

    // After the backoff the same key is sent again, then the next one
    now += backoffMs(1);
    const keys: string[] = [];
    await replay('u1', async (item) => {
      keys.push(item.key);
      return { kind: 'ok' };
    }, () => now);
    expect(keys).toEqual(['a', 'b']);
  });

  it('a 5xx keeps the item pending with the server message', async () => {
    await add('a');
    await replay('u1', async () => ({ kind: 'server-error', status: 503, message: 'Maintenance' }), () => 5_000);
    const [a] = await listItems('u1');
    expect(a).toMatchObject({ status: 'pending', attempts: 1, lastStatus: 503, lastError: 'Maintenance' });
  });

  it('an expired session stops the run and keeps the queue', async () => {
    await add('a');
    await add('b');
    const result = await replay('u1', async () => ({ kind: 'auth' }));
    expect(result).toMatchObject({ authRequired: true, sent: 0, remaining: 2 });
    expect(await listItems('u1')).toHaveLength(2);
  });

  it('retry puts a failed item back as it is; discard removes it', async () => {
    await add('a');
    await replay('u1', async () => ({ kind: 'client-error', status: 409, message: 'Dose déjà enregistrée' }));
    await retryItem('a');
    let item = (await listItems('u1'))[0] as OutboxItem;
    expect(item).toMatchObject({ status: 'pending', nextAttemptAt: 0, lastError: null, key: 'a' });
    await discard('a');
    item = (await listItems('u1'))[0];
    expect(item).toBeUndefined();
  });

  it('backoff doubles and caps at 5 minutes', () => {
    expect(backoffMs(1)).toBe(2000);
    expect(backoffMs(2)).toBe(4000);
    expect(backoffMs(5)).toBe(32_000);
    expect(backoffMs(20)).toBe(300_000);
  });

  it('idempotency keys are uuid v4', () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newIdempotencyKey()).not.toBe(key);
  });
});

describe('connectivity', () => {
  it('needs the server to answer before saying online', () => {
    let s = initialConnectivity(true);
    expect(s.link).toBe('checking');
    s = nextConnectivity(s, { type: 'ping-ok', at: 1 });
    expect(s).toMatchObject({ link: 'online', lastOkAt: 1 });
  });

  it('one lost ping is tolerated, two mean offline; the browser flag is immediate', () => {
    let s = nextConnectivity(initialConnectivity(true), { type: 'ping-ok', at: 1 });
    s = nextConnectivity(s, { type: 'ping-fail' });
    expect(s.link).toBe('online');
    s = nextConnectivity(s, { type: 'ping-fail' });
    expect(s.link).toBe('offline');
    s = nextConnectivity(s, { type: 'browser-online' });
    expect(s.link).toBe('checking');
    s = nextConnectivity(s, { type: 'browser-offline' });
    expect(s.link).toBe('offline');
    expect(nextConnectivity(initialConnectivity(true), { type: 'ping-fail' }).link).toBe('offline');
  });

  it('pings every 60 s online, 15 s offline', () => {
    expect(pingInterval({ link: 'online', failures: 0, lastOkAt: 1 })).toBe(PING_INTERVAL_ONLINE_MS);
    expect(pingInterval({ link: 'offline', failures: 2, lastOkAt: 1 })).toBe(PING_INTERVAL_OFFLINE_MS);
  });

  it('header status: offline, then session, review, syncing, online', () => {
    const base = { link: 'online' as const, pending: 0, failed: 0, syncing: false, authRequired: false };
    expect(indicatorStatus({ ...base, link: 'offline', pending: 3 })).toBe('offline');
    expect(indicatorStatus({ ...base, pending: 2, authRequired: true })).toBe('auth');
    expect(indicatorStatus({ ...base, failed: 1, pending: 1 })).toBe('failed');
    expect(indicatorStatus({ ...base, pending: 1 })).toBe('syncing');
    expect(indicatorStatus(base)).toBe('online');
  });
});

describe('offline data ownership', () => {
  beforeEach(() => localStorage.clear());

  it('reads the user from the token and caches per user, never for patients', () => {
    expect(tokenClaims(jwt({ userId: 'u1', role: 'NURSE' }))).toEqual({ userId: 'u1', role: 'NURSE' });
    expect(tokenClaims('garbage')).toBeNull();
    expect(apiCacheName('u1')).toBe('bb-api-u1');
    expect(apiCacheName('u1')).not.toBe(apiCacheName('u2'));
    expect(mayCacheFor('NURSE')).toBe(true);
    expect(mayCacheFor('PATIENT')).toBe(false);
    expect(mayCacheFor(undefined)).toBe(false);
  });

  it('keeps the staff profile for the same user only, for 12 h', () => {
    saveProfile(localStorage, { id: 'u1', role: 'NURSE', firstName: 'Odette' }, 1_000);
    expect(readProfile(localStorage, 'u1', 2_000)).toMatchObject({ firstName: 'Odette' });
    expect(readProfile(localStorage, 'u2', 2_000)).toBeNull();
    expect(readProfile(localStorage, 'u1', 1_000 + SESSION_TTL_MS + 1)).toBeNull();
    saveProfile(localStorage, { id: 'p1', role: 'PATIENT' }, 1_000);
    expect(readProfile(localStorage, 'p1', 2_000)).toBeNull();
  });

  it('wipes after 12 h without a session, and on logout', async () => {
    expect(shouldWipe(null, 10)).toBe(false);
    markAuthenticated(localStorage, 1_000);
    expect(lastAuthenticatedAt(localStorage)).toBe(1_000);
    expect(shouldWipe(1_000, 1_000 + SESSION_TTL_MS - 1)).toBe(false);
    expect(shouldWipe(1_000, 1_000 + SESSION_TTL_MS + 1)).toBe(true);

    saveProfile(localStorage, { id: 'u1', role: 'NURSE' }, 1_000);
    const store = new Map<string, unknown>([
      ['bb-api-u1', {}],
      ['bb-api-u2', {}],
      ['bb-static-v1', {}],
    ]);
    const fakeCaches = {
      keys: async () => [...store.keys()],
      delete: async (name: string) => store.delete(name),
    } as unknown as CacheStorage;
    await wipeOfflineData(localStorage, fakeCaches);
    expect([...store.keys()]).toEqual(['bb-static-v1']);
    expect(readProfile(localStorage, 'u1', 2_000)).toBeNull();
    expect(lastAuthenticatedAt(localStorage)).toBeNull();
  });
});

describe('queued write answers', () => {
  it('returns the submitted data marked pending, with the fields screens read', () => {
    const at = new Date('2026-10-26T10:00:00Z');
    const vitals = pendingResult('vitals', { heartRate: 90 }, 'k1', null, at) as Record<string, unknown>;
    expect(vitals).toMatchObject({ heartRate: 90, flags: [], offlinePending: true, idempotencyKey: 'k1', id: 'offline-k1' });
    expect(isPending(vitals)).toBe(true);
    expect(pendingResult('growth', {}, 'k', PATIENT, at)).toMatchObject({ status: [] });
    expect(pendingResult('ancVisit', {}, 'k', PATIENT, at)).toMatchObject({ alerts: [] });
    expect(pendingResult('immunization', {}, 'k', PATIENT, at)).toMatchObject({ warnings: [] });
    expect(pendingResult('triage', { level: 'RED' }, 'k', OTHER, at)).toMatchObject({ ticket: { id: OTHER, number: '' }, assessment: { level: 'RED' } });
    expect(isPending({ id: 'x' })).toBe(false);
  });
});

describe('service worker registration', () => {
  it('runs in production, and in development only with NEXT_PUBLIC_SW_DEV=1', () => {
    expect(swEnabled({ NODE_ENV: 'production' })).toBe(true);
    expect(swEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(swEnabled({ NODE_ENV: 'development', NEXT_PUBLIC_SW_DEV: '1' })).toBe(true);
  });
});

describe('API client: queue on network failure, replay with the same key', () => {
  beforeEach(async () => {
    await resetOutboxForTests();
    localStorage.clear();
    localStorage.setItem('accessToken', jwt({ userId: 'nurse-1', role: 'NURSE' }));
  });
  afterEach(async () => {
    await resetOutboxForTests();
    localStorage.clear();
    globalThis.fetch = realFetch;
  });
  const realFetch = globalThis.fetch;

  it('queues a vitals entry with its key and bedside time, then resends it unchanged', async () => {
    const { api } = await import('@/lib/api');
    const sentHeaders: Array<Record<string, string>> = [];
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      sentHeaders.push({ ...(init?.headers as Record<string, string>) });
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;

    const created = await api.createVitals({ patientId: PATIENT, heartRate: 88, recordedBy: 'nurse-1' });
    expect(isPending(created)).toBe(true);
    const [item] = await listItems('nurse-1');
    expect(item).toMatchObject({ kind: 'vitals', path: '/api/vitals', status: 'pending' });
    expect(item.key).toBe(sentHeaders[0]['Idempotency-Key']);
    expect(typeof item.body?.recordedAt).toBe('string');

    let replayed: { headers: Record<string, string>; body: string } | null = null;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      replayed = { headers: init?.headers as Record<string, string>, body: String(init?.body) };
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 201 });
    }) as typeof fetch;
    const result = await replay('nurse-1', (i) => api.replayOutboxItem(i));
    expect(result.sent).toBe(1);
    expect(replayed!.headers['Idempotency-Key']).toBe(item.key);
    expect(JSON.parse(replayed!.body)).toEqual(item.body);
  });

  it('maps server answers to outcomes', async () => {
    const { api } = await import('@/lib/api');
    const item = { key: 'k', userId: 'nurse-1', seq: 1, method: 'POST', path: '/api/vitals', body: {}, kind: 'vitals', scopeId: null, createdAt: 1, status: 'pending', attempts: 0, nextAttemptAt: 0, lastError: null, lastStatus: null } as OutboxItem;
    const answer = (status: number, message = 'x') => {
      globalThis.fetch = (async () => new Response(JSON.stringify({ success: false, message }), { status })) as typeof fetch;
    };
    answer(400, 'Valeur improbable');
    expect(await api.replayOutboxItem(item)).toMatchObject({ kind: 'client-error', status: 400 });
    answer(503);
    expect(await api.replayOutboxItem(item)).toMatchObject({ kind: 'server-error', status: 503 });
    answer(409, 'En cours de traitement');
    expect(await api.replayOutboxItem(item)).toMatchObject({ kind: 'server-error', status: 409 });
    answer(401);
    expect(await api.replayOutboxItem(item)).toEqual({ kind: 'auth' });
    globalThis.fetch = (async () => {
      throw new TypeError('offline');
    }) as typeof fetch;
    expect(await api.replayOutboxItem(item)).toEqual({ kind: 'network' });
  });

  it('refuses online-only writes while offline with a clear message', async () => {
    const { api } = await import('@/lib/api');
    const { setLinkState } = await import('@/lib/offline/state');
    setLinkState('offline');
    try {
      await expect(api.createConsultation({ appointmentId: PATIENT } as never)).rejects.toThrow(/hors ligne|offline/i);
    } finally {
      setLinkState('online');
    }
  });
});

describe('success toast after an offline save', () => {
  it('is suppressed right after a write was queued, not otherwise', async () => {
    const { successJustQueued } = await import('@/components/toast');
    const { OFFLINE_QUEUED_EVENT } = await import('@/lib/offline/state');
    const t0 = Date.now();
    expect(successJustQueued(t0 + 60_000)).toBe(false);
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUED_EVENT, { detail: { kind: 'vitals' } }));
    expect(successJustQueued()).toBe(true);
    expect(successJustQueued(Date.now() + 5_000)).toBe(false);
  });
});
