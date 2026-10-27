'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useNotifications } from '@/context/notification-context';
import { useToast } from '@/components/toast';
import { usePolling } from '@/components/inpatient/ui';
import {
  ArrivalDialog,
  BayDialog,
  BayMap,
  BoardRowCard,
  DispositionDialog,
  DoctorDialog,
  EncounterDrawer,
  StatsStrip,
  StatusDialog,
  TvBoard,
} from '@/components/emergency';
import { ErrorBox, messageOf, selectClass } from '@/components/emergency/ui';
import {
  ACTIVE_STATUSES,
  ED_LEVELS,
  ED_ZONES,
  EdSocketEvents,
  NO_FILTER,
  breachAt,
  clockOffset,
  edActionsFor,
  filterBoard,
  newlyBreaching,
  serverNowMs,
  sortBoard,
  type BoardFilter,
  type BoardRow,
  type EdAction,
  type EdBoard,
  type EdEncounterPatch,
} from '@/lib/emergency';

const TICK_MS = 30_000;
const FALLBACK_REFRESH_MS = 60_000;
/** At most one spoken breach announcement per minute */
const ANNOUNCE_EVERY_MS = 60_000;

type Dialog = { kind: 'arrival' } | { kind: 'bay' | 'doctor' | 'status' | 'disposition'; row: BoardRow } | null;

// useSearchParams needs a Suspense boundary for static rendering
export default function EmergencyPage() {
  return (
    <Suspense fallback={null}>
      <EmergencyBoard />
    </Suspense>
  );
}

