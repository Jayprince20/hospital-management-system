import { describe, it, expect } from 'vitest';
import {
  buildImageIds,
  CT_PRESETS,
  dicomDateToIso,
  dicomFileProblem,
  formatPersonName,
  initialsOf,
  instancePath,
  isMultiFrame,
  layoutCells,
  overlayText,
  presetsFor,
  tagNumber,
  tagString,
  toInstanceSummary,
  toSeriesSummary,
  toStudySummary,
  toUploadResult,
  voiRangeToWindow,
  windowToVoiRange,
  TAG,
  type DicomJsonObject,
} from '@/lib/dicom';
import { canAccessRoute } from '@/lib/rbac';

describe('DICOM JSON tags', () => {
  const obj: DicomJsonObject = {
    [TAG.PatientName]: { vr: 'PN', Value: [{ Alphabetic: 'MEKONGO^SANDRINE' }] },
    [TAG.InstanceNumber]: { vr: 'IS', Value: ['12'] },
    [TAG.Rows]: { vr: 'US', Value: [512] },
    [TAG.SeriesDescription]: { vr: 'LO' },
  };
  it('reads strings, person names and numbers (IS as text or number)', () => {
    expect(tagString(obj, TAG.PatientName)).toBe('MEKONGO^SANDRINE');
    expect(tagNumber(obj, TAG.InstanceNumber)).toBe(12);
    expect(tagNumber(obj, TAG.Rows)).toBe(512);
    expect(tagString(obj, TAG.SeriesDescription)).toBeNull();
    expect(tagString(null, TAG.Rows)).toBeNull();
  });
  it('formats person names and DA dates', () => {
    expect(formatPersonName('MEKONGO^SANDRINE^^^')).toBe('SANDRINE MEKONGO');
    expect(formatPersonName(null)).toBe('');
    expect(dicomDateToIso('20261026')).toBe('2026-10-26');
    expect(dicomDateToIso('2026-10-26')).toBeNull();
  });
});

describe('summaries', () => {
  it('reads the exam endpoint study with its series and identity flags', () => {
    const s = toStudySummary({
      id: 's1',
      studyInstanceUid: '1.2.3',
      numberOfSeries: 2,
      numberOfInstances: 30,
      identityCheck: 'MISMATCH',
      identityConfirmedAt: null,
      series: [
        { seriesInstanceUid: '1.2.3.2', seriesNumber: 2, numberOfInstances: 10 },
        { seriesInstanceUid: '1.2.3.1', seriesNumber: 1, numberOfInstances: 20, description: 'Axial' },
      ],
    })!;
    expect(s.identityConfirmed).toBe(false);
    expect(s.series.map((x) => x.seriesInstanceUid)).toEqual(['1.2.3.1', '1.2.3.2']);
    expect(toStudySummary({ studyInstanceUid: '9', identityCheck: 'MATCH' })!.identityConfirmed).toBe(true);
    expect(toStudySummary({ studyInstanceUid: '9', identityCheck: 'MISMATCH', identityConfirmed: true })!.identityConfirmed).toBe(true);
  });
  it('reads QIDO series and instance objects', () => {
    const series = toSeriesSummary({ [TAG.SeriesInstanceUID]: { vr: 'UI', Value: ['1.2.3.1'] }, [TAG.SeriesNumber]: { vr: 'IS', Value: ['3'] }, [TAG.NumberOfSeriesRelatedInstances]: { vr: 'IS', Value: [4] } })!;
    expect(series).toMatchObject({ seriesInstanceUid: '1.2.3.1', seriesNumber: 3, numberOfInstances: 4 });
    const inst = toInstanceSummary({ [TAG.SOPInstanceUID]: { vr: 'UI', Value: ['1.2.3.1.7'] }, [TAG.NumberOfFrames]: { vr: 'IS', Value: ['25'] } })!;
    expect(inst.numberOfFrames).toBe(25);
    expect(toInstanceSummary({ [TAG.SOPInstanceUID]: { vr: 'UI' } })).toBeNull();
  });
});

