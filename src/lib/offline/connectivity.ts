/**
 * Connectivity as the app sees it: the browser's own flag is not enough (a Wi-Fi with no
 * internet, a server down), so it is confirmed by a heartbeat on GET /api/ping.
 */

export type LinkState = 'online' | 'offline' | 'checking';

export interface ConnectivityState {
  link: LinkState;
  /** Heartbeat failures in a row while the browser still claims to be online */
  failures: number;
  lastOkAt: number | null;
}

export type ConnectivityEvent =
  | { type: 'browser-online' }
  | { type: 'browser-offline' }
  | { type: 'ping-ok'; at: number }
  | { type: 'ping-fail' };

/** Two failed pings in a row before calling it offline (one lost packet is not an outage) */
export const PING_FAILURES_FOR_OFFLINE = 2;
export const PING_INTERVAL_ONLINE_MS = 60_000;
export const PING_INTERVAL_OFFLINE_MS = 15_000;

export function initialConnectivity(browserOnline: boolean): ConnectivityState {
  return { link: browserOnline ? 'checking' : 'offline', failures: 0, lastOkAt: null };
}

export function nextConnectivity(state: ConnectivityState, event: ConnectivityEvent): ConnectivityState {
  switch (event.type) {
    case 'browser-offline':
      return { ...state, link: 'offline', failures: 0 };
    case 'browser-online':
      // Wait for the server to answer before saying online
      return { ...state, link: state.link === 'online' ? 'online' : 'checking', failures: 0 };
    case 'ping-ok':
      return { link: 'online', failures: 0, lastOkAt: event.at };
    case 'ping-fail': {
      const failures = state.failures + 1;
      if (state.link === 'offline') return { ...state, failures };
      return { ...state, failures, link: failures >= PING_FAILURES_FOR_OFFLINE || state.link === 'checking' ? 'offline' : state.link };
    }
  }
}

export function pingInterval(state: ConnectivityState): number {
  return state.link === 'online' ? PING_INTERVAL_ONLINE_MS : PING_INTERVAL_OFFLINE_MS;
}

export type IndicatorStatus = 'online' | 'offline' | 'syncing' | 'failed' | 'auth';

/** What the header shows: offline first, then a session to renew, review needed, sync in progress */
export function indicatorStatus(input: { link: LinkState; pending: number; failed: number; syncing: boolean; authRequired: boolean }): IndicatorStatus {
  if (input.link === 'offline') return 'offline';
  if (input.authRequired && input.pending > 0) return 'auth';
  if (input.failed > 0) return 'failed';
  if (input.pending > 0 || input.syncing) return 'syncing';
  return 'online';
}
