'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, type MyQueueTicket, type QueueTicket } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { CallDialog } from './queue-dialogs';
import { LevelBadge } from './ticket-card';
import { compareTriage, compareWaiting, formatWait, readStored, ROOM_STORAGE_KEY, writeStored } from '@/lib/queue';

/** Refresh while the tab is visible; pauses in background tabs */
function usePolling(fn: () => void, ms: number) {
  useEffect(() => {
    fn();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fn();
    }, ms);
    return () => clearInterval(timer);
  }, [fn, ms]);
}

/** Nurse dashboard: who is waiting for triage, emergencies first */
export function TriageQueueCard() {
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<QueueTicket[] | null>(null);

  const load = useCallback(() => {
    api
      .getQueue({ status: ['WAITING_TRIAGE'] })
      .then((res) => setTickets(res.tickets.filter((x) => x.status === 'WAITING_TRIAGE').sort(compareTriage)))
      .catch(() => setTickets((prev) => prev ?? []));
  }, []);
  usePolling(load, 15_000);

  if (tickets === null) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('q.dash.triageWaiting')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('q.dash.waitingCount', { count: tickets.length })}</p>
        </div>
        <Link href="/dashboard/queue" className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">{t('q.dash.openTriage')}</Link>
      </div>
      {tickets.length > 0 && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {tickets.slice(0, 4).map((ticket) => (
            <li key={ticket.id} className="py-2 flex items-center gap-3">
              <span className="font-bold tabular-nums text-gray-900 dark:text-white w-14">{ticket.number}</span>
              <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">
                {ticket.patient.firstName} {ticket.patient.lastName}
                <span className="text-gray-500 dark:text-gray-400"> · {ticket.department.name}</span>
              </span>
              {ticket.source === 'EMERGENCY' && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{t('q.source.EMERGENCY')}</span>}
              <span className="text-sm tabular-nums text-gray-600 dark:text-gray-300">{formatWait(ticket.waitMinutes)}</span>
              <Link href={`/dashboard/queue/${ticket.id}/triage`} className="text-sm text-blue-700 dark:text-blue-400 hover:underline">{t('q.action.triage')}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Doctor dashboard: the next patient in the doctor's department, and "call next" */
export function DoctorQueueCard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<QueueTicket[] | null>(null);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    if (!user?.doctorId) return;
    api.getDoctor(user.doctorId).then((d) => setDepartmentId(d.departmentId || '')).catch(() => setDepartmentId(''));
  }, [user?.doctorId]);

  const load = useCallback(() => {
    if (!departmentId) return;
    api
      .getQueue({ departmentId, status: ['WAITING'] })
      .then((res) =>
        setWaiting(
          res.tickets
            .filter((x) => x.status === 'WAITING' && (!x.doctor || x.doctor.id === user?.doctorId))
            .sort(compareWaiting)
        )
      )
      .catch(() => setWaiting((prev) => prev ?? []));
  }, [departmentId, user?.doctorId]);
  usePolling(load, 15_000);

  if (!departmentId || waiting === null) return null;
  const next = waiting[0];

  const callNext = async (room: string) => {
    writeStored(ROOM_STORAGE_KEY, room);
    try {
      const ticket = await api.callNextInQueue({ departmentId, ...(user?.doctorId ? { doctorId: user.doctorId } : {}), room });
      setCalling(false);
      toast.success(t('q.call.done', { number: ticket.number, room }));
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setCalling(false);
        toast.info(t('q.call.none'));
        load();
        return;
      }
      throw err;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('q.dash.queueCard')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('q.dash.waitingCount', { count: waiting.length })}</p>
          {next ? (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('q.dash.nextPatient')} :</span>
              <span className="font-bold tabular-nums text-gray-900 dark:text-white">{next.number}</span>
              <LevelBadge level={next.triageLevel} short />
              <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{next.patient.firstName} {next.patient.lastName}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">· {formatWait(next.waitMinutes)}</span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('q.dash.nobodyWaiting')}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/dashboard/queue" className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700">{t('q.dash.openQueue')}</Link>
          <button type="button" onClick={() => setCalling(true)} disabled={!next} className="px-3 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg text-sm disabled:opacity-50">{t('q.callNext')}</button>
        </div>
      </div>
      {calling && <CallDialog title={t('q.call.nextTitle')} initialRoom={readStored(ROOM_STORAGE_KEY)} onClose={() => setCalling(false)} onConfirm={callNext} />}
    </div>
  );
}

/** Patient portal: the patient's ticket today, if they are in a queue */
export function MyTicketCard() {
  const { t } = useLanguage();
  const [ticket, setTicket] = useState<MyQueueTicket | null>(null);

  const load = useCallback(() => {
    api.getMyQueueTicket().then(setTicket).catch(() => setTicket(null));
  }, []);
  usePolling(load, 15_000);

  if (!ticket) return null;
  const called = ticket.status === 'CALLED';
  const departmentName = typeof ticket.department === 'string' ? ticket.department : ticket.department?.name;
  const waiting = ticket.status === 'WAITING' || ticket.status === 'WAITING_TRIAGE';

  return (
    <div
      className={`rounded-xl p-5 mb-6 border ${
        called ? 'bg-lime-600 border-lime-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
      }`}
      aria-live="polite"
    >
      <div className="flex items-center gap-5">
        <div className={`rounded-xl px-4 py-3 text-center ${called ? 'bg-white/20' : 'bg-lime-50 dark:bg-lime-900/30'}`}>
          <p className={`text-xs uppercase tracking-wide ${called ? 'text-white/90' : 'text-lime-700 dark:text-lime-400'}`}>{t('q.myTicket.title')}</p>
          <p className={`text-3xl font-black tabular-nums ${called ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{ticket.number}</p>
        </div>
        <div className="min-w-0">
          <p className={`text-lg font-semibold ${called ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{t(`q.myTicket.status.${ticket.status}`)}</p>
          {departmentName && <p className={`text-sm ${called ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'}`}>{departmentName}</p>}
          {called && ticket.room && <p className="text-xl font-bold mt-1">{t('q.myTicket.goTo', { room: ticket.room })}</p>}
          {waiting && (
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
              {ticket.position ? t('q.myTicket.position', { position: ticket.position }) : ''}
              {ticket.position && ticket.estimatedWaitMinutes !== null ? ' · ' : ''}
              {ticket.estimatedWaitMinutes !== null ? t('q.myTicket.estimate', { wait: formatWait(ticket.estimatedWaitMinutes) }) : ''}
            </p>
          )}
          {ticket.status === 'NO_SHOW' && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('q.myTicket.absentHint')}</p>}
        </div>
      </div>
    </div>
  );
}
