import { describe, expect, it } from 'vitest';
import {
  addMonths,
  countWorkingDays,
  coverageLevel,
  coversDay,
  isManagerOf,
  isValidTime,
  monthDays,
  monthOf,
  readableTextColor,
  shiftHours,
  shiftSpan,
  warningKey,
  weekStart,
} from '@/lib/rosters';

describe('shift spans', () => {
  it('handles day, overnight and 24 h shifts', () => {
    expect(shiftHours('07:00', '19:00')).toBe(12);
    const night = shiftSpan('2026-10-23', '19:00', '07:00');
    expect(night.overnight).toBe(true);
    expect(night.hours).toBe(12);
    expect(night.endsAt.getDate()).toBe(24);
    expect(shiftHours('08:00', '08:00')).toBe(24);
    expect(shiftHours('18:00', '08:00')).toBe(14);
  });

  it('validates times', () => {
    expect(isValidTime('07:30')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('7h')).toBe(false);
  });
});

describe('calendar helpers', () => {
  it('lists the days of a month with weekends, holidays and today', () => {
    const days = monthDays('2026-05', [{ date: '2026-05-20', name: 'Fête Nationale' }], '2026-05-04');
    expect(days).toHaveLength(31);
    expect(days[0]).toMatchObject({ date: '2026-05-01', weekday: 5 });
    expect(days.find((d) => d.date === '2026-05-03')?.isSunday).toBe(true);
    expect(days.find((d) => d.date === '2026-05-20')).toMatchObject({ isHoliday: true, holidayName: 'Fête Nationale' });
    expect(days.find((d) => d.isToday)?.date).toBe('2026-05-04');
  });

  it('moves between months and finds the Monday of a week', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthOf('2026-10-23')).toBe('2026-10');
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // Sunday -> previous Monday
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
  });
});

describe('leave days', () => {
  it('counts Monday to Saturday minus public holidays', () => {
    // Mon 18 May – Sun 24 May 2026, Wednesday 20 May is the Fête Nationale
    expect(countWorkingDays('2026-05-18', '2026-05-24', ['2026-05-20'])).toBe(5);
    expect(countWorkingDays('2026-05-24', '2026-05-24')).toBe(0); // a Sunday
    expect(countWorkingDays('2026-05-20', '2026-05-18')).toBe(0);
  });

  it('knows whether a leave covers a day', () => {
    expect(coversDay({ startDate: '2026-11-02', endDate: '2026-11-06' }, '2026-11-06')).toBe(true);
    expect(coversDay({ startDate: '2026-11-02T00:00:00.000Z', endDate: '2026-11-06' }, '2026-11-07')).toBe(false);
  });
});

describe('roles and display', () => {
  it('admins and the head of department manage the roster', () => {
    expect(isManagerOf({ id: 'u1', role: 'ADMIN' }, { head: null })).toBe(true);
    expect(isManagerOf({ id: 'u2', role: 'DOCTOR' }, { head: { id: 'u2' } })).toBe(true);
    expect(isManagerOf({ id: 'u3', role: 'NURSE' }, { head: { id: 'u2' } })).toBe(false);
    expect(isManagerOf(null, { head: { id: 'u2' } })).toBe(false);
  });

  it('maps warnings, coverage and readable chip text', () => {
    expect(warningKey('REST_UNDER_11H')).toBe('ros.warning.REST_UNDER_11H');
    expect(warningKey('SOMETHING')).toBe('ros.warning.OTHER');
    expect(coverageLevel(0)).toBe('none');
    expect(coverageLevel(2)).toBe('ok');
    expect(readableTextColor('#111827')).toBe('#ffffff');
    expect(readableTextColor('#fde68a')).toBe('#111827');
  });
});
