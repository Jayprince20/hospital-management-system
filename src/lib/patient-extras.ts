/**
 * Patient extras: family (proxy) access, visit feedback and appointment confirmation.
 * Pure helpers only — no React, no network — so they can be unit tested.
 */

// ---------- family / proxy access ----------

export type ProxyRelationship = 'PARENT' | 'GUARDIAN' | 'CHILD' | 'SPOUSE' | 'CAREGIVER' | 'OTHER';
export type ProxyAccessLevel = 'FULL' | 'APPOINTMENTS_BILLING';
export type ActingLevel = 'SELF' | ProxyAccessLevel;

export const PROXY_RELATIONSHIPS: ProxyRelationship[] = ['PARENT', 'GUARDIAN', 'CHILD', 'SPOUSE', 'CAREGIVER', 'OTHER'];
export const PROXY_ACCESS_LEVELS: ProxyAccessLevel[] = ['FULL', 'APPOINTMENTS_BILLING'];

/** The relative a patient account is currently acting for (kept for the browser tab only) */
export interface ActingProfile {
  patientId: string;
  firstName: string;
  lastName: string;
  relationship: ProxyRelationship;
  accessLevel: ProxyAccessLevel;
  /** The signed-in account that chose it: a different account never inherits it */
  ownerUserId: string;
}

export const ACTING_STORAGE_KEY = 'hms.actingAs';
/** Fired on window whenever the acting profile changes (same tab) */
export const ACTING_CHANGE_EVENT = 'hms-acting-change';
/** Header the API reads to serve a relative's record */
export const ACTING_HEADER = 'X-Act-As-Patient';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Parse a stored acting profile; anything malformed or belonging to another account is ignored */
export function parseActingProfile(raw: string | null, currentUserId?: string | null): ActingProfile | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ActingProfile>;
    if (
      typeof value.patientId !== 'string' ||
      !value.patientId ||
      typeof value.ownerUserId !== 'string' ||
      !PROXY_ACCESS_LEVELS.includes(value.accessLevel as ProxyAccessLevel) ||
      !PROXY_RELATIONSHIPS.includes(value.relationship as ProxyRelationship)
    ) {
      return null;
    }
    if (currentUserId && value.ownerUserId !== currentUserId) return null;
    return {
      patientId: value.patientId,
      firstName: typeof value.firstName === 'string' ? value.firstName : '',
      lastName: typeof value.lastName === 'string' ? value.lastName : '',
      relationship: value.relationship as ProxyRelationship,
      accessLevel: value.accessLevel as ProxyAccessLevel,
      ownerUserId: value.ownerUserId,
    };
  } catch {
    return null;
  }
}

export function readActingProfile(storage: KeyValueStorage | null | undefined, currentUserId?: string | null): ActingProfile | null {
  if (!storage) return null;
  try {
    return parseActingProfile(storage.getItem(ACTING_STORAGE_KEY), currentUserId);
  } catch {
    return null;
  }
}

export function writeActingProfile(storage: KeyValueStorage | null | undefined, profile: ActingProfile | null): void {
  if (!storage) return;
  try {
    if (profile) storage.setItem(ACTING_STORAGE_KEY, JSON.stringify(profile));
    else storage.removeItem(ACTING_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): acting simply isn't remembered
  }
}

/** Extra request header while acting for a relative (empty when acting as oneself) */
export function actingHeaders(profile: ActingProfile | null): Record<string, string> {
  return profile ? { [ACTING_HEADER]: profile.patientId } : {};
}

export function canSeeClinical(level: ActingLevel): boolean {
  return level !== 'APPOINTMENTS_BILLING';
}

/** Portal pages only the record owner may use: never while acting for someone else */
const OWNER_ONLY_PREFIXES = ['/dashboard/profile', '/dashboard/settings', '/dashboard/family', '/change-password', '/setup-2fa'];

export function isOwnerOnlyPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return OWNER_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** My-health tabs that show clinical data, hidden for an appointments & billing access */
export const CLINICAL_TABS = ['vitals', 'lab-results', 'imaging', 'prescriptions', 'consultations', 'documents'] as const;
/** My-health tabs only the owner sees (consents, data export) */
export const OWNER_ONLY_TABS = ['privacy'] as const;

