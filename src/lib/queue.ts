import type { QueueTicket, QueueTicketStatus, TriageLevel } from '@/lib/api';

/** South African Triage Scale colours, most urgent first */
export const TRIAGE_LEVELS: TriageLevel[] = ['RED', 'ORANGE', 'YELLOW', 'GREEN'];

/** Minutes within which a patient of this colour should be seen */
export const TRIAGE_TARGET_MINUTES: Record<TriageLevel, number> = { RED: 0, ORANGE: 10, YELLOW: 60, GREEN: 240 };

export const LEVEL_PRIORITY: Record<TriageLevel, number> = { RED: 1, ORANGE: 2, YELLOW: 3, GREEN: 4 };

/** Badge classes per colour (light and dark) */
export const LEVEL_BADGE: Record<TriageLevel, string> = {
  RED: 'bg-red-600 text-white',
  ORANGE: 'bg-orange-500 text-white',
  YELLOW: 'bg-yellow-300 text-yellow-950',
  GREEN: 'bg-green-600 text-white',
};

/** Left border on a ticket card per colour */
export const LEVEL_BORDER: Record<TriageLevel, string> = {
  RED: 'border-l-red-600',
  ORANGE: 'border-l-orange-500',
  YELLOW: 'border-l-yellow-400',
  GREEN: 'border-l-green-600',
};

/**
 * Emergency signs a nurse can tick. Any sign forces at least its colour.
 * Codes match the backend (src/services/queue/triage-score.ts); labels live in locales/queue.ts.
 */
export const TRIAGE_DISCRIMINATORS: Array<{ code: string; level: Exclude<TriageLevel, 'GREEN'> }> = [
  { code: 'AIRWAY_COMPROMISED', level: 'RED' },
  { code: 'SEIZURE_ONGOING', level: 'RED' },
  { code: 'SEVERE_BURN_FACE', level: 'RED' },
  { code: 'HYPOGLYCAEMIA_LOW', level: 'RED' },
  { code: 'CARDIAC_ARREST', level: 'RED' },
  { code: 'SEVERE_BREATHING', level: 'ORANGE' },
  { code: 'CHEST_PAIN', level: 'ORANGE' },
  { code: 'STROKE_SIGNS', level: 'ORANGE' },
  { code: 'SEVERE_PAIN', level: 'ORANGE' },
  { code: 'HEAVY_BLEEDING', level: 'ORANGE' },
  { code: 'PREGNANCY_ABDO_PAIN', level: 'ORANGE' },
  { code: 'POISONING', level: 'ORANGE' },
  { code: 'HIGH_ENERGY_TRAUMA', level: 'ORANGE' },
  { code: 'CONFUSION_NEW', level: 'ORANGE' },
  { code: 'SEIZURE_POST', level: 'ORANGE' },
  { code: 'MODERATE_PAIN', level: 'YELLOW' },
  { code: 'PERSISTENT_VOMITING', level: 'YELLOW' },
  { code: 'CLOSED_FRACTURE', level: 'YELLOW' },
  { code: 'ABDOMINAL_PAIN', level: 'YELLOW' },
  { code: 'BLEEDING_CONTROLLED', level: 'YELLOW' },
  { code: 'FEVER_CHILD', level: 'YELLOW' },
];

export const ACTIVE_STATUSES: QueueTicketStatus[] = ['WAITING_TRIAGE', 'WAITING', 'CALLED', 'IN_SERVICE'];

export function isActive(status: QueueTicketStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** "< 1 min", "12 min", "1 h 05", "4 h" */
export function formatWait(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—';
  const m = Math.max(0, Math.floor(minutes));
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')}`;
}

const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

/**
 * Same order as the backend: emergencies first among those waiting for triage, then by arrival;
 * waiting patients by colour, overdue first within a colour, then by arrival; called/in service by call time.
 */
export function compareWaiting(a: QueueTicket, b: QueueTicket): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  return time(a.arrivedAt) - time(b.arrivedAt);
}

export function compareTriage(a: QueueTicket, b: QueueTicket): number {
  const ea = a.source === 'EMERGENCY' ? 0 : 1;
  const eb = b.source === 'EMERGENCY' ? 0 : 1;
  if (ea !== eb) return ea - eb;
  return time(a.arrivedAt) - time(b.arrivedAt);
}

export interface QueueColumns {
  triage: QueueTicket[];
  waiting: QueueTicket[];
  active: QueueTicket[];
  finished: QueueTicket[];
}

export function groupTickets(tickets: QueueTicket[]): QueueColumns {
  return {
    triage: tickets.filter((t) => t.status === 'WAITING_TRIAGE').sort(compareTriage),
    waiting: tickets.filter((t) => t.status === 'WAITING').sort(compareWaiting),
    active: tickets
      .filter((t) => t.status === 'CALLED' || t.status === 'IN_SERVICE')
      .sort((a, b) => time(b.calledAt ?? b.serviceStartedAt) - time(a.calledAt ?? a.serviceStartedAt)),
    finished: tickets
      .filter((t) => !isActive(t.status))
      .sort((a, b) => time(b.completedAt ?? b.calledAt ?? b.arrivedAt) - time(a.completedAt ?? a.calledAt ?? a.arrivedAt)),
  };
}

/** Which actions a role may take on a ticket in its current status */
export type QueueActionName = 'triage' | 'call' | 'recall' | 'start' | 'complete' | 'no-show' | 'cancel' | 'requeue' | 'transfer';

const CLINICAL = ['ADMIN', 'DOCTOR', 'NURSE'];

export function allowedActions(status: QueueTicketStatus, role: string | undefined): QueueActionName[] {
  if (!role || !['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'].includes(role)) return [];
  const clinical = CLINICAL.includes(role);
  const actions: QueueActionName[] = [];
  switch (status) {
    case 'WAITING_TRIAGE':
      if (clinical) actions.push('triage');
      actions.push('no-show', 'cancel', 'transfer');
      break;
    case 'WAITING':
      actions.push('call');
      if (clinical) actions.push('triage', 'start');
      actions.push('no-show', 'cancel', 'transfer');
      break;
    case 'CALLED':
      actions.push('recall');
      if (clinical) actions.push('start');
      actions.push('requeue', 'no-show', 'cancel', 'transfer');
      break;
    case 'IN_SERVICE':
      if (clinical) actions.push('complete', 'transfer');
      actions.push('cancel');
      break;
    case 'NO_SHOW':
      actions.push('requeue');
      break;
    default:
      break;
  }
  return actions;
}

/** The room a user last called patients to, kept per browser */
export const ROOM_STORAGE_KEY = 'queue.room';
export const DEPARTMENT_STORAGE_KEY = 'queue.departmentId';

export function readStored(key: string): string {
  try {
    return typeof window === 'undefined' ? '' : localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function writeStored(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // private mode: not remembered, nothing else breaks
  }
}

/** Reason codes from the triage score: 'TEWS_7', 'LOW_SPO2', 'DISCRIMINATOR_CHEST_PAIN' */
export function parseReason(code: string): { kind: 'tews'; score: number } | { kind: 'spo2' } | { kind: 'discriminator'; code: string } | { kind: 'other'; code: string } {
  const tews = /^TEWS_(\d+)$/.exec(code);
  if (tews) return { kind: 'tews', score: Number(tews[1]) };
  if (code === 'LOW_SPO2') return { kind: 'spo2' };
  if (code.startsWith('DISCRIMINATOR_')) return { kind: 'discriminator', code: code.slice('DISCRIMINATOR_'.length) };
  return { kind: 'other', code };
}
