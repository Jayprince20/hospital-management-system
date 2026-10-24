import { describe, expect, it } from 'vitest';
import { DENOMINATIONS, cashVariance, denominationTotal, invalidCount, normalizeCounts } from '@/lib/cash-desk';
import { canAccessRoute, hasPermission } from '@/lib/rbac';

describe('closing count', () => {
  it('adds up notes and coins, the 500 note and the 500 coin separately', () => {
    expect(denominationTotal({ '10000': '3', '5000': 1, '500': '2', '500c': '4', '25': '2', '5': '1' })).toBe(30000 + 5000 + 1000 + 2000 + 50 + 5);
  });

  it('treats blank, negative and invalid counts as zero', () => {
    expect(denominationTotal({ '10000': '', '1000': '-2', '100': 'abc', '50': ' 3 ' })).toBe(150);
    const counts = normalizeCounts({ '2000': '1' });
    expect(Object.keys(counts).sort()).toEqual(DENOMINATIONS.map((d) => d.key).sort());
    expect(counts['2000']).toBe(1);
    expect(counts['10']).toBe(0);
  });

  it('flags counts that are not whole numbers', () => {
    expect(invalidCount('')).toBe(false);
    expect(invalidCount('12')).toBe(false);
    expect(invalidCount('1.5')).toBe(true);
    expect(invalidCount('-1')).toBe(true);
  });

  it('variance is counted minus expected', () => {
    expect(cashVariance(45000, 45000)).toBe(0);
    expect(cashVariance(44500, 45000)).toBe(-500);
    expect(cashVariance(46000, 45000)).toBe(1000);
  });
});

describe('cash desk access', () => {
  it('cashiers operate their till, only admins supervise', () => {
    expect(hasPermission('RECEPTIONIST', 'cash-desk:operate')).toBe(true);
    expect(hasPermission('RECEPTIONIST', 'cash-desk:supervise')).toBe(false);
    expect(canAccessRoute('RECEPTIONIST', '/dashboard/cash-desk')).toBe(true);
    expect(canAccessRoute('RECEPTIONIST', '/dashboard/cash-desk/supervision')).toBe(false);
    expect(canAccessRoute('ADMIN', '/dashboard/cash-desk/supervision')).toBe(true);
    expect(canAccessRoute('PHARMACIST', '/dashboard/cash-desk')).toBe(false);
  });
});
