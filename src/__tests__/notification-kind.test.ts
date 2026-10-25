import { describe, it, expect } from 'vitest';
import { notificationKind } from '@/context/notification-context';

describe('notificationKind', () => {
  it('keeps known display types', () => {
    expect(notificationKind('appointment')).toBe('appointment');
    expect(notificationKind('payment')).toBe('payment');
  });

  it('maps specific backend types onto a display family', () => {
    expect(notificationKind('lab_critical')).toBe('lab_result');
    expect(notificationKind('imaging_critical')).toBe('lab_result');
    expect(notificationKind('cash-desk')).toBe('payment');
  });

  it('falls back to system for unknown or missing types', () => {
    expect(notificationKind('roster')).toBe('system');
    expect(notificationKind('purchasing')).toBe('system');
    expect(notificationKind(undefined)).toBe('system');
  });
});
