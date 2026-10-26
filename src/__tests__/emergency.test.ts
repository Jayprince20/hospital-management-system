import { describe, it, expect } from 'vitest';
import {
  breachAt,
  clockOffset,
  dispositionsFor,
  edActionsFor,
  filterBoard,
  formatMedian,
  formatRate,
  formatWait,
  freeBays,
  initialsOf,
  newlyBreaching,
  serverNowMs,
  sortBoard,
  targetMinutesFor,
  tvLabel,
  NO_FILTER,
  type BayState,
  type BoardRow,
} from '@/lib/emergency';
import { canAccessRoute } from '@/lib/rbac';
import emergency from '@/locales/emergency';

const NOW = Date.parse('2026-10-26T10:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

function row(over: Partial<BoardRow> = {}): BoardRow {
  return {
    id: over.id ?? 'e1',
    patient: { id: 'p1', patientId: 'PAT-1', firstName: 'Jean-Pierre', lastName: 'Atangana', age: 42, sex: 'MALE', allergies: [] },
    arrivedAt: minutesAgo(5),
    arrivalMode: 'WALK_IN',
    chiefComplaint: 'Douleur thoracique',
    triageLevel: 'ORANGE',
    triagedAt: minutesAgo(3),
    waitMinutes: 5,
    targetMinutes: 10,
    breaching: false,
    minutesToBreach: 5,
    bay: null,
    assignedDoctor: null,
    assignedNurse: null,
    seenAt: null,
    status: 'WAITING_DOCTOR',
    isolation: false,
    pendingResults: { lab: 0, imaging: 0 },
    lastVitals: null,
    ticketNumber: 'U-001',
    ...over,
  };
}

describe('SATS targets and breaches (server clock)', () => {
  it('uses the SATS targets, and 15 min for triage', () => {
    expect(targetMinutesFor('RED')).toBe(0);
    expect(targetMinutesFor('ORANGE')).toBe(10);
    expect(targetMinutesFor('YELLOW')).toBe(60);
    expect(targetMinutesFor('GREEN')).toBe(240);
    expect(targetMinutesFor(null)).toBe(15);
  });

  it('counts down to the target and flags a breach once it is passed', () => {
    expect(breachAt(row({ arrivedAt: minutesAgo(5) }), NOW)).toEqual({ waitMinutes: 5, targetMinutes: 10, breaching: false, minutesToBreach: 5 });
    expect(breachAt(row({ arrivedAt: minutesAgo(12) }), NOW)).toMatchObject({ breaching: true, minutesToBreach: -2 });
    // Exactly at the target is not yet a breach
    expect(breachAt(row({ arrivedAt: minutesAgo(10) }), NOW).breaching).toBe(false);
  });

  it('a RED patient breaches as soon as any time passes without a doctor', () => {
    expect(breachAt(row({ triageLevel: 'RED', arrivedAt: new Date(NOW - 30_000).toISOString() }), NOW).breaching).toBe(true);
  });

  it('untriaged patients are measured against the triage target', () => {
    expect(breachAt(row({ triageLevel: null, arrivedAt: minutesAgo(14) }), NOW)).toMatchObject({ targetMinutes: 15, breaching: false });
    expect(breachAt(row({ triageLevel: null, arrivedAt: minutesAgo(16) }), NOW).breaching).toBe(true);
  });

  it('seen or departed patients never breach', () => {
    expect(breachAt(row({ arrivedAt: minutesAgo(90), seenAt: minutesAgo(80) }), NOW)).toMatchObject({ breaching: false, targetMinutes: null, minutesToBreach: null, waitMinutes: 90 });
    expect(breachAt(row({ arrivedAt: minutesAgo(90), status: 'DEPARTED' }), NOW).breaching).toBe(false);
  });

  it('follows the server clock even when the device clock is wrong', () => {
    const serverNow = '2026-10-26T10:00:00.000Z';
    const deviceNow = NOW + 7 * 60_000; // device 7 min ahead
    const offset = clockOffset(serverNow, deviceNow);
    expect(offset).toBe(7 * 60_000);
    // 30 s later on the device = 30 s later on the server
    expect(serverNowMs(deviceNow + 30_000, offset)).toBe(NOW + 30_000);
    expect(clockOffset('not a date', deviceNow)).toBe(0);
  });
});

describe('timer and stats formatting', () => {
  it('formats waits as minutes, then hours with two-digit minutes', () => {
    expect(formatWait(0)).toBe('0 min');
    expect(formatWait(12)).toBe('12 min');
    expect(formatWait(59)).toBe('59 min');
    expect(formatWait(60)).toBe('1 h 00');
    expect(formatWait(65)).toBe('1 h 05');
    expect(formatWait(1560)).toBe('26 h 00');
    expect(formatWait(-3)).toBe('0 min');
  });

  it('shows a dash when a median or rate is unknown', () => {
    expect(formatMedian(null)).toBe('—');
    expect(formatMedian(undefined)).toBe('—');
    expect(formatMedian(37.6)).toBe('38 min');
    expect(formatRate(0.123)).toBe('12 %');
    expect(formatRate(null)).toBe('—');
  });
});

describe('board ordering and filters', () => {
  it('puts RED first, then untriaged, then ORANGE, YELLOW, GREEN; earlier arrivals first', () => {
    const rows = [
      row({ id: 'green', triageLevel: 'GREEN', arrivedAt: minutesAgo(200) }),
      row({ id: 'yellow', triageLevel: 'YELLOW', arrivedAt: minutesAgo(30) }),
      row({ id: 'untriaged', triageLevel: null, arrivedAt: minutesAgo(2) }),
      row({ id: 'orange-late', triageLevel: 'ORANGE', arrivedAt: minutesAgo(1) }),
      row({ id: 'orange-early', triageLevel: 'ORANGE', arrivedAt: minutesAgo(8) }),
      row({ id: 'red', triageLevel: 'RED', arrivedAt: minutesAgo(1) }),
    ];
    expect(sortBoard(rows).map((r) => r.id)).toEqual(['red', 'untriaged', 'orange-early', 'orange-late', 'yellow', 'green']);
  });

  it('filters by zone (incl. no bay), status and level', () => {
    const rows = [
      row({ id: 'a', bay: { id: 'b1', code: 'R1', zone: 'RESUS' }, triageLevel: 'RED', status: 'IN_TREATMENT' }),
      row({ id: 'b', bay: null, triageLevel: null, status: 'WAITING_TRIAGE' }),
      row({ id: 'c', bay: { id: 'b2', code: 'M1', zone: 'MINOR' }, triageLevel: 'GREEN' }),
    ];
    expect(filterBoard(rows, NO_FILTER)).toHaveLength(3);
    expect(filterBoard(rows, { ...NO_FILTER, zone: 'NONE' }).map((r) => r.id)).toEqual(['b']);
    expect(filterBoard(rows, { ...NO_FILTER, zone: 'RESUS' }).map((r) => r.id)).toEqual(['a']);
    expect(filterBoard(rows, { ...NO_FILTER, level: 'UNTRIAGED' }).map((r) => r.id)).toEqual(['b']);
    expect(filterBoard(rows, { ...NO_FILTER, status: 'IN_TREATMENT' }).map((r) => r.id)).toEqual(['a']);
  });

  it('offers free bays plus the current one', () => {
    const bays: BayState[] = [
      { id: 'b1', code: 'R1', label: 'Réa 1', zone: 'RESUS', occupiedBy: 'e1' },
      { id: 'b2', code: 'R2', label: 'Réa 2', zone: 'RESUS', occupiedBy: null },
      { id: 'b3', code: 'A1', label: 'Aigu 1', zone: 'ACUTE', occupiedBy: 'e9' },
    ];
    expect(freeBays(bays, 'e1').map((b) => b.code)).toEqual(['R1', 'R2']);
    expect(freeBays(bays).map((b) => b.code)).toEqual(['R2']);
  });

  it('announces each newly breaching patient once', () => {
    const rows = [{ id: 'a', breaching: true }, { id: 'b', breaching: false }, { id: 'c', breaching: true }];
    expect(newlyBreaching(rows, new Set())).toEqual(['a', 'c']);
    expect(newlyBreaching(rows, new Set(['a']))).toEqual(['c']);
  });
});

describe('TV privacy', () => {
  it('shows initials only, never the full name', () => {
    expect(initialsOf('Jean-Pierre', 'Atangana')).toBe('J.-P. A.');
    expect(initialsOf('odette', 'biya')).toBe('O. B.');
    expect(initialsOf('', '')).toBe('?');
    const label = tvLabel(row());
    expect(label).toBe('J.-P. A. · 42 M');
    expect(label).not.toContain('Atangana');
    expect(tvLabel(row({ patient: { ...row().patient, age: null, sex: null } }))).toBe('J.-P. A.');
  });
});

describe('role-based actions and disposition', () => {
  it('receptionists only register arrivals; only doctors take charge', () => {
    expect([...edActionsFor('RECEPTIONIST')]).toEqual(['arrival']);
    expect(edActionsFor('DOCTOR').has('seen')).toBe(true);
    expect(edActionsFor('NURSE').has('seen')).toBe(false);
    expect(edActionsFor('NURSE').has('disposition')).toBe(true);
    expect(edActionsFor('PATIENT').size).toBe(0);
    expect(edActionsFor(undefined).size).toBe(0);
  });

  it('"left without being seen" only before a doctor saw the patient', () => {
    expect(dispositionsFor({ seenAt: null })).toContain('LEFT_WITHOUT_BEING_SEEN');
    expect(dispositionsFor({ seenAt: minutesAgo(3) })).not.toContain('LEFT_WITHOUT_BEING_SEEN');
  });

  it('opens the board to ED staff and the receptionist, not to others', () => {
    for (const role of ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST']) expect(canAccessRoute(role, '/dashboard/emergency')).toBe(true);
    for (const role of ['PHARMACIST', 'LAB_TECH', 'PATIENT']) expect(canAccessRoute(role, '/dashboard/emergency')).toBe(false);
  });
});

describe('emergency locale', () => {
  it('has the same keys in French and English', () => {
    expect(Object.keys(emergency.fr).sort()).toEqual(Object.keys(emergency.en).sort());
  });
});
