import { describe, expect, it } from 'vitest';
import type { AdmissionBill, Ward, WardBed } from '@/lib/api';
import { addTime, billSplit, freeBeds, isOpenDose, needsReason, parseBedLabels, parseTime, wardTakes, MAX_TIMES } from '@/lib/inpatient';
import inpatient from '@/locales/inpatient';

const bed = (id: string, status: WardBed['status'], isActive = true): WardBed => ({ id, label: id, status, dailyRate: null, isActive, notes: null, occupant: null });
const ward = (id: string, gender: Ward['gender'], beds: WardBed[], isActive = true): Ward => ({
  id,
  name: id,
  code: id,
  type: 'GENERAL',
  gender,
  department: null,
  floor: null,
  dailyRate: 15000,
  isActive,
  notes: null,
  beds,
  counts: { total: beds.length, available: 0, occupied: 0, cleaning: 0, maintenance: 0, reserved: 0 },
  occupancyPct: 0,
});

describe('administration times', () => {
  it('reads the ways a time is typed on the ward', () => {
    expect(parseTime('8')).toBe('08:00');
    expect(parseTime('8h')).toBe('08:00');
    expect(parseTime('08h30')).toBe('08:30');
    expect(parseTime('20 h')).toBe('20:00');
    expect(parseTime('14:05')).toBe('14:05');
    expect(parseTime('24')).toBe('00:00');
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('8:75')).toBeNull();
    expect(parseTime('matin')).toBeNull();
  });

  it('keeps schedules sorted, without duplicates, within the limit', () => {
    expect(addTime(['20:00'], '08:00')).toEqual(['08:00', '20:00']);
    expect(addTime(['08:00'], '08:00')).toEqual(['08:00']);
    const full = Array.from({ length: MAX_TIMES }, (_, i) => `0${i}:00`);
    expect(addTime(full, '23:00')).toBe(full);
  });
});

describe('beds', () => {
  it('honours the ward gender rule', () => {
    expect(wardTakes('ANY', 'MALE')).toBe(true);
    expect(wardTakes('FEMALE', 'FEMALE')).toBe(true);
    expect(wardTakes('FEMALE', 'MALE')).toBe(false);
    expect(wardTakes('MALE', null)).toBe(true);
  });

  it('offers free or reserved active beds in active wards that take the patient', () => {
    const wards = [
      ward('MED-H', 'MALE', [bed('h1', 'AVAILABLE'), bed('h2', 'OCCUPIED')]),
      ward('MED-F', 'FEMALE', [bed('f1', 'AVAILABLE')]),
      ward('USI', 'ANY', [bed('u1', 'RESERVED'), bed('u2', 'CLEANING'), bed('u3', 'AVAILABLE', false)]),
      ward('OLD', 'ANY', [bed('o1', 'AVAILABLE')], false),
    ];
    expect(freeBeds(wards, 'MALE').map((x) => x.bed.id)).toEqual(['h1', 'u1']);
    expect(freeBeds(wards, 'FEMALE').map((x) => x.bed.id)).toEqual(['f1', 'u1']);
    expect(freeBeds(wards, 'MALE', 'h1').map((x) => x.bed.id)).toEqual(['u1']);
  });

  it('expands bed label ranges', () => {
    expect(parseBedLabels('1-4')).toEqual(['1', '2', '3', '4']);
    expect(parseBedLabels('1, 2, 12-A\n2')).toEqual(['1', '2', '12-A']);
    expect(parseBedLabels('')).toEqual([]);
  });
});

describe('doses', () => {
  it('asks for a reason unless the dose was given', () => {
    expect(needsReason('GIVEN')).toBe(false);
    expect(needsReason('REFUSED')).toBe(true);
    expect(needsReason('HELD')).toBe(true);
    expect(needsReason('MISSED')).toBe(true);
  });

  it('only open slots can be recorded', () => {
    expect(isOpenDose('DUE')).toBe(true);
    expect(isOpenDose('OVERDUE')).toBe(true);
    expect(isOpenDose('GIVEN')).toBe(false);
  });
});

describe('stay bill', () => {
  const base: AdmissionBill = { lines: [], subtotal: 100000, invoiced: false };
  it('reads the split flat or nested', () => {
    expect(billSplit({ ...base, insurerShare: 80000, patientShare: 20000 })).toMatchObject({ insurerShare: 80000, patientShare: 20000 });
    expect(billSplit({ ...base, preview: { insurerShare: 70000, patientShare: 30000 } })).toMatchObject({ insurerShare: 70000, patientShare: 30000 });
    expect(billSplit(base)).toMatchObject({ insurerShare: 0, patientShare: 100000, payerName: null });
  });
});

describe('inpatient labels', () => {
  it('names every bed status, dose status and route in French', () => {
    for (const key of ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'RESERVED']) expect(inpatient.fr[`inp.bed.${key}`]).toBeTruthy();
    for (const key of ['UPCOMING', 'DUE', 'OVERDUE', 'GIVEN', 'REFUSED', 'HELD', 'MISSED']) expect(inpatient.fr[`inp.dose.${key}`]).toBeTruthy();
    for (const key of ['PO', 'IV', 'IM', 'SC', 'INH', 'TOP', 'PR', 'SL', 'OTHER']) expect(inpatient.fr[`inp.route.${key}`]).toBeTruthy();
  });
});

describe('billSplit with the server shape', () => {
  it('reads the split nested under coverage', () => {
    const bill = {
      lines: [], subtotal: 100000, invoiced: false,
      coverage: { coverage: { payer: { name: 'AXA Assurances Cameroun' } }, insurerShare: 80000, patientShare: 20000 },
    } as unknown as Parameters<typeof billSplit>[0];
    expect(billSplit(bill)).toEqual({ insurerShare: 80000, patientShare: 20000, payerName: 'AXA Assurances Cameroun' });
  });
});

describe('paediatric wards', () => {
  it('are not offered to adults', () => {
    const ward = (id: string, type: string) => ({ id, name: id, code: id, type, gender: 'ANY', isActive: true, beds: [{ id: `${id}-1`, label: '1', status: 'AVAILABLE', isActive: true }] });
    const wards = [ward('ped', 'PAEDIATRIC'), ward('gen', 'GENERAL')] as unknown as Parameters<typeof freeBeds>[0];
    expect(freeBeds(wards, 'MALE', undefined, 41).map((x) => x.ward.id)).toEqual(['gen']);
    expect(freeBeds(wards, 'MALE', undefined, 6).map((x) => x.ward.id)).toEqual(['ped', 'gen']);
  });
});
