/**
 * Laboratory quality control (Westgard / Levey-Jennings) and analyser links: API types and the
 * pure helpers the pages use. The server evaluates the rules and is authoritative; the client
 * only previews a z-score while the technician types.
 */

// ---------- types (API) ----------

export type InstrumentProtocol = 'HL7_V2' | 'ASTM_E1394' | 'MANUAL';
export type InstrumentConnection = 'HTTP' | 'TCP_MLLP' | 'TCP_ASTM' | 'FILE' | 'NONE';
export type InstrumentMessageStatus = 'PROCESSED' | 'PARTIAL' | 'REJECTED' | 'ERROR';
export type IngestResultStatus = 'STORED' | 'UNMAPPED' | 'UNKNOWN_SAMPLE' | 'NOT_ORDERED' | 'ALREADY_VALIDATED';
export type QcLevel = 'LOW' | 'NORMAL' | 'HIGH';
export type QcStatus = 'ACCEPTED' | 'WARNING' | 'REJECTED';
export type QcTestStatus = 'IN_CONTROL' | 'OUT_OF_CONTROL' | 'NOT_RUN';

export const INSTRUMENT_PROTOCOLS: InstrumentProtocol[] = ['HL7_V2', 'ASTM_E1394', 'MANUAL'];
export const INSTRUMENT_CONNECTIONS: InstrumentConnection[] = ['HTTP', 'TCP_MLLP', 'TCP_ASTM', 'FILE', 'NONE'];
export const MESSAGE_STATUSES: InstrumentMessageStatus[] = ['PROCESSED', 'PARTIAL', 'REJECTED', 'ERROR'];
export const QC_LEVELS: QcLevel[] = ['LOW', 'NORMAL', 'HIGH'];

type Num = number | string;

export interface LabTestRef {
  id: string;
  code: string;
  name: string;
  unit?: string | null;
}

