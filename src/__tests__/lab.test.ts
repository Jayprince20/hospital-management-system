import { describe, expect, it } from 'vitest';
import {
  ageInYears,
  bucketsOf,
  flagSymbol,
  formatRange,
  isBiologistProfile,
  isValidBarcode,
  normaliseBarcode,
  numericFlag,
  parseNumeric,
  resultFlag,
  selectRange,
  sortLabWorklist,
} from '@/lib/lab';

const haemoglobin = {
  refLow: 12,
  refHigh: 17,
  criticalLow: 7,
  criticalHigh: 20,
  referenceRanges: [
    { sex: 'MALE' as const, low: 13, high: 17, label: 'Homme adulte', ageMinYears: 18 },
    { sex: 'FEMALE' as const, low: 12, high: 16, label: 'Femme adulte', ageMinYears: 18 },
    { ageMinYears: 1, ageMaxYears: 12, low: '11', high: '14.5', label: 'Enfant 1–12 ans' },
  ],
};

describe('selectRange', () => {
  it('picks the sex and age row for adults', () => {
    expect(selectRange(haemoglobin, 'MALE', 40)).toMatchObject({ low: 13, high: 17, criticalLow: 7, label: 'Homme adulte' });
    expect(selectRange(haemoglobin, 'FEMALE', 30)).toMatchObject({ low: 12, high: 16 });
  });
  it('uses the age band for a child of either sex', () => {
    expect(selectRange(haemoglobin, 'MALE', 6)).toMatchObject({ low: 11, high: 14.5, criticalHigh: 20 });
  });
  it('falls back to the test default when nothing matches', () => {
    expect(selectRange(haemoglobin, 'MALE', 15)).toMatchObject({ low: 12, high: 17, label: null });
    expect(selectRange({ refHigh: '5' }, 'FEMALE', null)).toMatchObject({ low: null, high: 5 });
  });
  it('prefers the narrower band between equally specific rows', () => {
    const t = { referenceRanges: [{ ageMinYears: 0, ageMaxYears: 18, low: 1 }, { ageMinYears: 1, ageMaxYears: 5, low: 2 }] };
    expect(selectRange(t, null, 3).low).toBe(2);
  });
});

describe('flags', () => {
  const range = selectRange(haemoglobin, 'MALE', 40);
  it('flags low, high and critical values', () => {
    expect(numericFlag(15, range)).toBe('N');
    expect(numericFlag(12.5, range)).toBe('L');
    expect(numericFlag(18, range)).toBe('H');
    expect(numericFlag(6.5, range)).toBe('LL');
    expect(numericFlag(21, range)).toBe('HH');
  });
  it('reads results by type', () => {
    expect(resultFlag('NUMERIC', '6,8', range)).toBe('LL');
    expect(resultFlag('NUMERIC', 'abc', range)).toBeNull();
    expect(resultFlag('OPTION', 'Négative', range, ['Négative', 'Positive'])).toBe('N');
    expect(resultFlag('OPTION', 'Positive', range, ['Négative', 'Positive'])).toBe('A');
    expect(resultFlag('OPTION', 'Peut-être', range, ['Négative', 'Positive'])).toBeNull();
    expect(resultFlag('TEXT', 'Flore banale', range)).toBeNull();
    expect(flagSymbol('HH')).toBe('↑!!');
  });
  it('parses decimals written with a comma', () => {
    expect(parseNumeric(' 12,5 ')).toBe(12.5);
    expect(parseNumeric('1 250')).toBe(1250);
    expect(parseNumeric('<5')).toBeNull();
    expect(parseNumeric('')).toBeNull();
  });
  it('formats ranges', () => {
    expect(formatRange({ low: 3.9, high: 6.1 })).toBe('3,9 – 6,1');
    expect(formatRange({ low: null, high: 5 })).toBe('< 5');
  });
});

describe('barcodes and roles', () => {
  it('keeps the digits a scanner typed', () => {
    expect(normaliseBarcode(' 0123456789\n')).toBe('0123456789');
    expect(isValidBarcode('0123456789')).toBe(true);
    expect(isValidBarcode('12345')).toBe(false);
  });
  it('recognises biologists', () => {
    expect(isBiologistProfile("Laboratoire d'analyses", [])).toBe(true);
    expect(isBiologistProfile('Médecine générale', ['Biologie médicale'])).toBe(true);
    expect(isBiologistProfile('Pédiatrie', ['Pédiatrie'])).toBe(false);
  });
  it('computes ages', () => {
    expect(ageInYears('2018-06-15', new Date(2026, 5, 14))).toBe(7);
    expect(ageInYears('2018-06-15', new Date(2026, 5, 15))).toBe(8);
  });
});

describe('worklist', () => {
  it('places orders in every step they wait at', () => {
    expect(bucketsOf({ status: 'ORDERED', counts: { pending: 2 } })).toEqual(['toCollect']);
    expect(bucketsOf({ status: 'SAMPLE_COLLECTED', samples: [{ status: 'COLLECTED' }], counts: { pending: 2 } })).toEqual(['toReceive']);
    expect(
      bucketsOf({ status: 'PROCESSING', samples: [{ status: 'RECEIVED' }, { status: 'COLLECTED' }], counts: { pending: 1, entered: 1 } })
    ).toEqual(['toReceive', 'toEnter', 'toValidate']);
    expect(bucketsOf({ status: 'PROCESSING', samples: [{ status: 'REJECTED' }], counts: { pending: 1 } })).toEqual(['toCollect']);
    expect(bucketsOf({ status: 'COMPLETED', samples: [{ status: 'RECEIVED' }], counts: { released: 3 } })).toEqual(['released']);
    expect(bucketsOf({ status: 'CANCELLED', counts: { pending: 1 } })).toEqual([]);
  });
  it('sorts STAT first then oldest', () => {
    const sorted = sortLabWorklist([
      { id: 'a', priority: 'ROUTINE', createdAt: '2026-10-25T08:00:00Z' },
      { id: 'b', priority: 'STAT', createdAt: '2026-10-25T10:00:00Z' },
      { id: 'c', priority: 'ROUTINE', createdAt: '2026-10-25T07:00:00Z' },
    ]);
    expect(sorted.map((o) => o.id)).toEqual(['b', 'c', 'a']);
  });
});
