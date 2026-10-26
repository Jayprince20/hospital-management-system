import type { CallConnection, CallQuality, TeleRole } from '@/lib/teleconsultation';

/**
 * Pure mappings for a teleconsultation whose media goes through LiveKit. The string values mirror
 * livekit-client's ConnectionState and ConnectionQuality enums, so these stay testable without a Room.
 */

export type LivekitRoomState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'signalReconnecting';
export type LivekitQuality = 'excellent' | 'good' | 'poor' | 'lost' | 'unknown';

/** Identities issued by the backend: doctor-<userId> / patient-<userId> */
export function roleOfIdentity(identity: string): TeleRole | null {
  if (identity.startsWith('doctor-')) return 'DOCTOR';
  if (identity.startsWith('patient-')) return 'PATIENT';
  return null;
}

/** The other side of the call (never this account in another tab, nor a server-side participant) */
export function isPeerIdentity(identity: string, me: TeleRole): boolean {
  const role = roleOfIdentity(identity);
  return role !== null && role !== me;
}

export function mapLivekitConnection(input: {
  roomState: LivekitRoomState;
  /** Connecting to the LiveKit server failed (bad token, server unreachable) */
  failed: boolean;
  /** The other participant is in the LiveKit room */
  peerInRoom: boolean;
  wasConnected: boolean;
}): CallConnection {
  const { roomState, failed, peerInRoom, wasConnected } = input;
  if (failed) return 'failed';
  switch (roomState) {
    case 'reconnecting':
    case 'signalReconnecting':
      return 'reconnecting';
    case 'connected':
      if (peerInRoom) return 'connected';
      return wasConnected ? 'reconnecting' : 'waiting';
    default:
      return wasConnected ? 'reconnecting' : 'connecting';
  }
}

export function qualityFromLivekit(quality: LivekitQuality): CallQuality {
  if (quality === 'excellent' || quality === 'good') return 'good';
  if (quality === 'poor' || quality === 'lost') return 'poor';
  return 'unknown';
}
