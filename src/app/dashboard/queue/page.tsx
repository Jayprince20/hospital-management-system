'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type Department, type QueueList, type QueueStats, type QueueTicket, type QueueTicketAction } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-modal';
import { TicketCard } from '@/components/queue/ticket-card';
import { CallDialog, CancelDialog, DisplayLinkDialog, NewTicketDialog, TransferDialog } from '@/components/queue/queue-dialogs';
import { AdmissionDialog } from '@/components/inpatient';
import {
  allowedActions,
  DEPARTMENT_STORAGE_KEY,
  formatWait,
  groupTickets,
  readStored,
  ROOM_STORAGE_KEY,
  writeStored,
  type QueueActionName,
} from '@/lib/queue';

const REFRESH_MS = 10_000;

type Dialog =
  | { kind: 'call'; ticket: QueueTicket }
  | { kind: 'call-next' }
  | { kind: 'cancel'; ticket: QueueTicket }
  | { kind: 'transfer'; ticket: QueueTicket }
  | { kind: 'new' }
  | { kind: 'display' }
  | { kind: 'admit'; ticket: QueueTicket }
  | null;

export default function QueuePage() {
  const { t, formatDateTime } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const role = user?.role;
  const isDoctor = role === 'DOCTOR';
  const canCallNext = role === 'DOCTOR' || role === 'NURSE' || role === 'ADMIN';
  const canShareScreen = role === 'ADMIN' || role === 'RECEPTIONIST';
  // A doctor seeing a patient can admit them straight from the queue
  const canAdmit = role === 'DOCTOR' || role === 'ADMIN';

  const [departments, setDepartments] = useState<Department[]>([]);
  // null until we know which department to show (stored choice, or the doctor's own)
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const [queue, setQueue] = useState<QueueList | null>(null);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [showFinished, setShowFinished] = useState(false);
  const loadSeq = useRef(0);

  useEffect(() => {
    api.getDepartments({ isActive: true, limit: 100 }).then((res) => setDepartments(res.departments)).catch(() => setDepartments([]));
  }, []);

  // Which department to start on: the last one chosen in this browser, else the doctor's own
  useEffect(() => {
    if (!user || departmentId !== null) return;
    const stored = readStored(DEPARTMENT_STORAGE_KEY);
    if (stored || !isDoctor || !user.doctorId) {
      setDepartmentId(stored);
      return;
    }
    api
      .getDoctor(user.doctorId)
      .then((doctor) => setDepartmentId(doctor.departmentId || ''))
      .catch(() => setDepartmentId(''));
  }, [user, isDoctor, departmentId]);

  const load = useCallback(async () => {
    if (departmentId === null) return;
    const seq = ++loadSeq.current;
    const filters = {
      ...(departmentId ? { departmentId } : {}),
      ...(mine && user?.doctorId ? { doctorId: user.doctorId } : {}),
    };
    try {
      const [list, stat] = await Promise.all([
        api.getQueue({ ...filters, includeDone: true }),
        api.getQueueStats(departmentId ? { departmentId } : {}).catch(() => null),
      ]);
      if (seq !== loadSeq.current) return;
      setQueue(list);
      if (stat) setStats(stat);
      setError('');
      setUpdatedAt(new Date());
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(err instanceof Error && err.message ? err.message : t('q.loadFailed'));
    }
  }, [departmentId, mine, user?.doctorId, t]);

  // Silent refresh: the lists stay on screen while new data loads
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const columns = useMemo(() => groupTickets(queue?.tickets ?? []), [queue]);
  const departmentName = departments.find((d) => d.id === departmentId)?.name ?? null;

  const chooseDepartment = (id: string) => {
    writeStored(DEPARTMENT_STORAGE_KEY, id);
    setQueue(null);
    setDepartmentId(id);
  };

  const run = async (ticket: QueueTicket, action: QueueTicketAction, success?: string) => {
    setBusyId(ticket.id);
    try {
      const updated = await api.updateQueueTicket(ticket.id, action);
      setQueue((prev) => (prev ? { ...prev, tickets: prev.tickets.map((x) => (x.id === updated.id ? updated : x)) } : prev));
      if (success) toast.success(success);
      load();
    } catch (err) {
      toast.error(t('q.actionFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  };

  const onAction = async (action: QueueActionName, ticket: QueueTicket) => {
    switch (action) {
      case 'triage':
        router.push(`/dashboard/queue/${ticket.id}/triage`);
        return;
      case 'call':
        setDialog({ kind: 'call', ticket });
        return;
      case 'cancel':
        setDialog({ kind: 'cancel', ticket });
        return;
      case 'transfer':
        setDialog({ kind: 'transfer', ticket });
        return;
      case 'no-show': {
        const ok = await confirm({
          title: t('q.noShow.title', { number: ticket.number }),
          message: t('q.noShow.message'),
          confirmText: t('q.action.no-show'),
          cancelText: t('ins.cancel'),
          variant: 'warning',
        });
        if (ok) await run(ticket, { action: 'no-show' });
        return;
      }
      case 'recall':
        await run(ticket, { action: 'recall' }, t('q.call.done', { number: ticket.number, room: ticket.room ?? '' }));
        return;
      default:
        await run(ticket, { action });
    }
  };

  const callTicket = async (ticket: QueueTicket, room: string) => {
    writeStored(ROOM_STORAGE_KEY, room);
    const updated = await api.updateQueueTicket(ticket.id, { action: 'call', room });
    setDialog(null);
    toast.success(t('q.call.done', { number: updated.number, room }));
    load();
  };

  const callNext = async (room: string) => {
    if (!departmentId) throw new Error(t('q.new.departmentRequired'));
    writeStored(ROOM_STORAGE_KEY, room);
    try {
      const ticket = await api.callNextInQueue({ departmentId, ...(isDoctor && user?.doctorId ? { doctorId: user.doctorId } : {}), room });
      setDialog(null);
      toast.success(t('q.call.done', { number: ticket.number, room }));
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDialog(null);
        toast.info(t('q.call.none'));
        return;
      }
      throw err;
    }
  };

  const actionsFor = (ticket: QueueTicket) => allowedActions(ticket.status, role);

  const statCards = stats
    ? [
        { label: t('q.stats.waitingNow'), value: String(stats.waitingNow), tone: 'text-gray-900 dark:text-white' },
        { label: t('q.stats.longestWait'), value: formatWait(stats.longestWaitMinutes), tone: 'text-gray-900 dark:text-white' },
        { label: t('q.stats.avgWait'), value: formatWait(stats.avgWaitToServiceMinutes), tone: 'text-gray-900 dark:text-white' },
        { label: t('q.stats.overdue'), value: String(stats.overdueNow), tone: stats.overdueNow > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white' },
        { label: t('q.stats.served'), value: String(stats.served), tone: 'text-lime-700 dark:text-lime-400' },
        { label: t('q.stats.noShows'), value: String(stats.noShows), tone: 'text-gray-900 dark:text-white' },
      ]
    : [];

  const column = (title: string, hint: string | null, tickets: QueueTicket[], accent: string) => (
    <section className="bg-gray-100/70 dark:bg-gray-800/50 rounded-xl p-3 flex flex-col min-h-[12rem]">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <div>
          <h2 className={`font-semibold ${accent}`}>{title}</h2>
          {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
        </div>
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 tabular-nums">{tickets.length}</span>
      </div>
      <div className="space-y-2">
        {tickets.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 px-1 py-4 text-center">{t('q.col.empty')}</p>}
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            actions={actionsFor(ticket)}
            busy={busyId === ticket.id}
            onAction={onAction}
            onAdmit={canAdmit ? (tk) => setDialog({ kind: 'admit', ticket: tk }) : undefined}
          />
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('q.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('q.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="queue-department">{t('q.department')}</label>
          <select
            id="queue-department"
            value={departmentId ?? ''}
            onChange={(e) => chooseDepartment(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">{t('q.allDepartments')}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {isDoctor && (
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="rounded border-gray-300 text-lime-600 focus:ring-lime-500" />
              {t('q.mine')}
            </label>
          )}
          {canShareScreen && (
            <button type="button" onClick={() => setDialog({ kind: 'display' })} className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              {t('q.displayScreen')}
            </button>
          )}
          {canCallNext && (
            <button
              type="button"
              onClick={() => setDialog({ kind: 'call-next' })}
              disabled={!departmentId}
              title={!departmentId ? t('q.chooseDepartment') : undefined}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg disabled:opacity-50 dark:bg-gray-600 dark:hover:bg-gray-500"
            >
              {t('q.callNext')}
            </button>
          )}
          <button type="button" onClick={() => setDialog({ kind: 'new' })} className="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg">
            + {t('q.newTicket')}
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}

      {statCards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
              <p className={`text-xl font-bold tabular-nums ${card.tone}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {!queue && !error ? (
        <div className="flex justify-center h-48 items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lime-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {column(t('q.col.triage'), t('q.col.triageHint'), columns.triage, 'text-blue-700 dark:text-blue-400')}
          {column(t('q.col.waiting'), t('q.col.waitingHint'), columns.waiting, 'text-gray-900 dark:text-white')}
          {column(t('q.col.active'), null, columns.active, 'text-lime-700 dark:text-lime-400')}
        </div>
      )}

      {queue && columns.finished.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowFinished((v) => !v)} className="text-sm text-lime-700 dark:text-lime-400 hover:underline">
            {showFinished ? t('q.hideFinished') : t('q.showFinished', { count: columns.finished.length })}
          </button>
          {showFinished && (
            <div className="mt-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {columns.finished.map((ticket) => (
                <div key={ticket.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-white w-16">{ticket.number}</span>
                  <span className="text-gray-900 dark:text-white">{ticket.patient.firstName} {ticket.patient.lastName}</span>
                  <span className="text-gray-500 dark:text-gray-400">{t(`q.status.${ticket.status}`)}</span>
                  {ticket.completedAt && <span className="text-gray-500 dark:text-gray-400">{formatDateTime(ticket.completedAt, { hour: '2-digit', minute: '2-digit' })}</span>}
                  {allowedActions(ticket.status, role).includes('requeue') && (
                    <button type="button" disabled={busyId === ticket.id} onClick={() => run(ticket, { action: 'requeue' })} className="ml-auto text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300">
                      {t('q.action.requeue')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {updatedAt && <p className="text-xs text-gray-400 dark:text-gray-500">{t('q.updatedAt', { time: updatedAt.toLocaleTimeString() })}</p>}

      {dialog?.kind === 'call' && (
        <CallDialog
          title={t('q.call.title', { number: dialog.ticket.number })}
          initialRoom={readStored(ROOM_STORAGE_KEY)}
          onClose={() => setDialog(null)}
          onConfirm={(room) => callTicket(dialog.ticket, room)}
        />
      )}
      {dialog?.kind === 'call-next' && (
        <CallDialog title={t('q.call.nextTitle')} initialRoom={readStored(ROOM_STORAGE_KEY)} onClose={() => setDialog(null)} onConfirm={callNext} />
      )}
      {dialog?.kind === 'cancel' && (
        <CancelDialog
          ticket={dialog.ticket}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            await api.updateQueueTicket(dialog.ticket.id, { action: 'cancel', reason });
            setDialog(null);
            load();
          }}
        />
      )}
      {dialog?.kind === 'transfer' && (
        <TransferDialog
          ticket={dialog.ticket}
          onClose={() => setDialog(null)}
          onConfirm={async (data) => {
            await api.updateQueueTicket(dialog.ticket.id, { action: 'transfer', ...data });
            setDialog(null);
            load();
          }}
        />
      )}
      {dialog?.kind === 'new' && (
        <NewTicketDialog
          defaultDepartmentId={departmentId ?? ''}
          onClose={() => setDialog(null)}
          onCreated={(ticket) => {
            setDialog(null);
            toast.success(t('q.new.created', { number: ticket.number }));
            load();
          }}
        />
      )}
      {dialog?.kind === 'admit' && (
        <AdmissionDialog
          patient={{
            id: dialog.ticket.patient.id,
            patientId: dialog.ticket.patient.patientId,
            firstName: dialog.ticket.patient.firstName,
            lastName: dialog.ticket.patient.lastName,
            gender: dialog.ticket.patient.gender,
            age: dialog.ticket.patient.age,
          }}
          queueTicketId={dialog.ticket.id}
          defaultSource={dialog.ticket.source === 'EMERGENCY' ? 'EMERGENCY' : 'OUTPATIENT'}
          defaultReason={dialog.ticket.latestTriage?.chiefComplaint ?? dialog.ticket.appointment?.reason ?? ''}
          onClose={() => setDialog(null)}
          onAdmitted={(admission) => {
            setDialog(null);
            toast.success(t('inp.admit.done', { number: admission.number }));
            router.push(`/dashboard/admissions/${admission.id}`);
          }}
        />
      )}
      {dialog?.kind === 'display' && <DisplayLinkDialog departmentId={departmentId ?? ''} departmentName={departmentName} onClose={() => setDialog(null)} />}
      <ConfirmDialog />
    </div>
  );
}
