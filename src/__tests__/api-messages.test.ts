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

  it('translates the pharmacy purchasing messages', () => {
    for (const message of ['Only an administrator can approve this order', 'More than what is still expected', 'Batch number and expiry date are required for medications', 'This supplier invoice is already recorded', 'Payment exceeds the balance']) {
      expect(localizeServerMessage(message)).toBe(backendErrorsFr[message]);
    }
    expect(localizeServerMessage('Validation failed: At least one line is required')).toContain(backendErrorsFr['At least one line is required']);
  });

  it('translates the cash desk messages', () => {
    for (const message of ['Open your till before taking payments', 'Not enough cash in the till', 'Explain the difference before closing', 'Refund exceeds what the patient paid', 'Only an administrator can confirm the deposit', 'No receipt for this payment']) {
      expect(localizeServerMessage(message)).toBe(backendErrorsFr[message]);
    }
    expect(localizeServerMessage('Validation failed: Unknown note or coin')).toContain(backendErrorsFr['Unknown note or coin']);
  });

  it('translates the monthly statistics messages', () => {
    for (const message of ['The month is not over yet', 'This report is already validated', 'Validate the report first', 'Set the DHIS2 organisation unit first', 'This month has not started']) {
      expect(localizeServerMessage(message)).toBe(backendErrorsFr[message]);
    }
    expect(localizeServerMessage('Validation failed: Facility name is required')).toContain(backendErrorsFr['Facility name is required']);
  });

  it('translates the teleconsultation messages', () => {
    for (const message of ['Teleconsultation consent required', 'The waiting room opens 15 minutes before the appointment', 'This teleconsultation has ended', 'Only the doctor can end the teleconsultation']) {
      expect(localizeServerMessage(message)).toBe(backendErrorsFr[message]);
    }
    expect(localizeServerMessage('Validation failed: Consent must be accepted')).toContain(backendErrorsFr['Consent must be accepted']);
  });

  it('translates the consultation safety messages', () => {
    for (const message of ['Prescription safety check failed', 'A follow-up is already booked', 'Unknown ICD-10 code', 'The follow-up cannot be in the past']) {
      expect(localizeServerMessage(message)).toBe(backendErrorsFr[message]);
    }
    expect(localizeServerMessage('Unknown ICD-10 code: X99.9')).toBe('Code CIM-10 non répertorié : X99.9');
  });

  // One realistic sample per pattern: every pattern must match one of these
  const samples = [
    'Unknown ICD-10 code: X99.9',
    'Unknown indicator: cons.bogus',
    'Invalid DHIS2 identifier for cons.total',
    'Cannot delete medication with existing prescriptions. This medication has been used in 3 prescription items. Consider deactivating it instead.',
    'Payment amount (50000) exceeds invoice balance (34345.5)',
    'Payment amount (5000) exceeds patient balance (3000)',
    'Cannot reschedule an appointment with status: COMPLETED',
    'Maximum reschedule limit (3) reached. Please cancel and create a new appointment.',
    'Cannot delete department with associated staff. This department has 1 doctors, 0 nurses, and 2 other staff members.',
    'Cannot delete lab test with existing orders. This lab test has been used in 4 lab orders. Consider deactivating it instead.',
    'Insufficient stock: Amoxicilline requires 30 units but only 12 available',
    'Invalid action: foo',
    'Cannot cancel a successful transaction',
    'MTN MoMo is not configured for live payments (missing MTN_MOMO_API_KEY)',
    'Orange Money refused the payment request (HTTP 502)',
    'REVIEW: provider confirmed 9000 XAF instead of 10000 XAF',
    'Payment exceeds the insurer balance of invoice INV-2026-00012',
    'Invalid status: LOST',
    'This action is not possible for a ticket in status DONE',
    'Patient is allergic to Pénicilline',
    'Invalid administration time: 25:00',
    'At most 8 administration times per day',
    'Invalid note type: X',
    'Not enough stock for Paracétamol: 12 available',
    'Invalid movement type: STOLEN',
    'Paracétamol 500mg is no longer sold',
    'Quantity exceeds the prescribed quantity for Amoxicilline 500mg',
    'A prescription is required for Amoxicilline 500mg',
    'Invalid document type: LETTER',
    'This action is not possible for an exam in status PERFORMED',
    'File too large (max 10 MB)',
    'An exam can have at most 20 files',
    'Invalid modality: SCANNER',
    'Invalid priority: HIGH',
    'Invalid numeric result for Hémoglobine',
    'A result is required for Potassium',
    'Invalid result for Goutte épaisse: expected one of Négative, Positive',
    'Not enough leave days left (3 remaining)',
    'This swap would create a conflict: Narcisse Eyong already works at that time',
    'This swap would create a conflict: Odette Biya is on leave that day',
  ];

  it('has a sample for every message pattern', () => {
    for (const [pattern] of backendErrorPatternsFr) {
      expect(samples.some((s) => pattern.test(s)), `no sample for ${pattern}`).toBe(true);
    }
  });

  it.each(samples)('translates "%s"', (sample) => {
    const result = localizeServerMessage(sample);
    expect(result).not.toBe(sample);
    expect(result).toMatch(/[éèàç]|Impossible|Stock|Action|Nombre|montant|indisponible|vérifier/i);
  });

  it('formats amounts and enum values inside patterns', () => {
    expect(localizeServerMessage('Payment amount (50000) exceeds invoice balance (34345.5)')).toContain('50 000 FCFA');
    expect(localizeServerMessage('Payment amount (50000) exceeds invoice balance (34345.5)')).toContain('34 346 FCFA');
    expect(localizeServerMessage('Cannot reschedule an appointment with status: COMPLETED')).toContain('Terminé');
  });
});