export interface LabInstrument {
  id: string;
  code: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  protocol: InstrumentProtocol;
  connection: InstrumentConnection;
  tcpPort?: number | null;
  active: boolean;
  lastMessageAt?: string | null;
  /** Whether a key exists (the key itself is never sent back) */
  hasApiKey?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LabInstrumentInput {
  code: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  protocol: InstrumentProtocol;
  connection: InstrumentConnection;
  tcpPort?: number | null;
  active?: boolean;
}

export interface InstrumentTestMapping {
  id: string;
  instrumentId: string;
  instrumentCode: string;
  labTestId: string;
  labTest?: LabTestRef | null;
  unitFactor: Num;
  decimals?: number | null;
}

export interface InstrumentTestMappingInput {
  instrumentCode: string;
  labTestId: string;
  unitFactor?: number;
  decimals?: number | null;
}

export interface IngestResult {
  barcode: string;
  instrumentCode: string;
  labTestCode?: string | null;
  value?: string | null;
  unit?: string | null;
  flag?: string | null;
  status: IngestResultStatus;
}

export interface InstrumentMessage {
  id: string;
  instrumentId?: string | null;
  instrument?: { id: string; code: string; name: string } | null;
  receivedAt: string;
  protocol: InstrumentProtocol | string;
  transport: 'HTTP' | 'MLLP' | 'ASTM' | string;
  raw: string;
  status: InstrumentMessageStatus;
  error?: string | null;
  resultsCount: number;
  sampleBarcodes: string[];
  ackSent?: string | boolean | null;
  /** Per-result outcome, when the server keeps it with the message */
  results?: IngestResult[];
}

export interface Paged<T> {
  data: T[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

export interface QcMaterial {
  id: string;
  name: string;
  labTestId: string;
  labTest?: LabTestRef | null;
  level: QcLevel;
  lotNumber: string;
  expiryDate: string;
  targetMean: Num;
  targetSd: Num;
  unit?: string | null;
  instrumentId?: string | null;
  instrument?: { id: string; code: string; name: string } | null;
  active: boolean;
  createdAt?: string;
}

export interface QcMaterialInput {
  name: string;
  labTestId: string;
  level: QcLevel;
  lotNumber: string;
  expiryDate: string;
  targetMean: number;
  targetSd: number;
  unit?: string | null;
  instrumentId?: string | null;
  active?: boolean;
}

export interface QcResult {
  id: string;
  materialId: string;
  material?: QcMaterial | null;
  value: Num;
  runAt: string;
  enteredById?: string | null;
  enteredBy?: { id: string; name: string } | null;
  instrumentId?: string | null;
  source: 'MANUAL' | 'INSTRUMENT' | string;
  z: number;
  violations: string[];
  status: QcStatus;
  comment?: string | null;
  correctiveAction?: string | null;
  reviewedById?: string | null;
  reviewedBy?: { id: string; name: string } | null;
  reviewedAt?: string | null;
  createdAt?: string;
}

export interface QcResultInput {
  materialId: string;
  value: number;
  runAt?: string;
  comment?: string;
  instrumentId?: string;
}

/** What GET /lab/qc/results returns, normalised (list, or the points with the chart lines) */
export interface QcSeries {
  material?: QcMaterial | null;
  mean?: number | null;
  sd?: number | null;
  results: QcResult[];
}

export interface QcStatusLevel {
  materialId: string;
  level: QcLevel;
  lastRunAt?: string | null;
  lastStatus?: QcStatus | null;
  violations?: string[];
}

export interface QcStatusEntry {
  labTest: LabTestRef;
  instrument?: { id: string; code: string; name?: string } | null;
  status: QcTestStatus;
  levels: QcStatusLevel[];
}

/** `qcWarning` on a validation response: a message, a list, or an object */
type QcWarningTest = string | { code?: string; name?: string; status?: string };
/** The validation response's `qcWarning`: the API sends { enforcement, issues: [{ code, name, status }], overrideReason } */
export type QcWarning = string | string[] | { message?: string; enforcement?: string; overrideReason?: string | null; tests?: QcWarningTest[]; issues?: QcWarningTest[] } | null | undefined;

const QC_GATE_STATUS_FR: Record<string, string> = { OUT_OF_CONTROL: 'hors contrôle', NOT_RUN: 'contrôle non passé aujourd’hui', IN_CONTROL: 'sous contrôle' };

// ---------- numbers ----------

export function num(value: Num | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** z = (value − mean) / SD, rounded to 2 decimals; null when it cannot be computed */
export function qcZ(value: Num | null | undefined, mean: Num | null | undefined, sd: Num | null | undefined): number | null {
  const v = num(value);
  const m = num(mean);
  const s = num(sd);
  if (v === null || m === null || s === null || s <= 0) return null;
  return Math.round(((v - m) / s) * 100) / 100;
}

/**
 * What this single run alone would give: 1-3s rejects, 1-2s warns. The server also applies the
 * multi-run rules (2-2s, R-4s, 4-1s, 10x), so it may reject a run this calls a warning.
 */
export function previewQcStatus(z: number | null): { status: QcStatus; violations: string[] } | null {
  if (z === null) return null;
  const a = Math.abs(z);
  if (a > 3) return { status: 'REJECTED', violations: ['1-3s'] };
  if (a > 2) return { status: 'WARNING', violations: ['1-2s'] };
  return { status: 'ACCEPTED', violations: [] };
}

// ---------- labels & colours ----------

/** Westgard rule names as shown to the lab (French clinical usage) */
export const QC_RULE_LABELS: Record<string, string> = {
  '1-2s': '1-2s (avertissement)',
  '1-3s': '1-3s',
  '2-2s': '2-2s',
  'R-4s': 'R-4s',
  '4-1s': '4-1s',
  '10x': '10x',
};

/** Accepts the server's codes in any common spelling (1_2S, 12s, R4S…) */
export function normaliseRule(code: string): string {
  const c = code.trim().toUpperCase().replace(/[_\s]/g, '-');
  if (/^1-?2-?S$/.test(c)) return '1-2s';
  if (/^1-?3-?S$/.test(c)) return '1-3s';
  if (/^2-?2-?S$/.test(c)) return '2-2s';
  if (/^R-?4-?S$/.test(c)) return 'R-4s';
  if (/^4-?1-?S$/.test(c)) return '4-1s';
  if (/^10-?X(-?BAR)?$/.test(c)) return '10x';
  return code;
}

export function ruleLabel(code: string): string {
  const key = normaliseRule(code);
  return QC_RULE_LABELS[key] ?? code;
}

export interface StatusMeta {
  labelKey: string;
  className: string;
  /** Point / dot colour (charts) */
  colour: string;
}

const QC_STATUS_META: Record<QcStatus, StatusMeta> = {
  ACCEPTED: { labelKey: 'qc.status.ACCEPTED', className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', colour: '#16A34A' },
  WARNING: { labelKey: 'qc.status.WARNING', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', colour: '#D97706' },
  REJECTED: { labelKey: 'qc.status.REJECTED', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', colour: '#DC2626' },
};

export function qcStatusMeta(status: string | null | undefined): StatusMeta {
  return QC_STATUS_META[(status ?? '') as QcStatus] ?? { labelKey: 'qc.status.NONE', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', colour: '#9CA3AF' };
}

const TEST_STATUS_META: Record<QcTestStatus, StatusMeta> = {
  IN_CONTROL: { labelKey: 'qc.testStatus.IN_CONTROL', className: 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200', colour: '#16A34A' },
  OUT_OF_CONTROL: { labelKey: 'qc.testStatus.OUT_OF_CONTROL', className: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200', colour: '#DC2626' },
  NOT_RUN: { labelKey: 'qc.testStatus.NOT_RUN', className: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300', colour: '#9CA3AF' },
};

export function testStatusMeta(status: string | null | undefined): StatusMeta {
  return TEST_STATUS_META[(status ?? '') as QcTestStatus] ?? TEST_STATUS_META.NOT_RUN;
}

/** Out of control first (it blocks validation), then not run, then in control; by test name */
export function sortQcStatus(entries: QcStatusEntry[]): QcStatusEntry[] {
  const rank: Record<string, number> = { OUT_OF_CONTROL: 0, NOT_RUN: 1, IN_CONTROL: 2 };
  return [...entries].sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || a.labTest.name.localeCompare(b.labTest.name, 'fr'));
}

const MESSAGE_STATUS_CLASS: Record<InstrumentMessageStatus, string> = {
  PROCESSED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  PARTIAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  ERROR: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

export function messageStatusClass(status: string): string {
  return MESSAGE_STATUS_CLASS[status as InstrumentMessageStatus] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

export function ingestStatusClass(status: string): string {
  if (status === 'STORED') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
  if (status === 'ALREADY_VALIDATED') return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
}

// ---------- Levey-Jennings chart ----------

export interface LjPoint {
  id: string;
  /** Run time in ms (x axis) */
  x: number;
  runAt: string;
  value: number;
  z: number | null;
  status: QcStatus;
  violations: string[];
  colour: string;
  source: string;
  comment?: string | null;
}

export interface LjChart {
  points: LjPoint[];
  mean: number | null;
  sd: number | null;
  /** Reference lines: mean and ±1/2/3 SD */
  lines: Array<{ key: string; label: string; value: number; tone: 'mean' | 'sd1' | 'sd2' | 'sd3' }>;
  /** y domain covering ±3.5 SD and every point */
  yDomain: [number, number] | null;
  /** x domain (ms) */
  xDomain: [number, number] | null;
}

/** Points sorted by run time and the reference lines for one control material */
export function ljChartData(results: QcResult[], target: { mean?: Num | null; sd?: Num | null }): LjChart {
  const mean = num(target.mean ?? null);
  const sd = num(target.sd ?? null);
  const points: LjPoint[] = results
    .map((r): LjPoint | null => {
      const value = num(r.value);
      const x = Date.parse(r.runAt);
      if (value === null || Number.isNaN(x)) return null;
      const z = typeof r.z === 'number' && Number.isFinite(r.z) ? r.z : qcZ(value, mean, sd);
      const status = (r.status ?? 'ACCEPTED') as QcStatus;
      return {
        id: r.id,
        x,
        runAt: r.runAt,
        value,
        z,
        status,
        violations: (r.violations ?? []).map(normaliseRule),
        colour: qcStatusMeta(status).colour,
        source: r.source,
        comment: r.comment ?? null,
      };
    })
    .filter((p): p is LjPoint => p !== null)
    .sort((a, b) => a.x - b.x);

  const lines: LjChart['lines'] = [];
  if (mean !== null && sd !== null && sd > 0) {
    lines.push({ key: 'mean', label: 'Moyenne', value: mean, tone: 'mean' });
    for (const k of [1, 2, 3] as const) {
      lines.push({ key: `+${k}`, label: `+${k} ET`, value: mean + k * sd, tone: `sd${k}` });
      lines.push({ key: `-${k}`, label: `−${k} ET`, value: mean - k * sd, tone: `sd${k}` });
    }
  }

  let yDomain: [number, number] | null = null;
  const values = points.map((p) => p.value);
  if (mean !== null && sd !== null && sd > 0) {
    values.push(mean - 3.5 * sd, mean + 3.5 * sd);
  }
  if (values.length > 0) {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = hi === lo ? Math.abs(hi) * 0.1 || 1 : 0;
    yDomain = [lo - pad, hi + pad];
  }
  const xDomain: [number, number] | null = points.length ? [points[0].x, points[points.length - 1].x] : null;
  return { points, mean, sd, lines, yDomain, xDomain };
}

/** Accepts the different shapes GET /lab/qc/results may return */
export function toQcSeries(raw: unknown): QcSeries {
  if (Array.isArray(raw)) return { results: raw as QcResult[] };
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const results = (o.results ?? o.points ?? o.data ?? []) as QcResult[];
    const material = (o.material ?? null) as QcMaterial | null;
    const mean = num((o.mean ?? material?.targetMean ?? null) as Num | null);
    const sd = num((o.sd ?? material?.targetSd ?? null) as Num | null);
    return { material, mean, sd, results: Array.isArray(results) ? results : [] };
  }
  return { results: [] };
}

/** Rejected runs still waiting for a corrective action, newest first */
export function pendingCorrectiveActions(results: QcResult[]): QcResult[] {
  return results.filter((r) => r.status === 'REJECTED' && !r.correctiveAction?.trim()).sort((a, b) => b.runAt.localeCompare(a.runAt));
}

// ---------- raw messages ----------

const CONTROL_NAMES: Record<number, string> = { 0x02: '<STX>', 0x03: '<ETX>', 0x04: '<EOT>', 0x05: '<ENQ>', 0x06: '<ACK>', 0x0b: '<VT>', 0x15: '<NAK>', 0x17: '<ETB>', 0x1c: '<FS>' };

/**
 * One line per HL7 segment / ASTM record for the raw viewer: split on CR, LF or CRLF, show the
 * framing control characters by name, drop empty lines.
 */
export function splitRawMessage(raw: string): string[] {
  const visible = Array.from(raw ?? '')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code === 0x0d || code === 0x0a) return ch;
      if (CONTROL_NAMES[code]) return CONTROL_NAMES[code];
      if (code < 0x20 && code !== 0x09) return `<0x${code.toString(16).padStart(2, '0')}>`;
      return ch;
    })
    .join('');
  return visible
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.length > 0);
}

/** Segment (HL7: MSH, OBX…) or record type (ASTM: H, P, O, R, L, with an optional frame number) */
export function segmentType(line: string): string {
  const m = /^(?:<STX>)?\d?([A-Z][A-Z0-9]{0,2})[|^]/.exec(line);
  return m ? m[1] : '';
}

// ---------- QC warning on validation ----------

export function qcWarningLines(warning: QcWarning): string[] {
  if (!warning) return [];
  if (typeof warning === 'string') return [warning];
  if (Array.isArray(warning)) return warning.map(String).filter(Boolean);
  const lines: string[] = [];
  if (warning.message) lines.push(warning.message);
  for (const t of [...(warning.issues ?? []), ...(warning.tests ?? [])]) {
    if (typeof t === 'string') lines.push(t);
    else if (t) lines.push([t.name ?? t.code, t.status ? QC_GATE_STATUS_FR[t.status] ?? t.status : null].filter(Boolean).join(' — '));
  }
  return lines;
}

/** The server refused validation because QC is not in control (blocking mode) */
export function isQcBlock(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string; data?: unknown };
  if (e.status !== 409) return false;
  const text = `${e.message ?? ''} ${JSON.stringify(e.data ?? '')}`.toLowerCase();
  return text.includes('contrôle qualité') || text.includes('controle qualite') || text.includes('quality control') || text.includes('qc');
}

/** Copy to the clipboard, with a fallback for non-secure contexts */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
