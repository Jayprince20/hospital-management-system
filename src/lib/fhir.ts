/**
 * FHIR R4 administration: system clients (OAuth2 client-credentials) with SMART v2 scopes,
 * and a readable summary of the server's CapabilityStatement.
 */

/** Resources the FHIR API exposes (read + search) */
export const FHIR_RESOURCES = [
  'Patient',
  'Practitioner',
  'Organization',
  'Encounter',
  'Condition',
  'Observation',
  'DiagnosticReport',
  'MedicationRequest',
  'AllergyIntolerance',
  'Immunization',
] as const;

export type FhirResource = (typeof FHIR_RESOURCES)[number];

/** Every resource, read and search */
export const ALL_SCOPE = 'system/*.rs';

export interface FhirClient {
  id: string;
  name: string;
  clientId: string;
  scopes: string[];
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
}

export interface FhirClientCreated {
  client: FhirClient;
  clientSecret: string;
}

export interface FhirUsageEntry {
  at: string;
  clientName: string | null;
  userName: string | null;
  userRole?: string | null;
  resourceType: string;
  count: number;
  path: string;
}

export type ScopeAccess = { read: boolean; search: boolean };
export type ScopeSelection = Record<FhirResource, ScopeAccess>;

export function emptySelection(): ScopeSelection {
  return Object.fromEntries(FHIR_RESOURCES.map((r) => [r, { read: false, search: false }])) as ScopeSelection;
}

/** SMART v2 system scopes from the picker: `system/*.rs` when everything is allowed */
export function buildScopes(selection: ScopeSelection, all: boolean): string[] {
  if (all) return [ALL_SCOPE];
  const scopes: string[] = [];
  for (const resource of FHIR_RESOURCES) {
    const access = selection[resource];
    const perms = `${access.read ? 'r' : ''}${access.search ? 's' : ''}`;
    if (perms) scopes.push(`system/${resource}.${perms}`);
  }
  return scopes;
}

/**
 * Back from stored scopes to the picker. Accepts SMART v2 (`.rs`, `.r`, `.s`, `.cruds`) and
 * v1 (`.read`, `.*`) forms; write permissions are ignored (the API is read-only).
 */
export function parseScopes(scopes: string[]): { all: boolean; selection: ScopeSelection } {
  const selection = emptySelection();
  let all = false;
  for (const raw of scopes) {
    const m = /^(?:system|user|patient)\/([A-Za-z*]+)\.(.+)$/.exec(raw.trim());
    if (!m) continue;
    const [, resource, perms] = m;
    const read = perms === 'read' || perms === '*' || (/^[cruds]+$/.test(perms) && perms.includes('r'));
    const search = perms === 'read' || perms === '*' || (/^[cruds]+$/.test(perms) && perms.includes('s'));
    if (resource === '*') {
      if (read && search) all = true;
      for (const r of FHIR_RESOURCES) selection[r] = { read: selection[r].read || read, search: selection[r].search || search };
      continue;
    }
    if ((FHIR_RESOURCES as readonly string[]).includes(resource)) {
      const key = resource as FhirResource;
      selection[key] = { read: selection[key].read || read, search: selection[key].search || search };
    }
  }
  return { all, selection };
}

/** Short French/English-neutral label of a scope list for the table ("Tout (lecture + recherche)" is translated by the caller) */
export function scopeSummary(scopes: string[]): { all: boolean; resources: string[] } {
  const { all, selection } = parseScopes(scopes);
  if (all) return { all: true, resources: [] };
  return {
    all: false,
    resources: FHIR_RESOURCES.filter((r) => selection[r].read || selection[r].search).map((r) => {
      const a = selection[r];
      return `${r} (${a.read ? 'r' : ''}${a.search ? 's' : ''})`;
    }),
  };
}

// ---------- CapabilityStatement ----------

interface CapabilityResource {
  type?: string;
  interaction?: Array<{ code?: string }>;
  searchParam?: Array<{ name?: string; type?: string }>;
  operation?: Array<{ name?: string }>;
}

export interface CapabilityStatementLike {
  resourceType?: string;
  fhirVersion?: string;
  software?: { name?: string; version?: string };
  implementation?: { description?: string; url?: string };
  format?: string[];
  rest?: Array<{ mode?: string; resource?: CapabilityResource[]; security?: { service?: Array<{ coding?: Array<{ code?: string }>; text?: string }> } }>;
}

export interface CapabilitySummary {
  fhirVersion: string | null;
  software: string | null;
  formats: string[];
  smart: boolean;
  resources: Array<{ type: string; interactions: string[]; searchParams: string[]; operations: string[] }>;
}

/** What the admin needs to see from GET /fhir/metadata: version, resources, interactions, search params */
export function summarizeCapability(cs: CapabilityStatementLike | null | undefined): CapabilitySummary | null {
  if (!cs || cs.resourceType !== 'CapabilityStatement') return null;
  const server = cs.rest?.find((r) => r.mode === 'server') ?? cs.rest?.[0];
  const resources = (server?.resource ?? [])
    .filter((r): r is CapabilityResource & { type: string } => Boolean(r.type))
    .map((r) => ({
      type: r.type,
      interactions: (r.interaction ?? []).map((i) => i.code ?? '').filter(Boolean),
      searchParams: (r.searchParam ?? []).map((p) => p.name ?? '').filter(Boolean).sort(),
      operations: (r.operation ?? []).map((o) => (o.name ? `$${o.name.replace(/^\$/, '')}` : '')).filter(Boolean),
    }))
    .sort((a, b) => a.type.localeCompare(b.type));
  const smart = (server?.security?.service ?? []).some((s) => (s.coding ?? []).some((c) => c.code === 'SMART-on-FHIR') || /smart/i.test(s.text ?? ''));
  const software = cs.software?.name ? [cs.software.name, cs.software.version].filter(Boolean).join(' ') : null;
  return { fhirVersion: cs.fhirVersion ?? null, software, formats: cs.format ?? [], smart, resources };
}

/** FHIR base and SMART discovery URLs from the API origin */
export function fhirUrls(apiOrigin: string): { base: string; metadata: string; smart: string; token: string } {
  const base = `${apiOrigin.replace(/\/+$/, '')}/fhir`;
  return { base, metadata: `${base}/metadata`, smart: `${base}/.well-known/smart-configuration`, token: `${base}/auth/token` };
}
