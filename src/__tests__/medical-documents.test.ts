import { describe, it, expect } from 'vitest';
import {
  addDays,
  canRevoke,
  defaultCertificateValidity,
  documentLabelKey,
  formatCode,
  hasPdf,
  isReferralOverdue,
  normalizeCode,
  sickLeaveEnd,
  sickLeaveProblem,
} from '@/lib/medical-documents';

describe('sick leave dates', () => {
  it('counts the first day', () => {
    expect(sickLeaveEnd('2026-10-10', 1)).toBe('2026-10-10');
    expect(sickLeaveEnd('2026-10-10', 3)).toBe('2026-10-12');
    expect(sickLeaveEnd('2026-10-30', 5)).toBe('2026-11-03');
    expect(sickLeaveEnd('2026-10-10', 0)).toBeNull();
  });

  it('follows the server limits', () => {
    const today = '2026-10-24';
    expect(sickLeaveProblem('2026-10-24', 3, today)).toBeNull();
    expect(sickLeaveProblem('2026-10-21', 3, today)).toBeNull();
    expect(sickLeaveProblem('2026-10-20', 3, today)).toBe('START_TOO_OLD');
    expect(sickLeaveProblem('2026-11-01', 3, today)).toBe('START_TOO_FAR');
    expect(sickLeaveProblem('2026-10-24', 91, today)).toBe('DAYS');
    expect(sickLeaveProblem('2026-10-24', 0, today)).toBe('DAYS');
  });

  it('adds days across months', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('verification codes', () => {
  it('normalises what people type', () => {
    expect(normalizeCode('abcde-fghjk')).toBe('ABCDE-FGHJK');
    expect(normalizeCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
    expect(normalizeCode(' abcde fghjk ')).toBe('ABCDE-FGHJK');
  });

  it('refuses ambiguous letters and wrong lengths', () => {
    expect(normalizeCode('ABCDE-FGHIO')).toBeNull();
    expect(normalizeCode('ABC')).toBeNull();
    expect(formatCode('zzzzz')).toBe('ZZZZZ');
  });
});

describe('referral follow-up', () => {
  const now = new Date('2026-10-24T12:00:00');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

  it('is overdue after 14 days without an answer', () => {
    expect(isReferralOverdue({ direction: 'OUTGOING', referralStatus: 'SENT', urgency: 'ROUTINE', issuedAt: daysAgo(15) }, now)).toBe(true);
    expect(isReferralOverdue({ direction: 'OUTGOING', referralStatus: 'SENT', urgency: 'ROUTINE', issuedAt: daysAgo(10) }, now)).toBe(false);
  });

  it('is overdue after 2 days for an emergency', () => {
    expect(isReferralOverdue({ direction: 'OUTGOING', referralStatus: 'SENT', urgency: 'EMERGENCY', issuedAt: daysAgo(3) }, now)).toBe(true);
  });

  it('never for answered or incoming referrals', () => {
    expect(isReferralOverdue({ direction: 'OUTGOING', referralStatus: 'COMPLETED', urgency: 'EMERGENCY', issuedAt: daysAgo(30) }, now)).toBe(false);
    expect(isReferralOverdue({ direction: 'INCOMING', referralStatus: 'ACKNOWLEDGED', urgency: 'EMERGENCY', issuedAt: daysAgo(30) }, now)).toBe(false);
  });
});

describe('labels and rules', () => {
  it('names a certificate by its kind', () => {
    expect(documentLabelKey({ type: 'MEDICAL_CERTIFICATE', certificateKind: 'SPORT' })).toBe('mdoc.kind.SPORT');
    expect(documentLabelKey({ type: 'SICK_LEAVE' })).toBe('mdoc.type.SICK_LEAVE');
    expect(documentLabelKey({ type: 'REFERRAL', direction: 'INCOMING' })).toBe('mdoc.type.REFERRAL_INCOMING');
  });

  it('gives fitness certificates a year', () => {
    expect(defaultCertificateValidity('FITNESS', '2026-10-24')).toBe('2027-10-23');
    expect(defaultCertificateValidity('GOOD_HEALTH', '2026-10-24')).toBe('');
  });

  it('lets a doctor revoke only their own documents', () => {
    const doc = { status: 'ISSUED' as const, doctor: { id: 'd1' } };
    expect(canRevoke(doc, { role: 'DOCTOR', doctorId: 'd1' })).toBe(true);
    expect(canRevoke(doc, { role: 'DOCTOR', doctorId: 'd2' })).toBe(false);
    expect(canRevoke(doc, { role: 'ADMIN' })).toBe(true);
    expect(canRevoke({ ...doc, status: 'REVOKED' }, { role: 'ADMIN' })).toBe(false);
    expect(canRevoke(doc, { role: 'NURSE' })).toBe(false);
  });

  it('has no PDF for an incoming referral', () => {
    expect(hasPdf({ type: 'REFERRAL', direction: 'INCOMING' })).toBe(false);
    expect(hasPdf({ type: 'REFERRAL', direction: 'OUTGOING' })).toBe(true);
  });
});
