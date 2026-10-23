'use client';

import Link from 'next/link';
import type { QueueTicket, TriageLevel } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { formatWait, LEVEL_BADGE, LEVEL_BORDER, type QueueActionName } from '@/lib/queue';

export function LevelBadge({ level, short = false }: { level: TriageLevel | null; short?: boolean }) {
  const { t } = useLanguage();
  if (!level) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">{t('q.untriaged')}</span>;
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${LEVEL_BADGE[level]}`}>
      {t(short ? `q.level.short.${level}` : `q.level.${level}`)}
    </span>
  );
}

const ACTION_STYLE: Partial<Record<QueueActionName, string>> = {
  triage: 'bg-blue-600 hover:bg-blue-700 text-white',
  call: 'bg-lime-600 hover:bg-lime-700 text-white',
  start: 'bg-lime-600 hover:bg-lime-700 text-white',
  complete: 'bg-gray-800 hover:bg-gray-900 text-white dark:bg-gray-600 dark:hover:bg-gray-500',
};

interface TicketCardProps {
  ticket: QueueTicket;
  actions: QueueActionName[];
  busy?: boolean;
  onAction: (action: QueueActionName, ticket: QueueTicket) => void;
  /** Offered on a ticket in consultation: admit the patient (doctors and admin) */
  onAdmit?: (ticket: QueueTicket) => void;
}

export function TicketCard({ ticket, actions, busy, onAction, onAdmit }: TicketCardProps) {
  const { t, formatDateTime, formatTime } = useLanguage();
  const { canAccess } = useAuth();
  const patientHref = `/dashboard/patients/${ticket.patient.id}`;
  const clock = (iso: string) => formatDateTime(iso, { hour: '2-digit', minute: '2-digit' });
  const emergency = ticket.source === 'EMERGENCY';
  const border = ticket.triageLevel
    ? LEVEL_BORDER[ticket.triageLevel]
    : emergency
      ? 'border-l-red-600'
      : 'border-l-gray-300 dark:border-l-gray-600';
  const primary = actions.filter((a) => ACTION_STYLE[a]);
  const secondary = actions.filter((a) => !ACTION_STYLE[a]);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 border-l-4 ${border} p-3 ${
        ticket.overdue ? 'ring-2 ring-red-300 dark:ring-red-800' : ''
      }`}
      data-testid="queue-ticket"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{ticket.number}</span>
            {ticket.status !== 'WAITING_TRIAGE' && <LevelBadge level={ticket.triageLevel} short />}
            {emergency && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                {t('q.source.EMERGENCY')}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {ticket.patient.firstName} {ticket.patient.lastName}
            <span className="text-gray-500 dark:text-gray-400 font-normal">
              {' · '}
              {ticket.patient.patientId}
              {ticket.patient.age !== null && ticket.patient.age !== undefined ? ` · ${t('q.ticket.age', { age: ticket.patient.age })}` : ''}
            </span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-semibold tabular-nums ${ticket.overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {formatWait(ticket.waitMinutes)}
          </p>
          {ticket.overdue && <p className="text-xs font-medium text-red-600 dark:text-red-400">{t('q.ticket.overdue')}</p>}
        </div>
      </div>

      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
        <p>
          {t('q.ticket.arrived', { time: clock(ticket.arrivedAt) })}
          {' · '}
          {t(`q.source.${ticket.source}`)}
          {ticket.appointment ? ` · ${t('q.ticket.appointmentAt', { time: formatTime(ticket.appointment.startTime) })}` : ''}
          {ticket.status === 'WAITING' && ticket.position ? ` · ${t('q.ticket.position', { position: ticket.position })}` : ''}
        </p>
        <p>{ticket.doctor ? t('q.ticket.doctor', { name: ticket.doctor.name }) : t('q.ticket.anyDoctor')}</p>
        {ticket.latestTriage?.chiefComplaint && <p className="text-gray-700 dark:text-gray-300">{t('q.ticket.complaint', { text: ticket.latestTriage.chiefComplaint })}</p>}
        {!ticket.latestTriage && ticket.appointment?.reason && <p className="text-gray-700 dark:text-gray-300">{t('q.ticket.complaint', { text: ticket.appointment.reason })}</p>}
        {ticket.patient.allergies.length > 0 && (
          <p className="text-red-600 dark:text-red-400 font-medium">{t('q.ticket.allergies', { list: ticket.patient.allergies.join(', ') })}</p>
        )}
        {(ticket.status === 'CALLED' || ticket.status === 'IN_SERVICE') && ticket.room && (
          <p className="text-gray-900 dark:text-white font-medium">
            {t('q.ticket.room', { room: ticket.room })}
            {ticket.callCount > 1 ? ` · ${t('q.ticket.calledTimes', { count: ticket.callCount })}` : ''}
            {ticket.status === 'CALLED' ? ` · ${t('q.status.CALLED')}` : ` · ${t('q.status.IN_SERVICE')}`}
          </p>
        )}
        {ticket.notes && <p className="italic">{ticket.notes}</p>}
      </div>

      {actions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {primary.map((action) => (
            <button
              key={action}
              type="button"
              disabled={busy}
              onClick={() => onAction(action, ticket)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md disabled:opacity-50 ${ACTION_STYLE[action]}`}
            >
              {action === 'triage' && ticket.triageLevel ? t('q.action.retriage') : t(`q.action.${action}`)}
            </button>
          ))}
          {secondary.map((action) => (
            <button
              key={action}
              type="button"
              disabled={busy}
              onClick={() => onAction(action, ticket)}
              className={`px-2 py-1 text-xs rounded-md border disabled:opacity-50 ${
                action === 'cancel' || action === 'no-show'
                  ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {t(`q.action.${action}`)}
            </button>
          ))}
          {ticket.status === 'IN_SERVICE' && ticket.appointment && canAccess('/dashboard/consultations/new') && (
            <Link
              href={`/dashboard/consultations/new?appointmentId=${ticket.appointment.id}`}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white"
            >
              {t('q.ticket.openConsultation')}
            </Link>
          )}
          {ticket.status === 'IN_SERVICE' && onAdmit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAdmit(ticket)}
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30 disabled:opacity-50"
            >
              {t('inp.admitPatient')}
            </button>
          )}
          {canAccess(patientHref) && (
            <Link href={patientHref} className="ml-auto text-xs text-lime-700 dark:text-lime-400 hover:underline">
              {t('q.ticket.openPatient')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
