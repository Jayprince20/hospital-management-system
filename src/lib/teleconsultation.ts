// Video teleconsultation: types shared by the pages and the call hook, plus pure helpers (tested)

export type TeleRole = 'DOCTOR' | 'PATIENT';
export type TeleconsultStatus = 'WAITING' | 'IN_CALL' | 'ENDED';
export type TeleconsultOutcome = 'COMPLETED' | 'PHONE_FALLBACK' | 'NO_SHOW' | 'TECHNICAL_FAILURE';
export type TeleconsultEventType = 'connected' | 'reconnect' | 'audio-only' | 'left' | 'quality-poor';
export type TeleAppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export const TELE_OUTCOMES: TeleconsultOutcome[] = ['COMPLETED', 'PHONE_FALLBACK', 'TECHNICAL_FAILURE', 'NO_SHOW'];

export interface TeleconsultSessionSummary {
  status: TeleconsultStatus;
  patientJoinedAt: string | null;
  doctorJoinedAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  outcome: TeleconsultOutcome | null;
}

export interface TelePatientRef {
  id: string;
  name: string;
  patientNumber: string;
  age: number | null;
  gender: string | null;
}

export interface TeleDoctorRef {
  id: string;
  name: string;
  specialty: string | null;
}

/** GET /api/teleconsultations: doctors get `patient`, patients get `doctor` */
export interface TeleconsultListItem {
  appointmentId: string;
  scheduledAt: string;
  patient?: TelePatientRef;
  doctor?: TeleDoctorRef;
  reason: string | null;
  appointmentStatus: TeleAppointmentStatus;
  session: TeleconsultSessionSummary | null;
  patientWaiting: boolean;
}

/** GET /api/teleconsultations/:appointmentId (also returned by POST .../join) */
export interface TeleconsultDetail {
  appointmentId: string;
  role: TeleRole;
  scheduledAt: string;
  endsAt: string;
  joinOpensAt: string;
  joinClosesAt: string;
  canJoin: boolean;
  cannotJoinReason: string | null;
  consentRequired: boolean;
  consentText: string;
  doctor: TeleDoctorRef;
  patient: TelePatientRef & { phone?: string | null };
  reason: string | null;
  session: TeleconsultSessionSummary | null;
  iceServers: RTCIceServer[];
}

// Socket.io events (same names as backend src/socket/events.ts)
export const TeleEvents = {
  JOIN: 'tele:join',
  LEAVE: 'tele:leave',
  SIGNAL: 'tele:signal',
  CHAT: 'tele:chat',
  MEDIA: 'tele:media',
  PEER_JOINED: 'tele:peer-joined',
  PEER_LEFT: 'tele:peer-left',
  WAITING: 'tele:waiting',
  ENDED: 'tele:ended',
} as const;

export type TeleSignalData =
  | { type: 'offer' | 'answer'; sdp: string }
  | { type: 'candidate'; candidate: RTCIceCandidateInit }
  | { type: 'hangup' };

export interface TeleJoinAck {
  ok: boolean;
  peers?: TeleRole[];
  error?: string;
}

export interface TeleChatMessage {
  from: TeleRole;
  name: string;
  text: string;
  at: string;
}

export const CHAT_MAX_LENGTH = 1000;

/** Appointment start from the appointment's date ("2026-10-24" or ISO) and time ("09:30") */
export function appointmentDateTime(date: string, time: string): Date {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h || 0, min || 0);
}

export const JOIN_OPENS_BEFORE_MIN = 15;
export const JOIN_CLOSES_AFTER_MIN = 60;

/** Patient join window: 15 min before the start to 60 min after the planned end (the server decides) */
export function joinWindow(start: Date, end: Date): { opensAt: Date; closesAt: Date } {
  return {
    opensAt: new Date(start.getTime() - JOIN_OPENS_BEFORE_MIN * 60_000),
    closesAt: new Date(end.getTime() + JOIN_CLOSES_AFTER_MIN * 60_000),
  };
}

export type JoinState = 'upcoming' | 'open' | 'past';

export function joinStateAt(window: { opensAt: Date; closesAt: Date }, now: Date = new Date()): JoinState {
  if (now < window.opensAt) return 'upcoming';
  if (now > window.closesAt) return 'past';
  return 'open';
}

const CLOSED_STATUSES: TeleAppointmentStatus[] = ['CANCELLED', 'NO_SHOW', 'COMPLETED'];

/** A video appointment someone may still join (not cancelled, absent, completed or ended) */
export function isJoinable(status: string, session?: TeleconsultSessionSummary | null): boolean {
  return !CLOSED_STATUSES.includes(status as TeleAppointmentStatus) && session?.status !== 'ENDED';
}

/** "2 h 05 min", "12 min", "45 s" */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  if (minutes > 0) return `${minutes + (total % 60 > 0 ? 1 : 0)} min`;
  return `${total} s`;
}

/** "03:07" or "1:02:05" for a running call */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export type CallConnection = 'waiting' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

/**
 * What the participant sees from the peer connection and signalling state.
 * `wasConnected`: the media flowed at least once (then a drop is a reconnection, not a first attempt).
 */
export function mapConnectionState(input: {
  peerPresent: boolean;
  socketConnected: boolean;
  pcState: RTCPeerConnectionState | null;
  wasConnected: boolean;
}): CallConnection {
  const { peerPresent, socketConnected, pcState, wasConnected } = input;
  if (!socketConnected) return wasConnected ? 'reconnecting' : 'connecting';
  if (!peerPresent) return wasConnected ? 'reconnecting' : 'waiting';
  switch (pcState) {
    case 'connected':
      return 'connected';
    case 'failed':
      return wasConnected ? 'reconnecting' : 'failed';
    case 'disconnected':
      return 'reconnecting';
    default:
      return wasConnected ? 'reconnecting' : 'connecting';
  }
}

export type CallQuality = 'good' | 'poor' | 'unknown';

/** Round-trip time (seconds) and share of lost packets (0–1) from WebRTC stats */
export function qualityFromStats(rttSeconds: number | null, lossRatio: number | null): CallQuality {
  if (rttSeconds === null && lossRatio === null) return 'unknown';
  if ((rttSeconds ?? 0) > 0.6 || (lossRatio ?? 0) > 0.08) return 'poor';
  return 'good';
}

/** Lost share between two samples of cumulative inbound counters */
export function lossBetween(prev: { lost: number; received: number } | null, next: { lost: number; received: number }): number | null {
  if (!prev) return null;
  const lost = next.lost - prev.lost;
  const received = next.received - prev.received;
  const total = lost + received;
  return total > 0 ? Math.max(0, lost) / total : null;
}
