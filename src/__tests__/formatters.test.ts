import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateAge, toLocalDateString } from '@/lib/formatters';

describe('toLocalDateString', () => {
  afterEach(() => {
    process.env.TZ = 'Africa/Douala';
  });

  it('keeps the local calendar day just after midnight in Douala (UTC+1)', () => {
    // 00:30 in Yaoundé on 23 Oct is still 22 Oct in UTC: toISOString would give the wrong day
    const justAfterMidnight = new Date(2026, 9, 23, 0, 30);
    expect(justAfterMidnight.toISOString().slice(0, 10)).toBe('2026-10-22');
    expect(toLocalDateString(justAfterMidnight)).toBe('2026-10-23');
  });

  it('keeps the local calendar day just before midnight', () => {
    expect(toLocalDateString(new Date(2026, 9, 23, 23, 59))).toBe('2026-10-23');
  });

  it('pads month and day', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });

  it('defaults to today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 0, 15));
    expect(toLocalDateString()).toBe('2026-10-23');
    vi.useRealTimers();
  });
});

describe('calculateAge', () => {
  afterEach(() => vi.useRealTimers());

  it('counts a birthday that has passed this year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 12));
    expect(calculateAge(new Date(2019, 5, 11))).toBe(7);
  });

  it('does not count a birthday still to come this year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 12));
    expect(calculateAge(new Date(2019, 10, 1))).toBe(6);
  });

  it('counts the birthday on the day itself', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 12));
    expect(calculateAge(new Date(2000, 9, 23))).toBe(26);
  });
});
