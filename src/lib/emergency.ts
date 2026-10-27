// Emergency department board: types of the /api/ed endpoints and the pure helpers the board uses
// (SATS time targets, breach maths against the server clock, ordering, timers, TV-mode privacy).

export type EdLevel = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';
export type EdZone = 'RESUS' | 'ACUTE' | 'MINOR' | 'OBSERVATION' | 'WAITING';
export type EdArrivalMode = 'WALK_IN' | 'AMBULANCE' | 'POLICE' | 'REFERRAL' | 'OTHER';
export type EdStatus = 'WAITING_TRIAGE' | 'WAITING_DOCTOR' | 'IN_TREATMENT' | 'AWAITING_RESULTS' | 'OBSERVATION' | 'READY_FOR_DISPOSITION' | 'DEPARTED';
export type EdDisposition = 'DISCHARGED' | 'ADMITTED' | 'TRANSFERRED' | 'LEFT_WITHOUT_BEING_SEEN' | 'LEFT_AGAINST_ADVICE' | 'DECEASED';

export const ED_LEVELS: EdLevel[] = ['RED', 'ORANGE', 'YELLOW', 'GREEN'];
export const ED_ZONES: EdZone[] = ['RESUS', 'ACUTE', 'MINOR', 'OBSERVATION', 'WAITING'];
export const ARRIVAL_MODES: EdArrivalMode[] = ['WALK_IN', 'AMBULANCE', 'POLICE', 'REFERRAL', 'OTHER'];
/** Statuses staff can set by hand (DEPARTED only through a disposition) */
export const ACTIVE_STATUSES: EdStatus[] = ['WAITING_TRIAGE', 'WAITING_DOCTOR', 'IN_TREATMENT', 'AWAITING_RESULTS', 'OBSERVATION', 'READY_FOR_DISPOSITION'];
export const DISPOSITIONS: EdDisposition[] = ['DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'LEFT_WITHOUT_BEING_SEEN', 'LEFT_AGAINST_ADVICE', 'DECEASED'];

/** SATS: minutes within which a doctor should see the patient (requires clinical sign-off, mirrors the server) */
export const ED_TARGET_MINUTES: Record<EdLevel, number> = { RED: 0, ORANGE: 10, YELLOW: 60, GREEN: 240 };
/** Not yet triaged: triage within this many minutes of arrival */
export const TRIAGE_WITHIN_MINUTES = 15;

/** Colour bar / badge per level. Yellow uses dark text for contrast; the label is always shown too */
export const ED_LEVEL_STYLE: Record<EdLevel | 'UNTRIAGED', { bar: string; badge: string }> = {
  RED: { bar: 'bg-[#DC2626]', badge: 'bg-[#DC2626] text-white' },
  ORANGE: { bar: 'bg-[#EA580C]', badge: 'bg-[#EA580C] text-white' },
  YELLOW: { bar: 'bg-[#CA8A04]', badge: 'bg-[#CA8A04] text-gray-950' },
  GREEN: { bar: 'bg-[#16A34A]', badge: 'bg-[#16A34A] text-white' },
  UNTRIAGED: { bar: 'bg-gray-400', badge: 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100' },
};

export interface EdPersonRef {
  id: string;
  name: string;
}

export interface BoardRow {
  id: string;
  patient: { id: string; patientId: string; firstName: string; lastName: string; age: number | null; sex: string | null; allergies: string[] };
  arrivedAt: string;
  arrivalMode: EdArrivalMode;
  chiefComplaint: string;
  triageLevel: EdLevel | null;
  triagedAt: string | null;
  waitMinutes: number;
  targetMinutes: number | null;
  breaching: boolean;
  minutesToBreach: number | null;
  bay: { id: string; code: string; zone: EdZone } | null;
  assignedDoctor: EdPersonRef | null;
  assignedNurse: EdPersonRef | null;
  seenAt: string | null;
  status: EdStatus;
  isolation: boolean;
  pendingResults: { lab: number; imaging: number };
  lastVitals: { at: string; tews: number | null } | null;
  ticketNumber: string | null;
  /** Not in the contract's BoardRow: used for the "Trier" link when the server sends it */
  ticketId?: string | null;
}

export interface BayState {
  id: string;
  code: string;
  label: string;
  zone: EdZone;
  occupiedBy: string | null;
}

export interface EdStats {
  present: number;
  waitingTriage: number;
  waitingDoctor: number;
  breaching: number;
  byLevel: Record<EdLevel | 'UNTRIAGED', number>;
  medianDoorToDoctorMinutes: number | null;
  lwbsToday: number;
  admittedToday: number;
  dischargedToday: number;
}

export interface EdBoard {
  now: string;
  encounters: BoardRow[];
  bays: BayState[];
  stats: EdStats;
}

export interface EdEvent {
  id: string;
  at: string;
  type: 'ARRIVED' | 'TRIAGED' | 'BAY_ASSIGNED' | 'DOCTOR_ASSIGNED' | 'SEEN' | 'STATUS' | 'NOTE' | 'DISPOSITION' | string;
  by: EdPersonRef | null;
  data: Record<string, unknown> | null;
}

export interface EdEncounterDetail extends BoardRow {
  timeline: EdEvent[];
  triageAssessments?: Array<{ id: string; level: EdLevel; createdAt: string; chiefComplaint?: string; tewsScore?: number | null; discriminators?: string[] }>;
  vitals?: Array<{ id: string; recordedAt: string; bloodPressure?: string | null; heartRate?: number | null; temperature?: number | null; respiratoryRate?: number | null; oxygenSaturation?: number | null }>;
  orders?: Array<{ id: string; kind: 'LAB' | 'IMAGING' | string; label: string; status: string; createdAt: string }>;
  notes?: string | null;
  disposition?: EdDisposition | null;
}

export interface EdArrivalInput {
  patientId?: string;
  unknownPatient?: { sex: 'MALE' | 'FEMALE' | 'OTHER'; approxAge: number; description: string };
  arrivalMode: EdArrivalMode;
  chiefComplaint: string;
  notes?: string;
}

export interface EdEncounterPatch {
  bayId?: string | null;
  assignedDoctorId?: string | null;
  assignedNurseId?: string | null;
  status?: EdStatus;
  isolation?: boolean;
  notes?: string;
  chiefComplaint?: string;
}

export interface EdDispositionInput {
  disposition: EdDisposition;
  note?: string;
  admission?: { wardId: string; bedId?: string; reason: string };
  transferDestination?: string;
}

export interface EdBayInput {
  code: string;
  label: string;
  zone: EdZone;
  active?: boolean;
  sortOrder?: number;
}

export interface EdDailyStats {
  date: string;
  arrivals: number;
  byLevel: Partial<Record<EdLevel | 'UNTRIAGED', number>>;
  medianDoorToTriageMinutes: number | null;
  medianDoorToDoctorMinutes: number | null;
  medianLengthOfStayMinutes: number | null;
  lwbsRate: number | null;
  admissionRate: number | null;
  breaches: Partial<Record<EdLevel | 'UNTRIAGED', number>>;
}

// ---------- socket ----------

export const EdSocketEvents = {
  SUBSCRIBE: 'ed:subscribe',
  BOARD_CHANGED: 'ed:board-changed',
} as const;

// ---------- time ----------

const MINUTE_MS = 60_000;

/** Client clock minus server clock, so timers follow the server's "now" */
export function clockOffset(serverNow: string, clientNowMs: number): number {
  const server = Date.parse(serverNow);
  return Number.isNaN(server) ? 0 : clientNowMs - server;
}

/** The server's current time, estimated from the client clock and the offset */
export function serverNowMs(clientNowMs: number, offsetMs: number): number {
  return clientNowMs - offsetMs;
}

export function minutesSince(iso: string, nowMs: number): number {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? 0 : Math.max(0, Math.floor((nowMs - at) / MINUTE_MS));
}

/** Target for this row: doctor contact by SATS level, or triage when not yet triaged */
export function targetMinutesFor(level: EdLevel | null): number {
  return level ? ED_TARGET_MINUTES[level] : TRIAGE_WITHIN_MINUTES;
}

export interface Breach {
  waitMinutes: number;
  targetMinutes: number | null;
  breaching: boolean;
  /** Minutes left before the target (0 or negative when breaching); null once seen */
  minutesToBreach: number | null;
}

/**
 * Recomputes wait and breach at `nowMs` (server time) so the board ticks without refetching.
 * Seen patients and departed ones never breach.
 */
export function breachAt(row: Pick<BoardRow, 'arrivedAt' | 'triageLevel' | 'seenAt' | 'status'>, nowMs: number): Breach {
  const waitMinutes = minutesSince(row.arrivedAt, nowMs);
  if (row.status === 'DEPARTED' || (row.seenAt && row.triageLevel)) {
    return { waitMinutes, targetMinutes: null, breaching: false, minutesToBreach: null };
  }
  // Seen before triage (rare): still measure against triage
  const targetMinutes = targetMinutesFor(row.triageLevel);
  const elapsedMs = nowMs - Date.parse(row.arrivedAt);
  const breaching = elapsedMs > targetMinutes * MINUTE_MS;
  return { waitMinutes, targetMinutes, breaching, minutesToBreach: targetMinutes - waitMinutes };
}

/** "12 min", "1 h 05", "26 h 00" */
export function formatWait(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

/** Median minutes for the stats strip */
export function formatMedian(minutes: number | null | undefined): string {
  return minutes === null || minutes === undefined || Number.isNaN(minutes) ? '—' : formatWait(Math.round(minutes));
}

/** 0.123 → "12 %" */
export function formatRate(rate: number | null | undefined): string {
  return rate === null || rate === undefined || Number.isNaN(rate) ? '—' : `${Math.round(rate * 100)} %`;
}

// ---------- ordering ----------

/** RED first, then not-yet-triaged (unknown risk), then ORANGE, YELLOW, GREEN */
export const BOARD_LEVEL_RANK: Record<EdLevel | 'UNTRIAGED', number> = { RED: 0, UNTRIAGED: 1, ORANGE: 2, YELLOW: 3, GREEN: 4 };

export function levelKey(level: EdLevel | null): EdLevel | 'UNTRIAGED' {
  return level ?? 'UNTRIAGED';
}

export function sortBoard<T extends Pick<BoardRow, 'triageLevel' | 'arrivedAt'>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => BOARD_LEVEL_RANK[levelKey(a.triageLevel)] - BOARD_LEVEL_RANK[levelKey(b.triageLevel)] || Date.parse(a.arrivedAt) - Date.parse(b.arrivedAt));
}

// ---------- filters ----------

export interface BoardFilter {
  zone: EdZone | 'ALL' | 'NONE';
  status: EdStatus | 'ALL';
  level: EdLevel | 'UNTRIAGED' | 'ALL';
}

export const NO_FILTER: BoardFilter = { zone: 'ALL', status: 'ALL', level: 'ALL' };

export function filterBoard(rows: BoardRow[], f: BoardFilter): BoardRow[] {
  return rows.filter(
    (r) =>
      (f.zone === 'ALL' || (f.zone === 'NONE' ? !r.bay : r.bay?.zone === f.zone)) &&
      (f.status === 'ALL' || r.status === f.status) &&
      (f.level === 'ALL' || levelKey(r.triageLevel) === f.level)
  );
}

// ---------- privacy (TV mode) ----------

/** "Jean-Pierre Atangana" → "J.-P. A." ; never the full name on a public screen */
export function initialsOf(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const first = (firstName ?? '')
    .trim()
    .split(/-/)
    .filter(Boolean)
    .map((p) => `${p.charAt(0).toUpperCase()}.`)
    .join('-');
  const last = (lastName ?? '').trim().charAt(0).toUpperCase();
  return [first, last ? `${last}.` : ''].filter(Boolean).join(' ') || '?';
}

/** What the TV screen may show for a patient: initials and age/sex only */
export function tvLabel(row: Pick<BoardRow, 'patient'>): string {
  const { firstName, lastName, age, sex } = row.patient;
  const sexLetter = sex === 'MALE' ? 'M' : sex === 'FEMALE' ? 'F' : '';
  const ageText = age === null || age === undefined ? '' : `${age}`;
  const meta = [ageText, sexLetter].filter(Boolean).join(' ');
  return meta ? `${initialsOf(firstName, lastName)} · ${meta}` : initialsOf(firstName, lastName);
}

// ---------- actions ----------

export type EdAction = 'arrival' | 'triage' | 'bay' | 'assignDoctor' | 'assignNurse' | 'seen' | 'status' | 'disposition' | 'openRecord';

/** Which actions a role gets on the board (the API checks again) */
export function edActionsFor(role: string | undefined): Set<EdAction> {
  switch (role) {
    case 'ADMIN':
      return new Set<EdAction>(['arrival', 'triage', 'bay', 'assignDoctor', 'assignNurse', 'status', 'disposition', 'openRecord']);
    case 'DOCTOR':
      return new Set<EdAction>(['arrival', 'triage', 'bay', 'assignDoctor', 'assignNurse', 'seen', 'status', 'disposition', 'openRecord']);
    case 'NURSE':
      return new Set<EdAction>(['arrival', 'triage', 'bay', 'assignDoctor', 'assignNurse', 'status', 'disposition', 'openRecord']);
    case 'RECEPTIONIST':
      return new Set<EdAction>(['arrival']);
    default:
      return new Set<EdAction>();
  }
}

/** "Left without being seen" only makes sense before a doctor saw the patient */
export function dispositionsFor(row: Pick<BoardRow, 'seenAt'>): EdDisposition[] {
  return DISPOSITIONS.filter((d) => d !== 'LEFT_WITHOUT_BEING_SEEN' || !row.seenAt);
}

/** Bays free for this encounter (its current bay stays selectable) */
export function freeBays(bays: BayState[], encounterId: string | null = null): BayState[] {
  return bays.filter((b) => !b.occupiedBy || b.occupiedBy === encounterId);
}

/** Breaching rows not yet announced; used to throttle the aria-live message */
export function newlyBreaching(rows: Array<{ id: string; breaching: boolean }>, announced: ReadonlySet<string>): string[] {
  return rows.filter((r) => r.breaching && !announced.has(r.id)).map((r) => r.id);
}
