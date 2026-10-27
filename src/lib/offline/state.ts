/**
 * Current connectivity for code outside React (the API client): the OfflineProvider keeps it
 * up to date from the heartbeat; before it starts, the browser's flag is used.
 */
import type { LinkState } from './connectivity';

let link: LinkState | null = null;

export function setLinkState(next: LinkState): void {
  link = next;
}

export function isOfflineNow(): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return link === 'offline';
}

export const OFFLINE_QUEUED_EVENT = 'bb-offline-queued';
