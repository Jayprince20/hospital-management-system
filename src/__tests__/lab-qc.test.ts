import { describe, it, expect } from 'vitest';
import {
  isQcBlock,
  ljChartData,
  normaliseRule,
  pendingCorrectiveActions,
  previewQcStatus,
  qcStatusMeta,
  qcWarningLines,
  qcZ,
  ruleLabel,
  segmentType,
  sortQcStatus,
  splitRawMessage,
  testStatusMeta,
  toQcSeries,
  type QcResult,
  type QcStatusEntry,
} from '@/lib/lab-qc';
import { canAccessRoute, isNavItemVisible, navigationItems } from '@/lib/rbac';

const run = (over: Partial<QcResult>): QcResult => ({
  id: over.id ?? 'r',
  materialId: 'm1',
  value: 100,
  runAt: '2026-10-20T08:00:00Z',
  source: 'MANUAL',
  z: 0,
  violations: [],
  status: 'ACCEPTED',
  ...over,
});

describe('client z-score preview', () => {
  it('computes z from the target mean and SD, decimal comma accepted', () => {
    expect(qcZ(105, 100, 2.5)).toBe(2);
    expect(qcZ('97,5', '100', '2.5')).toBe(-1);
    expect(qcZ(5.123, 5, 0.1)).toBe(1.23);
  });

  it('gives no z without a usable SD or value', () => {
    expect(qcZ('', 100, 2)).toBeNull();
    expect(qcZ(100, 100, 0)).toBeNull();
    expect(qcZ(100, null, 2)).toBeNull();
    expect(qcZ('abc', 100, 2)).toBeNull();
  });

  it('previews the single-run rules only: 1-2s warns, 1-3s rejects', () => {
    expect(previewQcStatus(1.99)).toEqual({ status: 'ACCEPTED', violations: [] });
    expect(previewQcStatus(-2.4)).toEqual({ status: 'WARNING', violations: ['1-2s'] });
    expect(previewQcStatus(3.01)).toEqual({ status: 'REJECTED', violations: ['1-3s'] });
    expect(previewQcStatus(null)).toBeNull();
  });
});

describe('Westgard rule labels', () => {
  it('normalises server spellings and labels 1-2s as a warning', () => {
    expect(normaliseRule('1_2S')).toBe('1-2s');
    expect(normaliseRule('13s')).toBe('1-3s');
    expect(normaliseRule('R4S')).toBe('R-4s');
    expect(normaliseRule('4_1s')).toBe('4-1s');
    expect(normaliseRule('10X')).toBe('10x');
    expect(ruleLabel('1-2s')).toBe('1-2s (avertissement)');
    expect(ruleLabel('2_2S')).toBe('2-2s');
    expect(ruleLabel('CUSTOM')).toBe('CUSTOM');
  });
});

describe('status → label and colour', () => {
  it('maps run and test statuses', () => {
    expect(qcStatusMeta('ACCEPTED')).toMatchObject({ labelKey: 'qc.status.ACCEPTED', colour: '#16A34A' });
    expect(qcStatusMeta('WARNING').colour).toBe('#D97706');
    expect(qcStatusMeta('REJECTED').className).toContain('red');
    expect(qcStatusMeta(undefined).labelKey).toBe('qc.status.NONE');
    expect(testStatusMeta('IN_CONTROL').labelKey).toBe('qc.testStatus.IN_CONTROL');
    expect(testStatusMeta('OUT_OF_CONTROL').className).toContain('red');
    expect(testStatusMeta('weird').labelKey).toBe('qc.testStatus.NOT_RUN');
  });

  it('lists out-of-control tests first, then not run, then in control', () => {
    const entry = (name: string, status: QcStatusEntry['status']): QcStatusEntry => ({ labTest: { id: name, code: name, name }, status, levels: [] });
    const sorted = sortQcStatus([entry('Urée', 'IN_CONTROL'), entry('Glucose', 'NOT_RUN'), entry('Créatinine', 'OUT_OF_CONTROL'), entry('Albumine', 'IN_CONTROL')]);
    expect(sorted.map((e) => e.labTest.name)).toEqual(['Créatinine', 'Glucose', 'Albumine', 'Urée']);
  });
});

