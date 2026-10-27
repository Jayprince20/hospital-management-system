import { describe, it, expect } from 'vitest';
import { ALL_SCOPE, FHIR_RESOURCES, buildScopes, emptySelection, fhirUrls, parseScopes, scopeSummary, summarizeCapability } from '@/lib/fhir';
import { canAccessRoute } from '@/lib/rbac';

describe('FHIR client scopes', () => {
  it('builds SMART v2 system scopes per resource, or the single all-resources scope', () => {
    const s = emptySelection();
    s.Patient = { read: true, search: true };
    s.Observation = { read: false, search: true };
    s.Immunization = { read: true, search: false };
    expect(buildScopes(s, false)).toEqual(['system/Patient.rs', 'system/Observation.s', 'system/Immunization.r']);
    expect(buildScopes(s, true)).toEqual([ALL_SCOPE]);
    expect(buildScopes(emptySelection(), false)).toEqual([]);
  });

  it('round-trips through the picker', () => {
    const s = emptySelection();
    s.Encounter = { read: true, search: true };
    s.Condition = { read: true, search: false };
    const back = parseScopes(buildScopes(s, false));
    expect(back.all).toBe(false);
    expect(back.selection.Encounter).toEqual({ read: true, search: true });
    expect(back.selection.Condition).toEqual({ read: true, search: false });
    expect(back.selection.Patient).toEqual({ read: false, search: false });
  });

  it('reads v1 and wildcard forms, ignores unknown resources and junk', () => {
    expect(parseScopes(['system/*.rs']).all).toBe(true);
    expect(parseScopes(['system/*.read']).all).toBe(true);
    const partial = parseScopes(['system/*.r']);
    expect(partial.all).toBe(false);
    expect(FHIR_RESOURCES.every((r) => partial.selection[r].read && !partial.selection[r].search)).toBe(true);
    const v1 = parseScopes(['system/Patient.read', 'system/Observation.cruds', 'system/Unknown.rs', 'openid', 'fhirUser']);
    expect(v1.selection.Patient).toEqual({ read: true, search: true });
    expect(v1.selection.Observation).toEqual({ read: true, search: true });
  });

  it('summarises scopes for the clients table', () => {
    expect(scopeSummary(['system/*.rs'])).toEqual({ all: true, resources: [] });
    expect(scopeSummary(['system/Patient.rs', 'system/Observation.s'])).toEqual({ all: false, resources: ['Patient (rs)', 'Observation (s)'] });
    expect(scopeSummary([])).toEqual({ all: false, resources: [] });
  });
});

describe('CapabilityStatement summary', () => {
  it('keeps version, software, SMART and per-resource interactions sorted', () => {
    const summary = summarizeCapability({
      resourceType: 'CapabilityStatement',
      fhirVersion: '4.0.1',
      software: { name: 'BB Diagnostics HMS', version: '1.0' },
      format: ['application/fhir+json'],
      rest: [
        {
          mode: 'server',
          security: { service: [{ coding: [{ code: 'SMART-on-FHIR' }] }] },
          resource: [
            { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }], searchParam: [{ name: 'name' }, { name: '_id' }, { name: 'birthdate' }], operation: [{ name: 'everything' }] },
            { type: 'Encounter', interaction: [{ code: 'read' }], searchParam: [] },
            { interaction: [{ code: 'read' }] },
          ],
        },
      ],
    });
    expect(summary).toEqual({
      fhirVersion: '4.0.1',
      software: 'BB Diagnostics HMS 1.0',
      formats: ['application/fhir+json'],
      smart: true,
      resources: [
        { type: 'Encounter', interactions: ['read'], searchParams: [], operations: [] },
        { type: 'Patient', interactions: ['read', 'search-type'], searchParams: ['_id', 'birthdate', 'name'], operations: ['$everything'] },
      ],
    });
  });

  it('rejects anything that is not a CapabilityStatement', () => {
    expect(summarizeCapability(null)).toBeNull();
    expect(summarizeCapability({ resourceType: 'OperationOutcome' })).toBeNull();
    expect(summarizeCapability({ resourceType: 'CapabilityStatement' })?.resources).toEqual([]);
  });
});

describe('FHIR settings page', () => {
  it('derives the endpoint URLs from the API origin', () => {
    expect(fhirUrls('http://localhost:4000/')).toEqual({
      base: 'http://localhost:4000/fhir',
      metadata: 'http://localhost:4000/fhir/metadata',
      smart: 'http://localhost:4000/fhir/.well-known/smart-configuration',
      token: 'http://localhost:4000/fhir/auth/token',
    });
  });

  it('is for the administration only (client secrets)', () => {
    expect(canAccessRoute('ADMIN', '/dashboard/settings/fhir')).toBe(true);
    expect(canAccessRoute('DOCTOR', '/dashboard/settings/fhir')).toBe(false);
    expect(canAccessRoute('LAB_TECH', '/dashboard/settings/fhir')).toBe(false);
  });
});
