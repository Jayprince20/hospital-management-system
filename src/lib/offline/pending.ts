/**
 * What a queued write answers right away: the submitted data marked `offlinePending`, with the
 * fields screens read after saving (flags, alerts, warnings…) present but empty — the server
 * computes them on sync.
 */
import type { OfflineWriteKind } from './classifier';

export interface PendingMarker {
  id: string;
  offlinePending: true;
  idempotencyKey: string;
  createdAt: string;
}

export function pendingResult(kind: OfflineWriteKind, body: Record<string, unknown> | null, key: string, scopeId: string | null, at: Date): unknown {
  const base: Record<string, unknown> & PendingMarker = { ...(body ?? {}), id: `offline-${key}`, offlinePending: true, idempotencyKey: key, createdAt: at.toISOString() };
  switch (kind) {
    case 'vitals':
      return { ...base, flags: [] };
    case 'immunization':
      return { ...base, warnings: [] };
    case 'growth':
      return { ...base, status: [], z: {} };
    case 'ancVisit':
      return { ...base, alerts: [] };
    case 'triage':
      return { ticket: { id: scopeId, number: '' }, assessment: { level: body?.level ?? null }, offlinePending: true, idempotencyKey: key };
    default:
      return base;
  }
}

export function isPending(value: unknown): value is PendingMarker {
  return Boolean(value && typeof value === 'object' && (value as { offlinePending?: unknown }).offlinePending === true);
}