describe('image ids', () => {
  it('builds wadouri ids sorted by instance number, one per frame for multi-frame (1-based)', () => {
    const ids = buildImageIds('http://localhost:4000/', '1.2', '1.2.3', [
      { sopInstanceUid: 'b', instanceNumber: 2, rows: null, columns: null, numberOfFrames: 1 },
      { sopInstanceUid: 'a', instanceNumber: 1, rows: null, columns: null, numberOfFrames: 1 },
    ]);
    expect(ids).toEqual([
      'wadouri:http://localhost:4000/api/dicomweb/studies/1.2/series/1.2.3/instances/a',
      'wadouri:http://localhost:4000/api/dicomweb/studies/1.2/series/1.2.3/instances/b',
    ]);
    const frames = buildImageIds('http://x', '1', '2', [{ sopInstanceUid: 'm', instanceNumber: 1, rows: null, columns: null, numberOfFrames: 3 }]);
    expect(frames).toEqual(['wadouri:http://x/api/dicomweb/studies/1/series/2/instances/m?frame=1', 'wadouri:http://x/api/dicomweb/studies/1/series/2/instances/m?frame=2', 'wadouri:http://x/api/dicomweb/studies/1/series/2/instances/m?frame=3']);
    expect(isMultiFrame([{ sopInstanceUid: 'm', instanceNumber: 1, rows: null, columns: null, numberOfFrames: 3 }])).toBe(true);
    expect(instancePath('1', '2', '3')).toBe('/api/dicomweb/studies/1/series/2/instances/3');
  });
});

describe('window / level', () => {
  it('has the CT presets and converts both ways', () => {
    expect(presetsFor('CT').map((p) => [p.key, p.width, p.center])).toEqual([
      ['lung', 1500, -600],
      ['mediastinum', 350, 50],
      ['bone', 2000, 300],
      ['brain', 80, 40],
      ['abdomen', 400, 50],
    ]);
    expect(presetsFor('MR')).toEqual([]);
    expect(windowToVoiRange(400, 50)).toEqual({ lower: -150, upper: 250 });
    expect(voiRangeToWindow({ lower: -150, upper: 250 })).toEqual({ width: 400, center: 50 });
    expect(CT_PRESETS).toHaveLength(5);
  });
});

describe('overlay', () => {
  it('shows initials only, W/L, zoom and position', () => {
    const o = overlayText(
      { patientName: 'Sandrine Mekongo', age: 36, sex: 'FEMALE', studyDate: '2026-10-26', seriesDescription: 'Axial', modality: 'CT', window: { width: 400, center: 50 }, zoom: 1.5, index: 4, total: 20 },
      (iso) => `D(${iso})`
    );
    expect(o.topLeft).toEqual(['SM · 36 a · F']);
    expect(o.topRight).toEqual(['D(2026-10-26)', 'CT · Axial']);
    expect(o.bottomLeft).toEqual(['L 50 · W 400']);
    expect(o.bottomRight).toEqual(['150 %', '5/20']);
    expect(initialsOf('MEKONGO^SANDRINE')).toBe('MS');
  });
});

describe('uploads', () => {
  it('maps the upload result (single study and rejected files)', () => {
    const r = toUploadResult({ stored: 3, duplicates: 1, rejected: [{ fileName: 'x.txt', reason: 'Pas un fichier DICOM' }], studies: [{ studyInstanceUid: '1', identityCheck: 'MATCH' }], study: { studyInstanceUid: '1' } });
    expect(r.stored).toBe(3);
    expect(r.duplicates).toBe(1);
    expect(r.studies).toHaveLength(1);
    expect(r.rejected).toEqual([{ fileName: 'x.txt', reason: 'Pas un fichier DICOM' }]);
    expect(toUploadResult(null)).toMatchObject({ stored: 0, studies: [], rejected: [] });
  });
  it('pre-checks files: DICOM without extension accepted, other types and oversize refused', () => {
    expect(dicomFileProblem({ name: 'IM0001', size: 1000 })).toBeNull();
    expect(dicomFileProblem({ name: 'scan.dcm', size: 1000 })).toBeNull();
    expect(dicomFileProblem({ name: 'study.zip', size: 400 * 1024 * 1024 })).toBeNull();
    expect(dicomFileProblem({ name: 'photo.jpg', size: 1000 })).toBe('type');
    expect(dicomFileProblem({ name: 'scan.dcm', size: 60 * 1024 * 1024 })).toBe('size');
  });
  it('layouts', () => {
    expect([layoutCells('1x1'), layoutCells('1x2'), layoutCells('2x2')]).toEqual([1, 2, 4]);
  });
});

describe('access', () => {
  it('opens the viewer to patients (their API decides) and keeps reconciliation to radiology staff', () => {
    expect(canAccessRoute('PATIENT', '/dashboard/imaging/abc/viewer')).toBe(true);
    expect(canAccessRoute('PATIENT', '/dashboard/imaging/abc')).toBe(false);
    expect(canAccessRoute('LAB_TECH', '/dashboard/imaging/unmatched')).toBe(true);
    expect(canAccessRoute('RECEPTIONIST', '/dashboard/imaging/unmatched')).toBe(false);
    expect(canAccessRoute('DOCTOR', '/dashboard/imaging/modalities')).toBe(false);
    expect(canAccessRoute('ADMIN', '/dashboard/imaging/modalities')).toBe(true);
  });
});
