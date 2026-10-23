import { beforeEach, describe, expect, it } from 'vitest';
import { localizeServerMessage } from '@/lib/api';
import { backendErrorsFr, backendErrorPatternsFr } from '@/locales/backend-errors';

describe('localizeServerMessage', () => {
  beforeEach(() => localStorage.clear());

  it('translates exact backend messages to French by default', () => {
    expect(localizeServerMessage('Invalid email or password')).toBe(backendErrorsFr['Invalid email or password']);
    expect(localizeServerMessage('Invalid email or password')).not.toBe('Invalid email or password');
  });

  it('leaves messages in English when the UI is in English', () => {
    localStorage.setItem('language', 'en');
    expect(localizeServerMessage('Invalid email or password')).toBe('Invalid email or password');
  });

  it('passes unknown messages through unchanged', () => {
    expect(localizeServerMessage('Something nobody translated')).toBe('Something nobody translated');
  });

  it('translates each part of a "Validation failed" message', () => {
    const message = 'Validation failed: The patient must consent to the processing of their data, Something else';
    const result = localizeServerMessage(message);
    expect(result).toContain(backendErrorsFr['The patient must consent to the processing of their data']);
    expect(result).toContain('Something else');
    expect(result).not.toContain('Validation failed');
  });

  // One realistic sample per pattern: every pattern must match one of these
  const samples = [
    'Cannot delete medication with existing prescriptions. This medication has been used in 3 prescription items. Consider deactivating it instead.',
    'Payment amount (50000) exceeds invoice balance (34345.5)',
    'Cannot reschedule an appointment with status: COMPLETED',
    'Maximum reschedule limit (3) reached. Please cancel and create a new appointment.',
    'Cannot delete department with associated staff. This department has 1 doctors, 0 nurses, and 2 other staff members.',
    'Cannot delete lab test with existing orders. This lab test has been used in 4 lab orders. Consider deactivating it instead.',
    'Insufficient stock: Amoxicilline requires 30 units but only 12 available',
    'Invalid action: foo',
  ];

  it('has a sample for every message pattern', () => {
    for (const [pattern] of backendErrorPatternsFr) {
      expect(samples.some((s) => pattern.test(s)), `no sample for ${pattern}`).toBe(true);
    }
  });

  it.each(samples)('translates "%s"', (sample) => {
    const result = localizeServerMessage(sample);
    expect(result).not.toBe(sample);
    expect(result).toMatch(/[éèàç]|Impossible|Stock|Action|Nombre|montant/i);
  });

  it('formats amounts and enum values inside patterns', () => {
    expect(localizeServerMessage('Payment amount (50000) exceeds invoice balance (34345.5)')).toContain('50 000 FCFA');
    expect(localizeServerMessage('Payment amount (50000) exceeds invoice balance (34345.5)')).toContain('34 346 FCFA');
    expect(localizeServerMessage('Cannot reschedule an appointment with status: COMPLETED')).toContain('Terminé');
  });
});
