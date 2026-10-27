import { describe, expect, it } from 'vitest';
import {
  appointmentDateTime,
  formatCountdown,
  formatElapsed,
  isJoinable,
  joinStateAt,
  joinWindow,
  lossBetween,
  mapConnectionState,
  qualityFromStats,
} from '@/lib/teleconsultation';
import { canAccessRoute, getNavigationForRole } from '@/lib/rbac';

describe('join window', () => {
  const start = appointmentDateTime('2026-10-24T00:00:00.000Z', '10:00');
  const end = appointmentDateTime('2026-10-24', '10:30');
  const window = joinWindow(start, end);

  it('reads the appointment date and time as local time', () => {
    expect(start.getHours()).toBe(10);
    expect(start.getDate()).toBe(24);
  });

  it('opens 15 minutes before and closes 60 minutes after the end', () => {
    expect(joinStateAt(window, new Date(2026, 9, 24, 9, 44))).toBe('upcoming');
    expect(joinStateAt(window, new Date(2026, 9, 24, 9, 45))).toBe('open');
    expect(joinStateAt(window, new Date(2026, 9, 24, 11, 30))).toBe('open');
    expect(joinStateAt(window, new Date(2026, 9, 24, 11, 31))).toBe('past');
  });

  it('closes cancelled, absent, completed or ended consultations', () => {
    expect(isJoinable('CONFIRMED')).toBe(true);
    expect(isJoinable('CHECKED_IN', { status: 'IN_CALL', patientJoinedAt: null, doctorJoinedAt: null, connectedAt: null, endedAt: null, outcome: null })).toBe(true);
    expect(isJoinable('CANCELLED')).toBe(false);
    expect(isJoinable('NO_SHOW')).toBe(false);
    expect(isJoinable('IN_PROGRESS', { status: 'ENDED', patientJoinedAt: null, doctorJoinedAt: null, connectedAt: null, endedAt: null, outcome: 'COMPLETED' })).toBe(false);
  });
});

describe('countdown and timer', () => {
  it('formats the time before opening', () => {
    expect(formatCountdown(2 * 3600_000 + 5 * 60_000)).toBe('2 h 05 min');
    expect(formatCountdown(12 * 60_000)).toBe('12 min');
    expect(formatCountdown(11 * 60_000 + 20_000)).toBe('12 min');
    expect(formatCountdown(45_000)).toBe('45 s');
    expect(formatCountdown(-5)).toBe('0 s');
  });

  it('formats a running call', () => {
    expect(formatElapsed(187_000)).toBe('03:07');
    expect(formatElapsed(3725_000)).toBe('1:02:05');
  });
});

describe('connection state', () => {
  const base = { peerPresent: true, socketConnected: true, pcState: null as RTCPeerConnectionState | null, wasConnected: false };

  it('waits for the other participant', () => {
    expect(mapConnectionState({ ...base, peerPresent: false })).toBe('waiting');
  });

  it('follows the peer connection', () => {
    expect(mapConnectionState({ ...base, pcState: 'connecting' })).toBe('connecting');
    expect(mapConnectionState({ ...base, pcState: 'connected' })).toBe('connected');
    expect(mapConnectionState({ ...base, pcState: 'failed' })).toBe('failed');
  });

  it('calls a drop after a working call a reconnection', () => {
    expect(mapConnectionState({ ...base, pcState: 'disconnected', wasConnected: true })).toBe('reconnecting');
    expect(mapConnectionState({ ...base, pcState: 'failed', wasConnected: true })).toBe('reconnecting');
    expect(mapConnectionState({ ...base, peerPresent: false, wasConnected: true })).toBe('reconnecting');
    expect(mapConnectionState({ ...base, socketConnected: false, wasConnected: true })).toBe('reconnecting');
    expect(mapConnectionState({ ...base, socketConnected: false })).toBe('connecting');
  });
});

describe('call quality', () => {
  it('flags long round trips and lost packets', () => {
    expect(qualityFromStats(null, null)).toBe('unknown');
    expect(qualityFromStats(0.12, 0.01)).toBe('good');
    expect(qualityFromStats(0.9, 0)).toBe('poor');
    expect(qualityFromStats(0.1, 0.2)).toBe('poor');
  });

  it('computes the lost share between two samples', () => {
    expect(lossBetween(null, { lost: 5, received: 100 })).toBeNull();
    expect(lossBetween({ lost: 5, received: 100 }, { lost: 15, received: 190 })).toBe(0.1);
    expect(lossBetween({ lost: 5, received: 100 }, { lost: 5, received: 100 })).toBeNull();
  });
});

describe('access', () => {
  it('opens the list to doctors, patients and admins only', () => {
    expect(canAccessRoute('DOCTOR', '/dashboard/teleconsultations')).toBe(true);
    expect(canAccessRoute('PATIENT', '/dashboard/teleconsultations')).toBe(true);
    expect(canAccessRoute('ADMIN', '/dashboard/teleconsultations')).toBe(true);
    expect(canAccessRoute('NURSE', '/dashboard/teleconsultations')).toBe(false);
    expect(canAccessRoute('RECEPTIONIST', '/dashboard/teleconsultations')).toBe(false);
  });

  it('lists the page in the menu of doctors and patients', () => {
    const hrefs = (role: string) => getNavigationForRole(role).map((item) => item.href);
    expect(hrefs('DOCTOR')).toContain('/dashboard/teleconsultations');
    expect(hrefs('PATIENT')).toContain('/dashboard/teleconsultations');
    expect(hrefs('NURSE')).not.toContain('/dashboard/teleconsultations');
  });
});
