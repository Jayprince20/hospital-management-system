/**
 * Offline rules shared by the app and the service worker. The service worker cannot import
 * TypeScript, so public/sw-rules.js carries the same data; a unit test fails if they drift.
 */

const UUID = '[0-9a-fA-F-]{36}';

export const OFFLINE_RULES = {
  version: 1,
  /**
   * POST endpoints that accept an Idempotency-Key and are replayed when the connection is back.
   * bedsideField: body field holding the bedside time, filled at queue time if the form left it empty
   * (null: the form already sends the event date — administeredOn, measuredOn, visitDate).
   */
  writes: [
    { pattern: '^/api/vitals/?$', kind: 'vitals', bedsideField: 'recordedAt', bedsideFormat: 'datetime' },
    { pattern: `^/api/patients/(${UUID})/immunizations/?$`, kind: 'immunization', bedsideField: null, bedsideFormat: 'date' },
    { pattern: `^/api/patients/(${UUID})/growth/?$`, kind: 'growth', bedsideField: null, bedsideFormat: 'date' },
    { pattern: `^/api/pregnancies/(${UUID})/visits/?$`, kind: 'ancVisit', bedsideField: null, bedsideFormat: 'date' },
    { pattern: `^/api/admissions/(${UUID})/administrations/?$`, kind: 'marAdministration', bedsideField: 'recordedAt', bedsideFormat: 'datetime' },
    { pattern: `^/api/admissions/(${UUID})/notes/?$`, kind: 'admissionNote', bedsideField: 'recordedAt', bedsideFormat: 'datetime' },
    { pattern: `^/api/queue/tickets/(${UUID})/triage/?$`, kind: 'triage', bedsideField: 'recordedAt', bedsideFormat: 'datetime' },
    { pattern: '^/api/ed/encounters/?$', kind: 'edArrival', bedsideField: 'arrivedAt', bedsideFormat: 'datetime' },
  ],
  /** Never stored, whoever asks (credentials, files, documents, live calls) */
  neverCache: [
    '^/api/auth(/|$)',
    '/attachments?\\b',
    '/files?\\b',
    '/dicom',
    '\\.pdf$',
    '/pdf/?$',
    '/receipt',
    '^/api/ping/?$',
    '^/api/fhir',
    '^/api/teleconsultations',
    '^/api/dicomweb',
  ],
  /** API GETs kept for staff (network first, cached copy when offline) */
  cacheableGets: [
    '^/api/patients/[^/]+$',
    '^/api/patients/[^/]+/(immunizations|growth|pregnancies|problems)$',
    '^/api/pregnancies/[^/]+$',
    '^/api/admissions(/[^/]+)?$',
    '^/api/admissions/[^/]+/(mar|notes)$',
    '^/api/mar/ward$',
    '^/api/wards(/[^/]+)?$',
    '^/api/beds$',
    '^/api/vitals$',
    '^/api/queue(/.*)?$',
    '^/api/appointments$',
    '^/api/immunizations/due$',
    '^/api/antenatal/caseload$',
    '^/api/ed/board$',
    '^/api/offline/snapshot$',
  ],
} as const;

export type OfflineRules = typeof OFFLINE_RULES;
