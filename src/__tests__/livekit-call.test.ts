import { describe, it, expect } from 'vitest';
import { ConnectionQuality, ConnectionState } from 'livekit-client';
import { isPeerIdentity, mapLivekitConnection, qualityFromLivekit, roleOfIdentity } from '@/lib/livekit-call';

describe('livekit identities', () => {
  it('reads the role from the backend identity', () => {
    expect(roleOfIdentity('doctor-u1')).toBe('DOCTOR');
    expect(roleOfIdentity('patient-u2')).toBe('PATIENT');
    expect(roleOfIdentity('recorder')).toBeNull();
  });

  it('only the other role is the peer', () => {
    expect(isPeerIdentity('patient-u2', 'DOCTOR')).toBe(true);
    expect(isPeerIdentity('doctor-u1', 'DOCTOR')).toBe(false);
    expect(isPeerIdentity('egress-bot', 'PATIENT')).toBe(false);
  });
});

describe('mapLivekitConnection', () => {
  const base = { roomState: 'connected' as const, failed: false, peerInRoom: true, wasConnected: false };

  it('is connected once both are in the room', () => {
    expect(mapLivekitConnection(base)).toBe('connected');
  });

  it('waits for the other side, or shows a reconnect after a first connection', () => {
    expect(mapLivekitConnection({ ...base, peerInRoom: false })).toBe('waiting');
    expect(mapLivekitConnection({ ...base, peerInRoom: false, wasConnected: true })).toBe('reconnecting');
  });

  it('follows the room while it connects or reconnects', () => {
    expect(mapLivekitConnection({ ...base, roomState: 'connecting' })).toBe('connecting');
    expect(mapLivekitConnection({ ...base, roomState: 'reconnecting' })).toBe('reconnecting');
    expect(mapLivekitConnection({ ...base, roomState: 'signalReconnecting' })).toBe('reconnecting');
    expect(mapLivekitConnection({ ...base, roomState: 'disconnected', wasConnected: true })).toBe('reconnecting');
  });

  it('reports a failed connection to the server', () => {
    expect(mapLivekitConnection({ ...base, roomState: 'disconnected', failed: true })).toBe('failed');
  });

  it('uses the same state strings as livekit-client', () => {
    expect([ConnectionState.Disconnected, ConnectionState.Connecting, ConnectionState.Connected, ConnectionState.Reconnecting, ConnectionState.SignalReconnecting])
      .toEqual(['disconnected', 'connecting', 'connected', 'reconnecting', 'signalReconnecting']);
  });
});

describe('qualityFromLivekit', () => {
  it('maps the LiveKit scale onto good / poor / unknown', () => {
    expect(qualityFromLivekit('excellent')).toBe('good');
    expect(qualityFromLivekit('good')).toBe('good');
    expect(qualityFromLivekit('poor')).toBe('poor');
    expect(qualityFromLivekit('lost')).toBe('poor');
    expect(qualityFromLivekit('unknown')).toBe('unknown');
  });

  it('uses the same quality strings as livekit-client', () => {
    expect([ConnectionQuality.Excellent, ConnectionQuality.Good, ConnectionQuality.Poor, ConnectionQuality.Lost, ConnectionQuality.Unknown])
      .toEqual(['excellent', 'good', 'poor', 'lost', 'unknown']);
  });
});
