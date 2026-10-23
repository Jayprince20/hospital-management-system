import { describe, expect, it } from 'vitest';
import {
  actingHeaders,
  ageOn,
  canConfirmPresence,
  computeNps,
  confirmationBadge,
  contactKind,
  eighteenthBirthday,
  isLegalRepresentative,
  isMinor,
  isOwnerOnlyPath,
  isValidRecommend,
  isValidStar,
  lastAccessDay,
  maskEmail,
  maskPhone,
  parseActingProfile,
  readActingProfile,
  recommendGroup,
  surveyPayload,
  surveyProblem,
  tomorrowString,
  visiblePortalTab,
  writeActingProfile,
  ACTING_HEADER,
  ACTING_STORAGE_KEY,
  type ActingProfile,
  type SurveyAnswers,
} from '@/lib/patient-extras';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

const profile: ActingProfile = {
  patientId: 'pat-junior',
  firstName: 'Junior',
  lastName: 'Abena',
  relationship: 'PARENT',
  accessLevel: 'FULL',
  ownerUserId: 'user-mother',
};

describe('acting profile storage', () => {
  it('round-trips and sends the family header', () => {
    const storage = memoryStorage();
    writeActingProfile(storage, profile);
    expect(readActingProfile(storage, 'user-mother')).toEqual(profile);
    expect(actingHeaders(profile)).toEqual({ [ACTING_HEADER]: 'pat-junior' });
    expect(actingHeaders(null)).toEqual({});
    writeActingProfile(storage, null);
    expect(storage.data.has(ACTING_STORAGE_KEY)).toBe(false);
  });

  it('ignores another account’s choice and malformed values', () => {
    expect(parseActingProfile(JSON.stringify(profile), 'someone-else')).toBeNull();
    expect(parseActingProfile('{not json', 'user-mother')).toBeNull();
    expect(parseActingProfile(JSON.stringify({ ...profile, accessLevel: 'ROOT' }), 'user-mother')).toBeNull();
    expect(parseActingProfile(null)).toBeNull();
  });
});

describe('what a relative may see', () => {
  it('hides owner-only pages and tabs, and clinical tabs for appointments & billing', () => {
    expect(isOwnerOnlyPath('/dashboard/profile')).toBe(true);
    expect(isOwnerOnlyPath('/dashboard/family')).toBe(true);
    expect(isOwnerOnlyPath('/dashboard/my-health')).toBe(false);
    expect(visiblePortalTab('privacy', 'SELF')).toBe(true);
    expect(visiblePortalTab('privacy', 'FULL', 'SPOUSE')).toBe(false);
    expect(visiblePortalTab('privacy', 'FULL', 'PARENT')).toBe(true);
    expect(visiblePortalTab('lab-results', 'APPOINTMENTS_BILLING', 'CHILD')).toBe(false);
    expect(visiblePortalTab('billing', 'APPOINTMENTS_BILLING', 'CHILD')).toBe(true);
    expect(isLegalRepresentative('GUARDIAN', 'APPOINTMENTS_BILLING')).toBe(false);
  });

  it('computes ages, minors and the 18th birthday', () => {
    const today = new Date(2026, 9, 24);
    expect(ageOn('2018-03-10', today)).toBe(8);
    expect(ageOn('2008-10-25', today)).toBe(17);
    expect(isMinor('2008-10-24', today)).toBe(false);
    expect(eighteenthBirthday('2018-03-10')).toBe('2036-03-10');
    expect(eighteenthBirthday('2008-02-29')).toBe('2026-02-28');
    // validUntil is exclusive: access ends the day before
    expect(lastAccessDay('2036-03-10')).toBe('2036-03-09');
    expect(lastAccessDay(null)).toBeNull();
  });

  it('masks contacts and recognises an email or a phone', () => {
    expect(maskPhone('+237 6 99 12 34 56')).toBe('•••• 3456');
    expect(maskEmail('junior.abena@gmail.com')).toBe('j•••@gmail.com');
    expect(contactKind('marie@gmail.com')).toBe('email');
    expect(contactKind('+237 699 12 34 56')).toBe('phone');
    expect(contactKind('12')).toBeNull();
  });
});

describe('feedback', () => {
  it('computes the NPS', () => {
    expect(recommendGroup(9)).toBe('PROMOTER');
    expect(recommendGroup(7)).toBe('PASSIVE');
    expect(recommendGroup(6)).toBe('DETRACTOR');
    expect(computeNps([10, 9, 8, 3, null, 11])).toEqual({ score: 25, promoters: 2, passives: 1, detractors: 1, total: 4 });
    expect(computeNps([]).score).toBeNull();
  });

  it('validates ratings and builds the payload', () => {
    expect(isValidStar(5)).toBe(true);
    expect(isValidStar(0)).toBe(false);
    expect(isValidStar(4.5)).toBe(false);
    expect(isValidRecommend(0)).toBe(true);
    const base: SurveyAnswers = {
      overall: null,
      waitTime: null,
      staffCourtesy: null,
      explanations: null,
      cleanliness: null,
      recommend: null,
      comment: '',
      isComplaint: false,
      complaintCategory: '',
      contactBack: false,
    };
    expect(surveyProblem(base)).toBe('overallRequired');
    expect(surveyProblem({ ...base, overall: 4, isComplaint: true })).toBe('categoryRequired');
    const answers = { ...base, overall: 2, waitTime: 1, recommend: 3, comment: '  Trop d’attente ', isComplaint: true, complaintCategory: 'WAIT' as const };
    expect(surveyProblem(answers)).toBeNull();
    expect(surveyPayload(answers)).toEqual({ overall: 2, waitTime: 1, recommend: 3, comment: 'Trop d’attente', isComplaint: true, complaintCategory: 'WAIT' });
  });
});

describe('appointment confirmation', () => {
  const today = new Date(2026, 9, 24);
  it('labels how it was confirmed, or not confirmed when close', () => {
    expect(confirmationBadge({ status: 'CONFIRMED', confirmedAt: '2026-10-24T08:00:00Z', confirmationChannel: 'SMS_REPLY' }, today)).toBe('SMS_REPLY');
    expect(confirmationBadge({ status: 'CONFIRMED' }, today)).toBe('CONFIRMED');
    expect(confirmationBadge({ status: 'SCHEDULED', appointmentDate: '2026-10-25' }, today)).toBe('UNCONFIRMED');
    expect(confirmationBadge({ status: 'SCHEDULED', appointmentDate: '2026-10-30' }, today)).toBeNull();
    expect(confirmationBadge({ status: 'CANCELLED', appointmentDate: '2026-10-25' }, today)).toBeNull();
  });

  it('lets a patient confirm upcoming scheduled appointments only', () => {
    expect(canConfirmPresence({ status: 'SCHEDULED', date: '2026-10-24' }, today)).toBe(true);
    expect(canConfirmPresence({ status: 'SCHEDULED', date: '2026-10-23' }, today)).toBe(false);
    expect(canConfirmPresence({ status: 'CONFIRMED', date: '2026-10-30' }, today)).toBe(false);
    expect(tomorrowString(today)).toBe('2026-10-25');
  });
});