function EmergencyBoard() {
  const { t, formatTime } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tv = searchParams.get('tv') === '1';
  const { getSocket, isConnected } = useNotifications();

  const actions = useMemo(() => (tv ? new Set<EdAction>() : edActionsFor(user?.role)), [tv, user?.role]);
  const [board, setBoard] = useState<EdBoard | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [clientNow, setClientNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<BoardFilter>(NO_FILTER);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const seq = useRef(0);
  const announced = useRef<Set<string>>(new Set());
  const lastAnnounceAt = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const next = await api.getEdBoard();
      if (mine !== seq.current) return;
      setBoard(next);
      setOffsetMs(clockOffset(next.now, Date.now()));
      setClientNow(Date.now());
      setError('');
    } catch (err) {
      if (mine === seq.current) setError(messageOf(err, t('ed.loadFailed')));
    }
  }, [t]);

  // First load, then a slow fallback refresh; the socket drives the live updates
  usePolling(load, FALLBACK_REFRESH_MS);

  // Timers tick locally (no refetch): waits and breaches follow the server clock
  useEffect(() => {
    const timer = setInterval(() => setClientNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Live updates: join the board room, refetch (debounced) on every change
  useEffect(() => {
    if (!isConnected) return;
    const socket = getSocket();
    if (!socket) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const subscribe = () => socket.emit(EdSocketEvents.SUBSCRIBE);
    const onChanged = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 300);
    };
    subscribe();
    socket.on('connect', subscribe);
    socket.on(EdSocketEvents.BOARD_CHANGED, onChanged);
    return () => {
      if (timer) clearTimeout(timer);
      socket.off('connect', subscribe);
      socket.off(EdSocketEvents.BOARD_CHANGED, onChanged);
    };
  }, [isConnected, getSocket, load]);

  const nowMs = serverNowMs(clientNow, offsetMs);
  const rows = useMemo(() => sortBoard((board?.encounters ?? []).filter((r) => r.status !== 'DEPARTED')), [board]);
  const visible = useMemo(() => filterBoard(rows, filter), [rows, filter]);
  const breaches = useMemo(() => rows.map((r) => ({ id: r.id, name: `${r.patient.firstName} ${r.patient.lastName}`, breaching: breachAt(r, nowMs).breaching })), [rows, nowMs]);
  const breachingNow = breaches.filter((b) => b.breaching).length;

  // Throttled screen-reader announcement of patients newly over target
  useEffect(() => {
    if (tv) return;
    const fresh = newlyBreaching(breaches, announced.current);
    // Forget patients no longer breaching, so a later breach is announced again
    announced.current = new Set([...announced.current].filter((id) => breaches.some((b) => b.id === id && b.breaching)));
    if (fresh.length === 0 || Date.now() - lastAnnounceAt.current < ANNOUNCE_EVERY_MS) return;
    fresh.forEach((id) => announced.current.add(id));
    lastAnnounceAt.current = Date.now();
    const names = breaches.filter((b) => fresh.includes(b.id)).map((b) => b.name).join(', ');
    setAnnouncement(t('ed.announce.breach', { count: fresh.length, names }));
  }, [breaches, tv, t]);

  const setTv = (on: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (on) params.set('tv', '1');
    else params.delete('tv');
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  };

  const patch = async (row: BoardRow, body: EdEncounterPatch, doneKey: string) => {
    await api.updateEdEncounter(row.id, body);
    toast.success(t(doneKey));
    setDialog(null);
    void load();
  };

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) toast.success(done);
      void load();
    } catch (err) {
      toast.error(t('ed.actionFailed'), messageOf(err, ''));
    }
  };

  const onAction = (action: EdAction, row: BoardRow) => {
    const name = `${row.patient.firstName} ${row.patient.lastName}`;
    switch (action) {
      case 'bay':
        return setDialog({ kind: 'bay', row });
      case 'assignDoctor':
        return setDialog({ kind: 'doctor', row });
      case 'status':
        return setDialog({ kind: 'status', row });
      case 'disposition':
        return setDialog({ kind: 'disposition', row });
      case 'seen':
        return void run(() => api.markEdSeen(row.id), t('ed.done.seen', { name }));
      case 'assignNurse':
        return user ? void run(() => api.updateEdEncounter(row.id, { assignedNurseId: user.id }), t('ed.done.nurse', { name })) : undefined;
      default:
        return undefined;
    }
  };

  const openRow = rows.find((r) => r.id === openId) ?? null;
  const updatedAt = board ? formatTime(board.now) : '—';

  if (tv) {
    return <TvBoard rows={rows} nowMs={nowMs} present={rows.length} updatedAt={updatedAt} onExit={() => setTv(false)} />;
  }

  const filtered = filter.zone !== 'ALL' || filter.status !== 'ALL' || filter.level !== 'ALL';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ed.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('ed.subtitle')}</p>
          <p className="mt-1 text-xs text-ink-muted dark:text-gray-400 flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500'}`} aria-hidden="true" />
            {isConnected ? t('ed.live') : t('ed.offlineHint')} · {t('ed.updatedAt', { time: updatedAt })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTv(true)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
            {t('ed.tvMode')}
          </button>
          {actions.has('arrival') && (
            <button type="button" onClick={() => setDialog({ kind: 'arrival' })} className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold">
              {t('ed.arrival')}
            </button>
          )}
        </div>
      </div>

      <ErrorBox message={error} />
      <p className="sr-only" aria-live="assertive" role="status">{announcement}</p>

      {board && <StatsStrip stats={board.stats} breachingNow={breachingNow} />}

      <div className="flex flex-wrap items-end gap-3">
        <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1" role="group" aria-label={t('ed.view.label')}>
          {(['list', 'map'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${view === v ? 'bg-brand text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              {t(`ed.view.${v}`)}
            </button>
          ))}
        </div>
        {view === 'list' && (
          <>
            <label className="block">
              <span className="block text-xs font-medium text-ink-muted dark:text-gray-400 mb-1">{t('ed.filter.level')}</span>
              <select value={filter.level} onChange={(e) => setFilter((f) => ({ ...f, level: e.target.value as BoardFilter['level'] }))} className={selectClass()}>
                <option value="ALL">{t('ed.filter.all')}</option>
                {[...ED_LEVELS, 'UNTRIAGED' as const].map((l) => <option key={l} value={l}>{t(`ed.level.${l}`)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-ink-muted dark:text-gray-400 mb-1">{t('ed.filter.zone')}</span>
              <select value={filter.zone} onChange={(e) => setFilter((f) => ({ ...f, zone: e.target.value as BoardFilter['zone'] }))} className={selectClass()}>
                <option value="ALL">{t('ed.filter.all')}</option>
                <option value="NONE">{t('ed.filter.noBay')}</option>
                {ED_ZONES.map((z) => <option key={z} value={z}>{t(`ed.zone.${z}`)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-ink-muted dark:text-gray-400 mb-1">{t('ed.filter.status')}</span>
              <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as BoardFilter['status'] }))} className={selectClass()}>
                <option value="ALL">{t('ed.filter.all')}</option>
                {ACTIVE_STATUSES.map((s) => <option key={s} value={s}>{t(`ed.status.${s}`)}</option>)}
              </select>
            </label>
            {filtered && (
              <button type="button" onClick={() => setFilter(NO_FILTER)} className="text-sm font-medium text-brand hover:underline pb-2">{t('ed.filter.reset')}</button>
            )}
          </>
        )}
      </div>

      {!board && !error && <p className="text-sm text-ink-muted">{t('ed.drawer.loading')}</p>}

      {board && view === 'list' && (
        visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center text-sm text-ink-muted dark:text-gray-400">{filtered ? t('ed.emptyFiltered') : t('ed.empty')}</p>
        ) : (
          <ul className="space-y-2" aria-label={t('ed.title')}>
            {visible.map((row) => (
              <BoardRowCard key={row.id} row={row} nowMs={nowMs} actions={actions} onAction={onAction} onOpen={(r) => setOpenId(r.id)} />
            ))}
          </ul>
        )
      )}

      {board && view === 'map' && (
        <BayMap
          bays={board.bays}
          rows={rows}
          nowMs={nowMs}
          canPlace={actions.has('bay')}
          onPlace={(encounterId, bayId) => void run(() => api.updateEdEncounter(encounterId, { bayId }), t('ed.bay.done'))}
          onOpen={(r) => setOpenId(r.id)}
        />
      )}

      {openRow && <EncounterDrawer row={openRow} actions={actions} onAction={onAction} onClose={() => setOpenId(null)} />}

      {dialog?.kind === 'arrival' && (
        <ArrivalDialog
          onClose={() => setDialog(null)}
          onCreated={() => {
            setDialog(null);
            toast.success(t('ed.arr.done'));
            void load();
          }}
        />
      )}
      {dialog?.kind === 'bay' && board && <BayDialog row={dialog.row} bays={board.bays} onClose={() => setDialog(null)} onSave={(bayId) => patch(dialog.row, { bayId }, 'ed.bay.done')} />}
      {dialog?.kind === 'doctor' && <DoctorDialog row={dialog.row} onClose={() => setDialog(null)} onSave={(assignedDoctorId) => patch(dialog.row, { assignedDoctorId }, 'ed.doc.done')} />}
      {dialog?.kind === 'status' && <StatusDialog row={dialog.row} onClose={() => setDialog(null)} onSave={(body) => patch(dialog.row, body, 'ed.st.done')} />}
      {dialog?.kind === 'disposition' && (
        <DispositionDialog
          row={dialog.row}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            setOpenId(null);
            toast.success(t('ed.dispo.done'));
            void load();
          }}
        />
      )}
    </div>
  );
}
