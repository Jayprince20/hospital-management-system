/**
 * Who the offline data belongs to, and when it must be wiped.
 * - The service worker caches API answers under `bb-api-<userId>` (from the Bearer token) and
 *   never for patients; logout and 12 h without a staff session wipe them.
 * - The last staff profile is kept so a page reloaded without network still opens (same user,
 *   less than 12 h old); it is not a credential, the API still checks the token on every call.
 */

export const API_CACHE_PREFIX = 'bb-api-';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LAST_AUTH_KEY = 'bb-offline-last-auth';
const PROFILE_KEY = 'bb-offline-profile';

export function apiCacheName(userId: string): string {
  return `${API_CACHE_PREFIX}${userId}`;
}

/** The token's payload, read without checking the signature (only to pick the cache) */
export function tokenClaims(token: string | null | undefined): { userId: string; role: string } | null {
  if (!token) return null;
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = typeof atob === 'function' ? atob(part.replace(/-/g, '+').replace(/_/g, '/')) : Buffer.from(part, 'base64').toString('utf8');
    const claims = JSON.parse(json) as { userId?: string; sub?: string; role?: string };
    const userId = claims.userId ?? claims.sub;
    return userId ? { userId, role: claims.role ?? '' } : null;
  } catch {
    return null;
  }
}

/** Patients (portal) get nothing cached but the app shell */
export function mayCacheFor(role: string | null | undefined): boolean {
  return Boolean(role) && role !== 'PATIENT';
}

export function shouldWipe(lastAuthAt: number | null, now: number): boolean {
  return lastAuthAt !== null && now - lastAuthAt > SESSION_TTL_MS;
}

export function markAuthenticated(storage: Storage, now = Date.now()): void {
  storage.setItem(LAST_AUTH_KEY, String(now));
}

export function lastAuthenticatedAt(storage: Storage): number | null {
  const v = Number(storage.getItem(LAST_AUTH_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
}

export interface SavedProfile<U> {
  userId: string;
  savedAt: number;
  user: U;
}

export function saveProfile<U extends { id: string; role?: string }>(storage: Storage, user: U, now = Date.now()): void {
  if (!mayCacheFor(user.role)) return;
  storage.setItem(PROFILE_KEY, JSON.stringify({ userId: user.id, savedAt: now, user } satisfies SavedProfile<U>));
}

/** The saved profile, only for the same user and while it is fresh */
export function readProfile<U>(storage: Storage, userId: string | null, now = Date.now()): U | null {
  if (!userId) return null;
  try {
    const p = JSON.parse(storage.getItem(PROFILE_KEY) ?? 'null') as SavedProfile<U> | null;
    if (!p || p.userId !== userId || now - p.savedAt > SESSION_TTL_MS) return null;
    return p.user;
  } catch {
    return null;
  }
}

/** Logout or expiry: forget the profile and every cached API answer (the outbox is kept per user) */
export async function wipeOfflineData(storage: Storage, caches?: CacheStorage | null): Promise<void> {
  storage.removeItem(PROFILE_KEY);
  storage.removeItem(LAST_AUTH_KEY);
  if (caches) {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(API_CACHE_PREFIX)).map((n) => caches.delete(n)));
  }
  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'wipe' });
  }
}
