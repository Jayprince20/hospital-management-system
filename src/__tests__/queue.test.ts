import { describe, expect, it } from 'vitest';
import type { QueueTicket } from '@/lib/api';
import { allowedActions, formatWait, groupTickets, parseReason, TRIAGE_DISCRIMINATORS } from '@/lib/queue';

let n = 0;
function ticket(partial: Partial<QueueTicket>): QueueTicket {
  n += 1;
  return {
    id: `t${n}`,
    number: `C-${String(n).padStart(3, '0')}`,
    sequence: n,
    serviceDate: '2026-10-23',
    status: 'WAITING',
    source: 'WALK_IN',
    needsTriage: true,
    triageLevel: null,
    priority: 4,
    department: { id: 'd', name: 'Médecine générale' },
    doctor: null,
    room: null,
    callCount: 0,
    patient: { id: 'p', patientId: 'PAT-1', firstName: 'A', lastName: 'B', allergies: [] },
    appointment: null,
    arrivedAt: '2026-10-23T08:00:00.000Z',
    triagedAt: null,
    calledAt: null,
    serviceStartedAt: null,
    completedAt: null,
    waitMinutes: 0,
    targetMinutes: null,
    overdue: false,
    position: null,
    latestTriage: null,
    notes: null,
    ...partial,
  };
}

describe('formatWait', () => {
  it('formats minutes and hours', () => {
    expect(formatWait(0)).toBe('< 1 min');
    expect(formatWait(12.7)).toBe('12 min');
    expect(formatWait(65)).toBe('1 h 05');
    expect(formatWait(240)).toBe('4 h');
    expect(formatWait(null)).toBe('—');
  });
});

describe('groupTickets', () => {
  it('orders waiting patients by colour, overdue first, then arrival', () => {
    const green = ticket({ priority: 4, triageLevel: 'GREEN', arrivedAt: '2026-10-23T07:00:00.000Z' });
    const yellowLate = ticket({ priority: 3, triageLevel: 'YELLOW', arrivedAt: '2026-10-23T09:00:00.000Z' });
    const yellowOverdue = ticket({ priority: 3, triageLevel: 'YELLOW', overdue: true, arrivedAt: '2026-10-23T09:30:00.000Z' });
    const red = ticket({ priority: 1, triageLevel: 'RED', arrivedAt: '2026-10-23T10:00:00.000Z' });
    expect(groupTickets([green, yellowLate, yellowOverdue, red]).waiting.map((t) => t.id)).toEqual([red.id, yellowOverdue.id, yellowLate.id, green.id]);
  });

  it('puts emergencies first among those waiting for triage', () => {
    const early = ticket({ status: 'WAITING_TRIAGE', arrivedAt: '2026-10-23T07:00:00.000Z' });
    const emergency = ticket({ status: 'WAITING_TRIAGE', source: 'EMERGENCY', arrivedAt: '2026-10-23T09:00:00.000Z' });
    expect(groupTickets([early, emergency]).triage.map((t) => t.id)).toEqual([emergency.id, early.id]);
  });

  it('separates called and finished tickets', () => {
    const called = ticket({ status: 'CALLED', calledAt: '2026-10-23T09:00:00.000Z' });
    const done = ticket({ status: 'DONE' });
    const cols = groupTickets([called, done]);
    expect(cols.active.map((t) => t.id)).toEqual([called.id]);
    expect(cols.finished.map((t) => t.id)).toEqual([done.id]);
  });
});

describe('allowedActions', () => {
  it('lets only clinical staff triage and start', () => {
    expect(allowedActions('WAITING_TRIAGE', 'NURSE')).toContain('triage');
    expect(allowedActions('WAITING_TRIAGE', 'RECEPTIONIST')).not.toContain('triage');
    expect(allowedActions('CALLED', 'RECEPTIONIST')).not.toContain('start');
    expect(allowedActions('CALLED', 'DOCTOR')).toContain('start');
    expect(allowedActions('IN_SERVICE', 'DOCTOR')).toContain('complete');
  });

  it('gives nothing to other roles or finished tickets', () => {
    expect(allowedActions('WAITING', 'PHARMACIST')).toEqual([]);
    expect(allowedActions('WAITING', 'PATIENT')).toEqual([]);
    expect(allowedActions('DONE', 'ADMIN')).toEqual([]);
  });
});

describe('triage reasons', () => {
  it('parses the reason codes from the score', () => {
    expect(parseReason('TEWS_7')).toEqual({ kind: 'tews', score: 7 });
    expect(parseReason('LOW_SPO2')).toEqual({ kind: 'spo2' });
    expect(parseReason('DISCRIMINATOR_CHEST_PAIN')).toEqual({ kind: 'discriminator', code: 'CHEST_PAIN' });
  });

  it('has unique discriminator codes', () => {
    const codes = TRIAGE_DISCRIMINATORS.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
