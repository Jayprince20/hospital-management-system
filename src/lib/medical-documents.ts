// Pure helpers for medical documents (certificates, sick leave, referral letters)

export type MedicalDocumentType = 'SICK_LEAVE' | 'MEDICAL_CERTIFICATE' | 'REFERRAL';
export type MedicalDocumentStatus = 'ISSUED' | 'REVOKED';
export type ReferralStatus = 'SENT' | 'ACKNOWLEDGED' | 'COMPLETED' | 'CANCELLED';
export type ReferralUrgency = 'ROUTINE' | 'URGENT' | 'EMERGENCY';
export type CertificateKind = 'GOOD_HEALTH' | 'FITNESS' | 'SPORT' | 'INJURY_REPORT' | 'OTHER';
export type LeaveKind = 'INITIAL' | 'EXTENSION';
export type ReferralDirection = 'OUTGOING' | 'INCOMING';

export const DOCUMENT_TYPES: MedicalDocumentType[] = ['SICK_LEAVE', 'MEDICAL_CERTIFICATE', 'REFERRAL'];
export const CERTIFICATE_KINDS: CertificateKind[] = ['GOOD_HEALTH', 'FITNESS', 'SPORT', 'INJURY_REPORT', 'OTHER'];
export const URGENCIES: ReferralUrgency[] = ['ROUTINE', 'URGENT', 'EMERGENCY'];
export const REFERRAL_STATUSES: ReferralStatus[] = ['SENT', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED'];
export const LEAVE_DAY_CHIPS = [1, 3, 5, 7, 14];
export const MAX_LEAVE_DAYS = 90;

/** Local calendar day as YYYY-MM-DD */
export function localDay(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add whole days to a YYYY-MM-DD day (no time zone drift) */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + days));
}

/** Whole days from one YYYY-MM-DD day to another (b - a) */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Last day of a sick leave: the start day counts, so 3 days from the 10th end on the 12th */
export function sickLeaveEnd(startDay: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay) || !Number.isInteger(days) || days < 1) return null;
  return addDays(startDay, days - 1);
}

/**
 * Why a sick leave can't be issued as typed, or null. Mirrors the server: start at most 3 days
 * back and 7 days ahead, 1 to 90 days.
 */
export function sickLeaveProblem(startDay: string, days: number, today: string = localDay()): 'START_TOO_OLD' | 'START_TOO_FAR' | 'DAYS' | null {
  if (!Number.isInteger(days) || days < 1 || days > MAX_LEAVE_DAYS) return 'DAYS';
  const offset = daysBetween(today, startDay);
  if (offset < -3) return 'START_TOO_OLD';
  if (offset > 7) return 'START_TOO_FAR';
  return null;
}

const CODE_ALPHABET = /^[A-HJ-NP-Z2-9]{10}$/;

/** "abcde-fghij", "ABCDEFGHIJ" or with spaces -> "ABCDE-FGHIJ"; null when it can't be a code */
export function normalizeCode(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/[\s-]/g, '');
  if (!CODE_ALPHABET.test(compact)) return null;
  return `${compact.slice(0, 5)}-${compact.slice(5)}`;
}

/** Display a code with its dash, whatever was stored */
export function formatCode(code: string): string {
  return normalizeCode(code) ?? code.toUpperCase();
}

/** An outgoing referral nobody answered for too long: 14 days, or 2 days for an emergency */
export function isReferralOverdue(
  doc: { direction?: string | null; referralStatus?: ReferralStatus | null; urgency?: ReferralUrgency | null; issuedAt: string },
  now: Date = new Date()
): boolean {
  if (doc.direction !== 'OUTGOING') return false;
  if (doc.referralStatus !== 'SENT' && doc.referralStatus !== 'ACKNOWLEDGED') return false;
  const days = daysWaiting(doc.issuedAt, now);
  if (doc.urgency === 'EMERGENCY') return days > 2;
  return doc.referralStatus === 'SENT' && days > 14;
}

/** Full days since a date-time */
export function daysWaiting(since: string, now: Date = new Date()): number {
  const start = new Date(since);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
}

/** Translation key for a document's label: the kind of certificate matters more than "certificat" */
export function documentLabelKey(doc: { type: MedicalDocumentType; certificateKind?: string | null; direction?: string | null }): string {
  if (doc.type === 'MEDICAL_CERTIFICATE' && doc.certificateKind) return `mdoc.kind.${doc.certificateKind}`;
  if (doc.type === 'REFERRAL' && doc.direction === 'INCOMING') return 'mdoc.type.REFERRAL_INCOMING';
  return `mdoc.type.${doc.type}`;
}

/** Fitness and sport certificates are valid one year by default */
export function defaultCertificateValidity(kind: CertificateKind, today: string = localDay()): string {
  if (kind === 'FITNESS' || kind === 'SPORT') return addDays(addDays(today, 365), -1);
  return '';
}

/** A doctor may revoke their own documents; an admin any */
export function canRevoke(doc: { status: MedicalDocumentStatus; doctor: { id: string } }, user: { role?: string; doctorId?: string | null } | null | undefined): boolean {
  if (!user || doc.status !== 'ISSUED') return false;
  if (user.role === 'ADMIN') return true;
  return user.role === 'DOCTOR' && Boolean(user.doctorId) && user.doctorId === doc.doctor.id;
}

/** PDF exists for every issued/revoked document except an incoming referral (it is the other side's letter) */
export function hasPdf(doc: { type: MedicalDocumentType; direction?: string | null }): boolean {
  return !(doc.type === 'REFERRAL' && doc.direction === 'INCOMING');
}
