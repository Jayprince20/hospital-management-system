import { describe, it, expect } from 'vitest';
import { ApiError } from '@/lib/api';
import {
  addDiagnosis,
  canSubmitPrescription,
  diagnosesFromArrays,
  diagnosesPayload,
  freeSlotTimes,
  isBlocked,
  safetyAlertsFromError,
  sortAlerts,
  worstFlag,
  type SafetyAlert,
} from '@/lib/clinical-safety';

const alert = (over: Partial<SafetyAlert>): SafetyAlert => ({
  type: 'INTERACTION',
  severity: 'MODERATE',
  message: 'm',
  detail: '',
  medicationIds: [],
  withCurrentTreatment: false,
  ...over,
});

describe('diagnosis chips ↔ payload', () => {
  it('reads stored parallel arrays, "" meaning uncoded', () => {
    expect(diagnosesFromArrays(['Paludisme', 'Fatigue'], ['B54', ''])).toEqual([
      { label: 'Paludisme', code: 'B54' },
      { label: 'Fatigue', code: null },
    ]);
    expect(diagnosesFromArrays(['Céphalées'], [])).toEqual([{ label: 'Céphalées', code: null }]);
  });

  it('builds the diagnoses payload, trimming and dropping empty labels', () => {
    expect(diagnosesPayload([{ label: ' Paludisme ', code: 'B54', notifiable: false }, { label: ' ', code: null }, { label: 'Toux', code: '' }])).toEqual([
      { label: 'Paludisme', code: 'B54' },
      { label: 'Toux', code: null },
    ]);
  });

  it('does not add the same code or the same uncoded label twice', () => {
    let list = addDiagnosis([], { label: 'Paludisme', code: 'B54' });
    list = addDiagnosis(list, { label: 'Paludisme, sans précision', code: 'B54' });
    list = addDiagnosis(list, { label: 'fatigue', code: null });
    list = addDiagnosis(list, { label: 'Fatigue ', code: null });
    expect(list).toEqual([
      { label: 'Paludisme', code: 'B54' },
      { label: 'fatigue', code: null },
    ]);
  });
});

describe('prescribing safety', () => {
  it('sorts the most severe first, allergies before others at equal severity', () => {
    const sorted = sortAlerts([
      alert({ severity: 'MODERATE', type: 'DUPLICATE' }),
      alert({ severity: 'MAJOR', type: 'INTERACTION' }),
      alert({ severity: 'CONTRAINDICATED', type: 'INTERACTION' }),
      alert({ severity: 'CONTRAINDICATED', type: 'ALLERGY' }),
    ]);
    expect(sorted.map((a) => `${a.severity}:${a.type}`)).toEqual(['CONTRAINDICATED:ALLERGY', 'CONTRAINDICATED:INTERACTION', 'MAJOR:INTERACTION', 'MODERATE:DUPLICATE']);
  });

  it('needs a 10-character justification only when something blocks', () => {
    expect(canSubmitPrescription({ alerts: [alert({})], blocking: false }, null, '')).toBe(true);
    expect(canSubmitPrescription({ alerts: [alert({ severity: 'MAJOR' })], blocking: true }, null, 'trop court')).toBe(true);
    expect(canSubmitPrescription({ alerts: [alert({ severity: 'MAJOR' })], blocking: true }, null, 'court')).toBe(false);
    expect(canSubmitPrescription(null, null, '')).toBe(true);
  });

  it('alerts from a refused save take precedence over the live check', () => {
    expect(isBlocked({ alerts: [], blocking: false }, [alert({ severity: 'CONTRAINDICATED', type: 'ALLERGY' })])).toBe(true);
    expect(isBlocked({ alerts: [], blocking: true }, [alert({ severity: 'MODERATE' })])).toBe(false);
  });

  it('reads the alerts of a 409 safety refusal, and nothing from other errors', () => {
    const alerts = [alert({ severity: 'MAJOR' })];
    expect(safetyAlertsFromError(new ApiError('Prescription safety check failed', 409, { alerts }))).toEqual(alerts);
    expect(safetyAlertsFromError(new ApiError('Conflict', 409))).toBeNull();
    expect(safetyAlertsFromError(new ApiError('Bad', 400, { alerts }))).toBeNull();
    expect(safetyAlertsFromError(new Error('x'))).toBeNull();
  });
});

describe('vital flags and slots', () => {
  it('returns the worst flag of a field', () => {
    const flags = [
      { field: 'temperature', level: 'HIGH' as const, message: 'Fièvre' },
      { field: 'oxygenSaturation', level: 'LOW' as const, message: 'SpO2 basse' },
      { field: 'oxygenSaturation', level: 'CRITICAL_LOW' as const, message: 'SpO2 critique' },
    ];
    expect(worstFlag(flags, 'oxygenSaturation')?.level).toBe('CRITICAL_LOW');
    expect(worstFlag(flags, 'temperature')?.level).toBe('HIGH');
    expect(worstFlag(flags, 'heartRate')).toBeNull();
    expect(worstFlag(undefined, 'heartRate')).toBeNull();
  });

  it('keeps only the free start times', () => {
    expect(freeSlotTimes([{ time: '09:00', available: true }, { time: '09:30', available: false }, { time: '10:00', available: true }])).toEqual(['09:00', '10:00']);
  });
});
