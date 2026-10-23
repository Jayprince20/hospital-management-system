import { describe, expect, it } from 'vitest';
import { ageingBucket, coveredPercent, insurerDue, isInsured, patientDue, settlementLineError } from '@/lib/insurance';

describe('insurance helpers', () => {
  it('uses the patient balance when the invoice is split', () => {
    expect(patientDue({ balance: 10000, patientBalance: 2000 })).toBe(2000);
    expect(patientDue({ balance: 10000, patientBalance: 0 })).toBe(0);
    expect(patientDue({ balance: 10000 })).toBe(10000);
  });

  it('reports the insurer part', () => {
    expect(insurerDue({ balance: 10000, insurerBalance: 8000 })).toBe(8000);
    expect(insurerDue({ balance: 10000 })).toBe(0);
    expect(isInsured({ balance: 0, payerId: 'p1' })).toBe(true);
    expect(isInsured({ balance: 0, payerId: null, insurerShare: 0 })).toBe(false);
    expect(coveredPercent({ balance: 0, total: 15000, insurerShare: 12000 })).toBe(80);
    expect(coveredPercent({ balance: 0, total: 0, insurerShare: 0 })).toBe(0);
  });

  it('ages receivables in 30-day buckets', () => {
    const asOf = new Date(2026, 9, 23);
    expect(ageingBucket(new Date(2026, 9, 1), asOf)).toBe('current');
    expect(ageingBucket(new Date(2026, 8, 23), asOf)).toBe('current');
    expect(ageingBucket(new Date(2026, 8, 22), asOf)).toBe('d31_60');
    expect(ageingBucket(new Date(2026, 7, 1), asOf)).toBe('d61_90');
    expect(ageingBucket(new Date(2026, 0, 1), asOf)).toBe('d90plus');
  });

  it('validates settlement lines like the API', () => {
    const base = { amountClaimed: 8000, amountApproved: 8000, amountPaid: 8000, alreadyPaid: 0, rejectionReason: '' };
    expect(settlementLineError(base)).toBeNull();
    expect(settlementLineError({ ...base, amountApproved: 9000 })).toBe('approvedTooHigh');
    expect(settlementLineError({ ...base, amountPaid: 8500 })).toBe('paidTooHigh');
    expect(settlementLineError({ ...base, amountApproved: 6000, amountPaid: 6000 })).toBe('reasonRequired');
    expect(settlementLineError({ ...base, amountApproved: 0, amountPaid: 0, rejectionReason: 'Hors garantie' })).toBeNull();
    expect(settlementLineError({ ...base, amountPaid: -1 })).toBe('negative');
    // A second payment on a line counts what was already received
    expect(settlementLineError({ ...base, alreadyPaid: 5000, amountPaid: 3000 })).toBeNull();
    expect(settlementLineError({ ...base, alreadyPaid: 5000, amountPaid: 3001 })).toBe('paidTooHigh');
  });
});