/**
 * A parent or legal guardian with full access is the patient's legal representative: they may
 * also manage consents and data requests. Other relatives may not.
 */
export function isLegalRepresentative(relationship: ProxyRelationship | null | undefined, level: ActingLevel): boolean {
  return level === 'FULL' && (relationship === 'PARENT' || relationship === 'GUARDIAN');
}

export function visiblePortalTab(tab: string, level: ActingLevel, relationship?: ProxyRelationship | null): boolean {
  const ownerOnly = (OWNER_ONLY_TABS as readonly string[]).includes(tab);
  if (level !== 'SELF' && ownerOnly && !isLegalRepresentative(relationship, level)) return false;
  if (!canSeeClinical(level) && (CLINICAL_TABS as readonly string[]).includes(tab)) return false;
  return true;
}

function parseDay(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Age in whole years on a given day */
export function ageOn(dateOfBirth: string | Date, today: Date = new Date()): number | null {
  const dob = parseDay(dateOfBirth);
  if (!dob) return null;
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday = today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function isMinor(dateOfBirth: string | Date | null | undefined, today: Date = new Date()): boolean {
  if (!dateOfBirth) return false;
  const age = ageOn(dateOfBirth, today);
  return age !== null && age < 18;
}

/** The day a minor turns 18 (YYYY-MM-DD): the default end of a parent's access. 29 Feb → 28 Feb */
export function eighteenthBirthday(dateOfBirth: string | Date | null | undefined): string | null {
  if (!dateOfBirth) return null;
  const dob = parseDay(dateOfBirth);
  if (!dob) return null;
  const year = dob.getFullYear() + 18;
  const lastDay = new Date(year, dob.getMonth() + 1, 0).getDate();
  return dayString(new Date(year, dob.getMonth(), Math.min(dob.getDate(), lastDay)));
}

/**
 * Links store validUntil as the first day WITHOUT access: the last day of access is the day before
 * (shown to people as "jusqu'au …").
 */
export function lastAccessDay(validUntil: string | null | undefined): string | null {
  if (!validUntil) return null;
  const d = parseDay(validUntil);
  if (!d) return null;
  return dayString(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
}

/** "+237 6 99 12 34 56" → "•••• 3456" ; keeps nothing else of the number */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return digits ? '••••' : '';
  return `•••• ${digits.slice(-4)}`;
}

/** "junior.abena@gmail.com" → "j•••@gmail.com" */
export function maskEmail(email: string | null | undefined): string {
  const value = (email ?? '').trim();
  const at = value.indexOf('@');
  if (at < 1) return value ? '•••' : '';
  return `${value[0]}•••${value.slice(at)}`;
}

/** What the "give access" form accepts: an email or a phone number with at least 8 digits */
export function contactKind(value: string): 'email' | 'phone' | null {
  const v = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'email';
  if (/^\+?[\d\s.-]+$/.test(v) && v.replace(/\D/g, '').length >= 8) return 'phone';
  return null;
}

// ---------- feedback ----------

export type RecommendGroup = 'PROMOTER' | 'PASSIVE' | 'DETRACTOR';

/** NPS buckets: 9–10 promoters, 7–8 passives, 0–6 detractors */
export function recommendGroup(score: number): RecommendGroup {
  if (score >= 9) return 'PROMOTER';
  if (score >= 7) return 'PASSIVE';
  return 'DETRACTOR';
}

export interface NpsResult {
  score: number | null; // -100..100, null without answers
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
}

export function computeNps(scores: Array<number | null | undefined>): NpsResult {
  const valid = scores.filter((s): s is number => typeof s === 'number' && Number.isFinite(s) && s >= 0 && s <= 10);
  const promoters = valid.filter((s) => recommendGroup(s) === 'PROMOTER').length;
  const passives = valid.filter((s) => recommendGroup(s) === 'PASSIVE').length;
  const detractors = valid.length - promoters - passives;
  return {
    score: valid.length ? Math.round(((promoters - detractors) / valid.length) * 100) : null,
    promoters,
    passives,
    detractors,
    total: valid.length,
  };
}

export function isValidStar(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function isValidRecommend(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10;
}

export const COMPLAINT_CATEGORIES = ['WAIT', 'STAFF', 'CARE', 'BILLING', 'HYGIENE', 'OTHER'] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];
export const FEEDBACK_ASPECTS = ['waitTime', 'staffCourtesy', 'explanations', 'cleanliness'] as const;
export type FeedbackAspect = (typeof FEEDBACK_ASPECTS)[number];

export interface SurveyAnswers {
  overall: number | null;
  waitTime: number | null;
  staffCourtesy: number | null;
  explanations: number | null;
  cleanliness: number | null;
  recommend: number | null;
  comment: string;
  isComplaint: boolean;
  complaintCategory: ComplaintCategory | '';
  contactBack: boolean;
}

export const MAX_COMMENT_LENGTH = 2000;

/** First problem with the answers (a translation key suffix), or null when they can be sent */
export function surveyProblem(a: SurveyAnswers): 'overallRequired' | 'badRating' | 'badRecommend' | 'categoryRequired' | 'commentTooLong' | null {
  if (a.overall === null) return 'overallRequired';
  if (!isValidStar(a.overall)) return 'badRating';
  for (const aspect of FEEDBACK_ASPECTS) {
    const v = a[aspect];
    if (v !== null && !isValidStar(v)) return 'badRating';
  }
  if (a.recommend !== null && !isValidRecommend(a.recommend)) return 'badRecommend';
  if (a.isComplaint && !a.complaintCategory) return 'categoryRequired';
  if (a.comment.length > MAX_COMMENT_LENGTH) return 'commentTooLong';
  return null;
}

/** The request body for the survey: unanswered aspects are left out */
export function surveyPayload(a: SurveyAnswers): Record<string, unknown> {
  const body: Record<string, unknown> = { overall: a.overall };
  for (const aspect of FEEDBACK_ASPECTS) if (a[aspect] !== null) body[aspect] = a[aspect];
  if (a.recommend !== null) body.recommend = a.recommend;
  const comment = a.comment.trim();
  if (comment) body.comment = comment;
  if (a.isComplaint) {
    body.isComplaint = true;
    body.complaintCategory = a.complaintCategory;
  }
  if (a.contactBack) body.contactBack = true;
  return body;
}

// ---------- appointment confirmation ----------

export type ConfirmationChannel = 'SMS_REPLY' | 'LINK' | 'PORTAL' | 'PHONE' | 'DESK';
export const CONFIRMATION_CHANNELS: ConfirmationChannel[] = ['SMS_REPLY', 'LINK', 'PORTAL', 'PHONE', 'DESK'];

export type ConfirmationBadgeKind = ConfirmationChannel | 'CONFIRMED' | 'UNCONFIRMED' | null;

/**
 * What to show next to an appointment: how it was confirmed, or "not confirmed" when it is still
 * only scheduled and close (today or tomorrow). Nothing for closed appointments or later ones.
 */
export function confirmationBadge(
  appointment: { status: string; appointmentDate?: string | null; date?: string | null; confirmedAt?: string | null; confirmationChannel?: string | null },
  today: Date = new Date()
): ConfirmationBadgeKind {
  if (appointment.confirmedAt || appointment.status === 'CONFIRMED') {
    const channel = appointment.confirmationChannel as ConfirmationChannel | null | undefined;
    return channel && CONFIRMATION_CHANNELS.includes(channel) ? channel : 'CONFIRMED';
  }
  if (appointment.status !== 'SCHEDULED') return null;
  const day = parseDay(appointment.appointmentDate ?? appointment.date ?? '');
  if (!day) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((day.getTime() - start.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= 1 ? 'UNCONFIRMED' : null;
}

/** A patient can confirm a scheduled appointment that hasn't happened yet */
export function canConfirmPresence(appointment: { status: string; appointmentDate?: string | null; date?: string | null }, today: Date = new Date()): boolean {
  if (appointment.status !== 'SCHEDULED') return false;
  const day = parseDay(appointment.appointmentDate ?? appointment.date ?? '');
  if (!day) return false;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return day.getTime() >= start.getTime();
}

/** YYYY-MM-DD of tomorrow (local) */
export function tomorrowString(today: Date = new Date()): string {
  return dayString(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
}
