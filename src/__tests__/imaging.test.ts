import { describe, expect, it } from 'vitest';
import {
  fileProblem,
  formatFileSize,
  isIonising,
  isRadiologistProfile,
  needsPregnancyCheck,
  performBlockers,
  pregnancyNeedsAgreement,
  scheduleInPast,
  sortWorklist,
  timelineIndex,
} from '@/lib/imaging';

describe('pregnancy check', () => {
  it('applies to women 12–50 having an ionising exam only', () => {
    expect(isIonising('XRAY')).toBe(true);
    expect(isIonising('ULTRASOUND')).toBe(false);
    expect(needsPregnancyCheck('CT', 'FEMALE', 30)).toBe(true);
    expect(needsPregnancyCheck('CT', 'FEMALE', 12)).toBe(true);
    expect(needsPregnancyCheck('CT', 'FEMALE', 51)).toBe(false);
    expect(needsPregnancyCheck('CT', 'MALE', 30)).toBe(false);
    expect(needsPregnancyCheck('ULTRASOUND', 'FEMALE', 30)).toBe(false);
    expect(needsPregnancyCheck('XRAY', 'FEMALE', null)).toBe(false);
  });

  it('needs the radiologist when pregnancy is possible or confirmed', () => {
    expect(pregnancyNeedsAgreement('POSSIBLE')).toBe(true);
    expect(pregnancyNeedsAgreement('PREGNANT')).toBe(true);
    expect(pregnancyNeedsAgreement('NOT_PREGNANT')).toBe(false);
    expect(pregnancyNeedsAgreement(null)).toBe(false);
  });
});

describe('performBlockers', () => {
  const woman = { modality: 'XRAY' as const, usesContrast: false, gender: 'FEMALE', age: 28 };
  it('asks for the pregnancy status, then the agreement', () => {
    expect(performBlockers(woman)).toEqual(['img.safety.block.pregnancy']);
    expect(performBlockers({ ...woman, pregnancyStatus: 'POSSIBLE' })).toEqual(['img.safety.block.agreement']);
    expect(performBlockers({ ...woman, pregnancyStatus: 'POSSIBLE', radiologistAgreed: true })).toEqual([]);
    expect(performBlockers({ ...woman, pregnancyStatus: 'NOT_PREGNANT' })).toEqual([]);
  });
  it('asks for contrast checks and an allergy reason', () => {
    const contrast = { modality: 'CT' as const, usesContrast: true, gender: 'MALE', age: 60 };
    expect(performBlockers(contrast)).toEqual(['img.safety.block.contrast']);
    expect(performBlockers({ ...contrast, contrastChecked: true, contrastAllergy: true })).toEqual(['img.safety.block.allergy']);
    expect(performBlockers({ ...contrast, contrastChecked: true, contrastAllergy: true, overrideReason: 'Prémédication' })).toEqual([]);
  });
});

describe('files', () => {
  it('accepts JPEG, PNG and PDF up to the limit', () => {
    expect(fileProblem({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(fileProblem({ type: 'application/pdf', size: 1000 })).toBeNull();
    expect(fileProblem({ type: 'image/gif', size: 1000 })).toBe('img.files.badType');
    expect(fileProblem({ type: 'application/dicom', size: 1000 })).toBe('img.files.badType');
    expect(fileProblem({ type: 'image/png', size: 11 * 1024 * 1024 })).toBe('img.files.tooLarge');
    expect(fileProblem({ type: 'image/png', size: 0 })).toBe('img.files.empty');
  });
  it('formats sizes in French and English', () => {
    expect(formatFileSize(850 * 1024)).toBe('850 Ko');
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe('2,4 Mo');
    expect(formatFileSize(2.4 * 1024 * 1024, 'en')).toBe('2.4 MB');
  });
});

describe('worklist', () => {
  it('puts STAT first, then URGENT, then by time', () => {
    const rows = [
      { id: 'a', priority: 'ROUTINE' as const, scheduledAt: '2026-10-24T08:00:00Z', createdAt: '2026-10-23T08:00:00Z' },
      { id: 'b', priority: 'URGENT' as const, scheduledAt: null, createdAt: '2026-10-24T09:00:00Z' },
      { id: 'c', priority: 'STAT' as const, scheduledAt: null, createdAt: '2026-10-24T10:00:00Z' },
      { id: 'd', priority: 'ROUTINE' as const, scheduledAt: '2026-10-24T07:00:00Z', createdAt: '2026-10-23T09:00:00Z' },
    ];
    expect(sortWorklist(rows).map((r) => r.id)).toEqual(['c', 'b', 'd', 'a']);
  });
  it('places a status on the timeline', () => {
    expect(timelineIndex('ORDERED')).toBe(0);
    expect(timelineIndex('REPORTED')).toBe(4);
    expect(timelineIndex('CANCELLED')).toBe(-1);
  });
  it('refuses a schedule time in the past', () => {
    const now = new Date('2026-10-24T10:00:00');
    expect(scheduleInPast('2026-10-24T09:00', now)).toBe(true);
    expect(scheduleInPast('2026-10-24T09:58', now)).toBe(false);
    expect(scheduleInPast('2026-10-24T11:00', now)).toBe(false);
    expect(scheduleInPast('not a date', now)).toBe(true);
  });
});

describe('radiologist profile', () => {
  it('matches the radiology department or speciality, accents ignored', () => {
    expect(isRadiologistProfile('Imagerie médicale', [])).toBe(true);
    expect(isRadiologistProfile('Urgences', ['Radiologie'])).toBe(true);
    expect(isRadiologistProfile('Gynécologie', ['Echographie obstétricale'])).toBe(true);
    expect(isRadiologistProfile('Cardiologie', ['Cardiologie'])).toBe(false);
    expect(isRadiologistProfile(null, null)).toBe(false);
  });
});
