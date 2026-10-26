import { describe, it, expect } from 'vitest';
import {
  VACCINE_STATUS_STYLE,
  ageGroupLabel,
  ageGroupOf,
  alertKey,
  ancAlertStyle,
  chartMeasurements,
  chartPointOf,
  defaultIndicator,
  formatGA,
  formatZ,
  gaFromDays,
  groupSchedule,
  isRecordable,
  numOrUndef,
  nutritionStyle,
  sexCode,
  showGrowth,
  showPregnancy,
  showVaccination,
  sortStatuses,
  splitPregnancyAlerts,
  type GrowthPoint,
  type GrowthReference,
  type ScheduleItem,
} from '@/lib/maternal-child';
import { defaultRoute } from '@/components/maternal-child/record-dose-dialog';
import { extraTranslations } from '@/locales';

const item = (vaccineCode: string, doseNumber: number, dueOn: string, status: ScheduleItem['status'] = 'UPCOMING'): ScheduleItem => ({
  vaccineCode,
  doseNumber,
  label: `${vaccineCode} ${doseNumber}`,
  dueOn,
  status,
  recordId: null,
  administeredOn: null,
});

const point = (over: Partial<GrowthPoint>): GrowthPoint => ({
  id: 'g1',
  measuredOn: '2026-01-01',
  ageDays: 0,
  ageMonths: 0,
  weightKg: null,
  lengthHeightCm: null,
  measuredLying: true,
  headCircumferenceCm: null,
  muacCm: null,
  oedema: false,
  z: { wfa: null, lhfa: null, wflh: null, bfa: null, hcfa: null },
  status: [],
  recordedBy: { id: 'u', name: 'Nurse' },
  notes: null,
  ...over,
});

describe('vaccine status display', () => {
  it('has a colour for every status, red for overdue and amber for due', () => {
    expect(Object.keys(VACCINE_STATUS_STYLE).sort()).toEqual(['DUE', 'GIVEN', 'NOT_APPLICABLE', 'OVERDUE', 'UPCOMING']);
    expect(VACCINE_STATUS_STYLE.OVERDUE).toContain('red');
    expect(VACCINE_STATUS_STYLE.DUE).toContain('amber');
    expect(VACCINE_STATUS_STYLE.GIVEN).toContain('green');
  });

  it('only offers to record doses that are not given or excluded', () => {
    expect(isRecordable(item('BCG', 1, '2026-01-01', 'DUE'))).toBe(true);
    expect(isRecordable(item('BCG', 1, '2026-01-01', 'OVERDUE'))).toBe(true);
    expect(isRecordable(item('BCG', 1, '2026-01-01', 'GIVEN'))).toBe(false);
    expect(isRecordable(item('HPV', 1, '2035-01-01', 'NOT_APPLICABLE'))).toBe(false);
  });

  it('pre-selects the usual route', () => {
    expect(defaultRoute('BCG')).toBe('ID');
    expect(defaultRoute('OPV')).toBe('ORAL');
    expect(defaultRoute('MR')).toBe('SC');
    expect(defaultRoute('PENTA')).toBe('IM');
  });
});

describe('schedule grouped by age', () => {
  it('buckets the PEV ages as visits', () => {
    expect(ageGroupOf(0)).toEqual({ unit: 'birth', n: 0 });
    expect(ageGroupOf(42)).toEqual({ unit: 'weeks', n: 6 });
    expect(ageGroupOf(98)).toEqual({ unit: 'weeks', n: 14 });
    expect(ageGroupOf(270)).toEqual({ unit: 'months', n: 9 });
    expect(ageGroupOf(450)).toEqual({ unit: 'months', n: 15 });
    expect(ageGroupOf(3285)).toEqual({ unit: 'years', n: 9 });
    expect(ageGroupLabel({ unit: 'birth', n: 0 })).toEqual({ key: 'mc.age.birth' });
    expect(ageGroupLabel({ unit: 'months', n: 9 })).toEqual({ key: 'mc.age.months', params: { n: 9 } });
  });

  it('puts doses due the same day together, in age order', () => {
    const dob = '2026-01-01';
    const groups = groupSchedule(
      [item('MR', 1, '2026-09-28'), item('BCG', 1, '2026-01-01'), item('PENTA', 1, '2026-02-12'), item('OPV', 1, '2026-02-12'), item('YF', 1, '2026-09-28')],
      dob
    );
    expect(groups.map((g) => g.key)).toEqual(['birth-0', 'weeks-6', 'months-9']);
    expect(groups[1].items.map((i) => i.vaccineCode)).toEqual(['PENTA', 'OPV']);
    expect(groups[2].items).toHaveLength(2);
  });
});