describe('Levey-Jennings chart data', () => {
  const results = [
    run({ id: 'b', runAt: '2026-10-21T08:00:00Z', value: '106.5', z: 2.6, status: 'WARNING', violations: ['1_2S'] }),
    run({ id: 'a', runAt: '2026-10-20T08:00:00Z', value: 100 }),
    run({ id: 'c', runAt: '2026-10-22T08:00:00Z', value: 108, z: NaN, status: 'REJECTED', violations: ['13S', 'R4S'] }),
    run({ id: 'bad', runAt: 'not a date', value: 1 }),
  ];
  const chart = ljChartData(results, { mean: 100, sd: '2.5' });

  it('sorts runs by time, drops unusable ones and colours them by status', () => {
    expect(chart.points.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(chart.points[1]).toMatchObject({ value: 106.5, z: 2.6, colour: '#D97706', violations: ['1-2s'] });
    // z recomputed when the server value is not a number
    expect(chart.points[2]).toMatchObject({ z: 3.2, colour: '#DC2626', violations: ['1-3s', 'R-4s'] });
  });

  it('draws the mean and ±1/2/3 SD lines', () => {
    const byKey = Object.fromEntries(chart.lines.map((l) => [l.key, l.value]));
    expect(byKey).toEqual({ mean: 100, '+1': 102.5, '-1': 97.5, '+2': 105, '-2': 95, '+3': 107.5, '-3': 92.5 });
    expect(chart.lines.find((l) => l.key === '+3')?.tone).toBe('sd3');
  });

  it('covers ±3.5 SD and every point on the y axis, and the run span on the x axis', () => {
    expect(chart.yDomain).toEqual([91.25, 108.75]);
    expect(chart.xDomain).toEqual([Date.parse('2026-10-20T08:00:00Z'), Date.parse('2026-10-22T08:00:00Z')]);
  });

  it('works without targets (no lines) and without points', () => {
    expect(ljChartData(results, {}).lines).toEqual([]);
    const empty = ljChartData([], { mean: 5, sd: 1 });
    expect(empty.points).toEqual([]);
    expect(empty.xDomain).toBeNull();
    expect(empty.yDomain).toEqual([1.5, 8.5]);
  });

  it('accepts the list or the object shape of GET /lab/qc/results', () => {
    expect(toQcSeries([run({})]).results).toHaveLength(1);
    const series = toQcSeries({ material: { targetMean: '5.5', targetSd: '0.2' }, points: [run({})] });
    expect(series).toMatchObject({ mean: 5.5, sd: 0.2 });
    expect(series.results).toHaveLength(1);
    expect(toQcSeries({ mean: 1, sd: 0.1, results: [] })).toMatchObject({ mean: 1, sd: 0.1, results: [] });
    expect(toQcSeries(null)).toEqual({ results: [] });
  });

  it('lists rejected runs still waiting for a corrective action, newest first', () => {
    const list = pendingCorrectiveActions([
      run({ id: 'old', status: 'REJECTED', runAt: '2026-10-01T08:00:00Z' }),
      run({ id: 'done', status: 'REJECTED', correctiveAction: 'Recalibration' }),
      run({ id: 'warn', status: 'WARNING' }),
      run({ id: 'new', status: 'REJECTED', runAt: '2026-10-25T08:00:00Z', correctiveAction: '  ' }),
    ]);
    expect(list.map((r) => r.id)).toEqual(['new', 'old']);
  });
});

describe('raw analyser messages', () => {
  it('splits HL7 segments on CR and shows the MLLP framing by name', () => {
    const hl7 = '\x0bMSH|^~\\&|XN|LAB|HMS|BB|20261026||ORU^R01|1|P|2.5\rPID|1||PAT-1\rOBR|1||1234567890\rOBX|1|NM|WBC||7.2|10*9/L|4-10|N|||F\r\x1c\r';
    const lines = splitRawMessage(hl7);
    expect(lines).toEqual(['<VT>MSH|^~\\&|XN|LAB|HMS|BB|20261026||ORU^R01|1|P|2.5', 'PID|1||PAT-1', 'OBR|1||1234567890', 'OBX|1|NM|WBC||7.2|10*9/L|4-10|N|||F', '<FS>']);
    expect(segmentType(lines[3])).toBe('OBX');
  });

  it('splits ASTM records on CRLF and names STX/ETX/ENQ/EOT', () => {
    const astm = '\x05\r\n\x021H|\\^&|||XN\r\n\x022P|1\r\n\x023R|1|^^^GLU|5.4|mmol/L||N\x0312\r\n\x04';
    const lines = splitRawMessage(astm);
    expect(lines).toEqual(['<ENQ>', '<STX>1H|\\^&|||XN', '<STX>2P|1', '<STX>3R|1|^^^GLU|5.4|mmol/L||N<ETX>12', '<EOT>']);
    expect(segmentType(lines[3])).toBe('R');
    expect(segmentType('<ENQ>')).toBe('');
  });

  it('copes with an empty message', () => {
    expect(splitRawMessage('')).toEqual([]);
  });
});

describe('QC on validation', () => {
  it('turns the different qcWarning shapes into lines', () => {
    expect(qcWarningLines(null)).toEqual([]);
    expect(qcWarningLines('Glucose hors contrôle')).toEqual(['Glucose hors contrôle']);
    expect(qcWarningLines(['A', 'B'])).toEqual(['A', 'B']);
    expect(qcWarningLines({ message: 'CQ non conforme', tests: ['Urée', { name: 'Glucose', status: 'NOT_RUN' }] })).toEqual(['CQ non conforme', 'Urée', 'Glucose — NOT_RUN']);
  });

  it('recognises the blocking 409 only', () => {
    expect(isQcBlock({ status: 409, message: 'Contrôle qualité non conforme' })).toBe(true);
    expect(isQcBlock({ status: 409, message: 'Conflict', data: { qc: 'OUT_OF_CONTROL' } })).toBe(true);
    expect(isQcBlock({ status: 409, message: 'Résultat déjà validé' })).toBe(false);
    expect(isQcBlock({ status: 400, message: 'Contrôle qualité non conforme' })).toBe(false);
    expect(isQcBlock(null)).toBe(false);
  });
});

describe('QC and analyser pages access', () => {
  const nav = (label: string) => navigationItems.find((i) => i.label === label)!;

  it('offers QC to lab technicians, admins and (biologist) doctors; analysers to lab techs and admins', () => {
    expect(isNavItemVisible(nav('Quality Control'), 'LAB_TECH')).toBe(true);
    expect(isNavItemVisible(nav('Quality Control'), 'DOCTOR')).toBe(true);
    expect(nav('Quality Control').biologistsOnly).toBe(true);
    expect(isNavItemVisible(nav('Quality Control'), 'NURSE')).toBe(false);
    expect(isNavItemVisible(nav('Analysers'), 'LAB_TECH')).toBe(true);
    expect(isNavItemVisible(nav('Analysers'), 'DOCTOR')).toBe(false);
  });

  it('guards the routes by role', () => {
    expect(canAccessRoute('LAB_TECH', '/dashboard/laboratory/qc')).toBe(true);
    expect(canAccessRoute('DOCTOR', '/dashboard/laboratory/qc')).toBe(true);
    expect(canAccessRoute('ADMIN', '/dashboard/laboratory/instruments')).toBe(true);
    expect(canAccessRoute('LAB_TECH', '/dashboard/laboratory/instruments')).toBe(true);
    expect(canAccessRoute('DOCTOR', '/dashboard/laboratory/instruments')).toBe(false);
    expect(canAccessRoute('NURSE', '/dashboard/laboratory/qc')).toBe(false);
    expect(canAccessRoute('PHARMACIST', '/dashboard/laboratory/qc')).toBe(false);
  });
});
