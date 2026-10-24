import { describe, expect, it } from 'vitest';
import {
  AGE_BANDS,
  csvMappedKeys,
  dhis2FileName,
  flattenReport,
  formatIndicator,
  isDisaggregated,
  mappingToCsv,
  sexTotal,
  type DisaggregatedRow,
  type MonthlyReportData,
} from '@/lib/statistics';
import { canAccessRoute, hasPermission } from '@/lib/rbac';

const zeros = () => Object.fromEntries(['M', 'F'].flatMap((sex) => AGE_BANDS.map((band) => [`${sex}|${band}`, 0])));

const consultations: DisaggregatedRow = {
  key: 'cons.total',
  label: 'Consultations',
  total: 9,
  bySexAge: { ...zeros(), 'M|0-11m': 2, 'M|25-59': 3, 'F|1-4': 4 },
};

const report: MonthlyReportData = {
  period: '2026-03',
  label: 'mars 2026',
  facility: { facilityName: 'BB Diagnostics', category: null, region: 'Centre', healthDistrict: 'Djoungolo', healthArea: null, dhis2OrgUnit: null },
  generatedAt: '2026-04-01T08:00:00.000Z',
  sections: [
    { key: 'consultations', title: 'Consultations externes', rows: [consultations, { key: 'cons.emergency', label: 'Urgences', value: 2 }] },
    { key: 'hospitalisation', title: 'Hospitalisation', rows: [{ key: 'hosp.occupancyRate', label: "Taux d'occupation", value: 61.3, unit: '%' }] },
  ],
};

describe('age × sex grid', () => {
  it('tells split rows from single values', () => {
    expect(isDisaggregated(consultations)).toBe(true);
    expect(isDisaggregated(report.sections[0].rows[1])).toBe(false);
  });

  it('adds up one sex across the age bands', () => {
    expect(sexTotal(consultations, 'M')).toBe(5);
    expect(sexTotal(consultations, 'F')).toBe(4);
  });

  it('flattens with the backend keys, every cell included', () => {
    const flat = flattenReport(report);
    expect(flat['cons.total']).toBe(9);
    expect(flat['cons.total|M|0-11m']).toBe(2);
    expect(flat['cons.total|F|60+']).toBe(0);
    expect(flat['cons.emergency']).toBe(2);
    expect(flat['hosp.occupancyRate']).toBe(61.3);
    expect(Object.keys(flat).filter((k) => k.startsWith('cons.total|'))).toHaveLength(12);
  });

  it('shows units', () => {
    const fmt = (n: number) => String(n);
    expect(formatIndicator({ key: 'a', label: 'a', value: 61.3, unit: '%' }, fmt)).toBe('61.3 %');
    expect(formatIndicator({ key: 'b', label: 'b', value: 4.5, unit: 'jours' }, fmt, 'jours')).toBe('4.5 jours');
    expect(formatIndicator({ key: 'c', label: 'c', value: 7 }, fmt)).toBe('7');
    expect(formatIndicator({ key: 'd', label: 'd', value: 1, unit: 'jours' }, fmt, 'jours', 'jour')).toBe('1 jour');
  });
});

describe('DHIS2 mapping text', () => {
  it('writes one line per key, combo only when set', () => {
    expect(mappingToCsv({ 'cons.total': { dataElement: 'AbCdEfGhIjK' }, 'cons.new|F|1-4': { dataElement: 'BbCdEfGhIjK', categoryOptionCombo: 'CcCdEfGhIjK' } })).toBe(
      'cons.new|F|1-4,BbCdEfGhIjK,CcCdEfGhIjK\ncons.total,AbCdEfGhIjK'
    );
    expect(mappingToCsv(null)).toBe('');
  });

  it('counts mapped keys, skipping a header and blank lines', () => {
    expect(csvMappedKeys('key,dataElement,categoryOptionCombo\ncons.total,AbCdEfGhIjK\n\n hosp.deaths , XyZ12345678 \n')).toEqual(['cons.total', 'hosp.deaths']);
    expect(csvMappedKeys('# commentaire\nindicateur;dataElement\ncons.total;AbCdEfGhIjK\ncons.total;AbCdEfGhIjL')).toEqual(['cons.total']);
  });

  it('names export files after the period', () => {
    expect(dhis2FileName('2026-10', 'json')).toBe('rapport-mensuel-2026-10-dhis2.json');
    expect(dhis2FileName('2026-10', 'csv')).toBe('rapport-mensuel-2026-10-dhis2.csv');
  });
});

describe('access', () => {
  it('admins manage, doctors read, others are kept out', () => {
    expect(hasPermission('ADMIN', 'statistics:manage')).toBe(true);
    expect(hasPermission('DOCTOR', 'statistics:view')).toBe(true);
    expect(hasPermission('DOCTOR', 'statistics:manage')).toBe(false);
    expect(canAccessRoute('DOCTOR', '/dashboard/statistics/2026-10')).toBe(true);
    expect(canAccessRoute('DOCTOR', '/dashboard/statistics/settings')).toBe(false);
    expect(canAccessRoute('ADMIN', '/dashboard/statistics/settings')).toBe(true);
    expect(canAccessRoute('RECEPTIONIST', '/dashboard/statistics')).toBe(false);
    expect(canAccessRoute('NURSE', '/dashboard/statistics')).toBe(false);
  });
});