describe('growth', () => {
  const ref: GrowthReference = {
    indicator: 'wfa',
    sex: 'M',
    xUnit: 'month',
    points: [0, 1, 2, 60].map((x) => ({ x, sdm3: 1, sdm2: 2, sd0: 3, sd2: 4, sd3: 5 })),
  };

  it('reads the sex for the WHO tables', () => {
    expect(sexCode('MALE')).toBe('M');
    expect(sexCode('female')).toBe('F');
    expect(sexCode('F')).toBe('F');
    expect(sexCode('OTHER')).toBeNull();
    expect(sexCode(undefined)).toBeNull();
  });

  it('places a measurement on each chart', () => {
    const p = point({ ageMonths: 6.2, weightKg: 7.5, lengthHeightCm: 66, headCircumferenceCm: 43 });
    expect(chartPointOf(p, 'wfa')).toEqual({ x: 6.2, y: 7.5 });
    expect(chartPointOf(p, 'lhfa')).toEqual({ x: 6.2, y: 66 });
    expect(chartPointOf(p, 'hcfa')).toEqual({ x: 6.2, y: 43 });
    expect(chartPointOf(p, 'bfa')).toEqual({ x: 6.2, y: 17.2 });
    expect(chartPointOf(p, 'wfl')).toEqual({ x: 66, y: 7.5 });
    // Weight-for-height starts at 2 years
    expect(chartPointOf(p, 'wfh')).toBeNull();
    expect(chartPointOf(point({ ageMonths: 30, weightKg: 12, lengthHeightCm: 90 }), 'wfh')).toEqual({ x: 90, y: 12 });
    expect(chartPointOf(point({ ageMonths: 3 }), 'wfa')).toBeNull();
  });

  it('keeps the points inside the reference range, in x order, with their z-score', () => {
    const points = [
      point({ id: 'b', ageMonths: 2, weightKg: 5, z: { wfa: -1.2, lhfa: null, wflh: null, bfa: null, hcfa: null } }),
      point({ id: 'a', ageMonths: 1, weightKg: 4 }),
      point({ id: 'c', ageMonths: 70, weightKg: 20 }),
    ];
    const shaped = chartMeasurements(points, 'wfa', ref);
    expect(shaped.map((s) => s.id)).toEqual(['a', 'b']);
    expect(shaped[1]).toMatchObject({ x: 2, y: 5, z: -1.2 });
  });

  it('opens on weight-for-age, BMI after 5 years', () => {
    expect(defaultIndicator(null)).toBe('wfa');
    expect(defaultIndicator(point({ ageMonths: 70 }))).toBe('bfa');
  });

  it('shows severe findings first, in red', () => {
    expect(sortStatuses(['STUNTED', 'SAM', 'FALTERING'])).toEqual(['SAM', 'STUNTED', 'FALTERING']);
    expect(nutritionStyle('SAM')).toContain('red');
    expect(nutritionStyle('MAM')).toContain('orange');
    expect(nutritionStyle('UNKNOWN_CODE')).toContain('gray');
  });

  it('formats z-scores with a sign and a decimal comma', () => {
    expect(formatZ(1.234)).toBe('+1,2');
    expect(formatZ(-2.46)).toBe('−2,5');
    expect(formatZ(0)).toBe('0,0');
    expect(formatZ(null)).toBe('—');
    expect(formatZ(-0.5, false)).toBe('−0.5');
  });
});

describe('antenatal care', () => {
  it('formats the gestational age as weeks+days', () => {
    expect(formatGA({ weeks: 24, days: 3 })).toBe('24+3');
    expect(formatGA(null)).toBe('—');
    expect(gaFromDays(171)).toEqual({ weeks: 24, days: 3 });
    expect(gaFromDays(-4)).toEqual({ weeks: 0, days: 0 });
  });

  it('labels visit alerts and risk factors from their own dictionaries', () => {
    expect(alertKey('SEVERE_HYPERTENSION')).toBe('mc.anc.alert.SEVERE_HYPERTENSION');
    expect(alertKey('PREVIOUS_CESAREAN')).toBe('mc.risk.PREVIOUS_CESAREAN');
    // HYPERTENSION is both a visit alert and a chronic risk factor: the context decides
    expect(alertKey('HYPERTENSION')).toBe('mc.anc.alert.HYPERTENSION');
    expect(alertKey('HYPERTENSION', 'risk')).toBe('mc.risk.HYPERTENSION');
    expect(ancAlertStyle('PREECLAMPSIA_SIGNS')).toContain('red');
    expect(ancAlertStyle('ANAEMIA')).toContain('orange');
  });

  it('splits the pregnancy alerts from the risk factors', () => {
    expect(splitPregnancyAlerts(['HYPERTENSION', 'AGE_OVER_35', 'ANAEMIA'], ['SICKLE_CELL'])).toEqual({
      alerts: ['HYPERTENSION', 'ANAEMIA'],
      risks: ['SICKLE_CELL', 'AGE_OVER_35'],
    });
  });

  it('parses optional numbers from form fields', () => {
    expect(numOrUndef('')).toBeUndefined();
    expect(numOrUndef(' 3,5 ')).toBe(3.5);
    expect(numOrUndef('abc')).toBeUndefined();
  });
});

describe('which sections a record shows', () => {
  const today = new Date(2026, 9, 26);
  it('vaccination under 15, growth under 19, pregnancy for women 10–55', () => {
    expect(showVaccination('2020-01-01', today)).toBe(true);
    expect(showVaccination('2000-01-01', today)).toBe(false);
    expect(showGrowth('2010-01-01', today)).toBe(true);
    expect(showGrowth('2000-01-01', today)).toBe(false);
    expect(showPregnancy('FEMALE', '1995-05-05', today)).toBe(true);
    expect(showPregnancy('MALE', '1995-05-05', today)).toBe(false);
    expect(showPregnancy('FEMALE', '2020-05-05', today)).toBe(false);
    expect(showPregnancy('FEMALE', '1960-05-05', today)).toBe(false);
  });
});

describe('translations', () => {
  it('has every maternal & child key in French and English, with the clinical labels', () => {
    const en = Object.keys(extraTranslations.en).filter((k) => k.startsWith('mc.'));
    const fr = Object.keys(extraTranslations.fr).filter((k) => k.startsWith('mc.'));
    expect(en.sort()).toEqual(fr.sort());
    expect(extraTranslations.fr['mc.nut.SAM']).toBe('Malnutrition aiguë sévère');
    for (const s of Object.keys(VACCINE_STATUS_STYLE)) expect(extraTranslations.fr[`mc.vax.status.${s}`]).toBeTruthy();
  });
});
