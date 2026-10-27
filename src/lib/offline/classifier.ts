/**
 * Which API requests may be queued while offline, and which ones may be served from the cache.
 * Pure functions over OFFLINE_RULES (shared with the service worker through public/sw-rules.js).
 */
import { OFFLINE_RULES } from './rules';

export type OfflineWriteKind = (typeof OFFLINE_RULES.writes)[number]['kind'];

export interface OfflineWrite {
  kind: OfflineWriteKind;
  /** Body field carrying the bedside time; set at queue time when the form did not send one */
  bedsideField: string | null;
  /** 'datetime' → ISO timestamp, 'date' → YYYY-MM-DD (local day) */
  bedsideFormat: 'datetime' | 'date';
  /** Patient / admission / pregnancy / ticket id from the path, to show the pending row on the right screen */
  scopeId: string | null;
}

const writes = OFFLINE_RULES.writes.map((w) => ({ ...w, re: new RegExp(w.pattern) }));
const neverCache = OFFLINE_RULES.neverCache.map((p) => new RegExp(p, 'i'));
const cacheableGets = OFFLINE_RULES.cacheableGets.map((p) => new RegExp(p));

export function pathOf(url: string): string {
  try {
    return new URL(url, 'http://local').pathname;
  } catch {
    return url.split('?')[0];
  }
}

/** The offline-capable write behind this request, or null when it must reach the server now */
export function offlineWriteFor(method: string | undefined, url: string): OfflineWrite | null {
  if ((method ?? 'GET').toUpperCase() !== 'POST') return null;
  const path = pathOf(url);
  for (const w of writes) {
    const m = w.re.exec(path);
    if (m) return { kind: w.kind, bedsideField: w.bedsideField, bedsideFormat: w.bedsideFormat, scopeId: m[1] ?? null };
  }
  return null;
}

/** API GET the service worker may keep a copy of (staff sessions only — checked separately) */
export function isCacheableApiGet(method: string | undefined, url: string): boolean {
  if ((method ?? 'GET').toUpperCase() !== 'GET') return false;
  const path = pathOf(url);
  if (neverCache.some((re) => re.test(path))) return false;
  return cacheableGets.some((re) => re.test(path));
}

/** Any write (POST/PUT/PATCH/DELETE) that is not offline-capable */
export function isOnlineOnlyWrite(method: string | undefined, url: string): boolean {
  const m = (method ?? 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false;
  return offlineWriteFor(m, url) === null;
}

/** Bedside time in the format the endpoint expects */
export function bedsideValue(format: 'datetime' | 'date', at: Date): string {
  if (format === 'datetime') return at.toISOString();
  const local = new Date(at.getTime() - at.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
