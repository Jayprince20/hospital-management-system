'use client';

import { useEffect, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import {
  ED_LEVEL_STYLE,
  ED_LEVELS,
  ED_ZONES,
  breachAt,
  formatMedian,
  levelKey,
  tvLabel,
  type BayState,
  type BoardRow,
  type EdAction,
  type EdEncounterDetail,
  type EdStats,
} from '@/lib/emergency';
import { EdLevelBadge, EdStatusChip, WaitCell, cardClass, smallBtn } from './ui';

const fullName = (row: Pick<BoardRow, 'patient'>) => `${row.patient.firstName} ${row.patient.lastName}`.trim();

// ---------- stats ----------

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: 'alert' }) {
  return (
    <div className={`rounded-2xl px-4 py-3 border ${tone === 'alert' ? 'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800' : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${tone === 'alert' ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>{value}</p>
    </div>
  );
}

export function StatsStrip({ stats, breachingNow }: { stats: EdStats; breachingNow: number }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label={t('ed.stats.present')} value={stats.present} />
        <StatTile label={t('ed.stats.waitingTriage')} value={stats.waitingTriage} />
        <StatTile label={t('ed.stats.waitingDoctor')} value={stats.waitingDoctor} />
        <StatTile label={t('ed.stats.breaching')} value={breachingNow} tone={breachingNow > 0 ? 'alert' : undefined} />
        <StatTile label={t('ed.stats.medianD2D')} value={formatMedian(stats.medianDoorToDoctorMinutes)} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {[...ED_LEVELS, 'UNTRIAGED' as const].map((level) => (
          <span key={level} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ED_LEVEL_STYLE[level].badge}`}>
            {t(`ed.level.${level}`)}
            <span className="tabular-nums">{stats.byLevel?.[level] ?? 0}</span>
          </span>
        ))}
        <span className="text-xs text-ink-muted dark:text-gray-400 ml-1">
          {t('ed.stats.today')} : {t('ed.stats.todayValue', { admitted: stats.admittedToday, discharged: stats.dischargedToday, lwbs: stats.lwbsToday })}
        </span>
      </div>
    </div>
  );
}

// ---------- rows ----------

export interface RowHandlers {
  actions: Set<EdAction>;
  onAction: (action: EdAction, row: BoardRow) => void;
  onOpen: (row: BoardRow) => void;
  /** Drag start for the bay map */
  draggable?: boolean;
}

function RowActions({ row, actions, onAction }: { row: BoardRow; actions: Set<EdAction>; onAction: RowHandlers['onAction'] }) {
  const { t } = useLanguage();
  const btn = (action: EdAction, label: string, primary = false) =>
    actions.has(action) ? (
      <button key={action} type="button" onClick={() => onAction(action, row)} className={primary ? 'px-2.5 py-1 text-xs font-semibold rounded-md bg-brand hover:bg-brand-hover text-white' : smallBtn}>
        {label}
      </button>
    ) : null;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('ed.action.menu', { name: fullName(row) })}>
      {!row.triageLevel && row.ticketId && actions.has('triage') && (
        <Link href={`/dashboard/queue/${row.ticketId}/triage`} className="px-2.5 py-1 text-xs font-semibold rounded-md bg-brand hover:bg-brand-hover text-white">{t('ed.action.triage')}</Link>
      )}
      {row.triageLevel && !row.seenAt && btn('seen', t('ed.action.seen'), true)}
      {btn('bay', t('ed.action.bay'))}
      {btn('assignDoctor', t('ed.action.assignDoctor'))}
      {btn('assignNurse', t('ed.action.assignNurse'))}
      {btn('status', t('ed.action.status'))}
      {btn('disposition', t('ed.action.disposition'))}
      {actions.has('openRecord') && <Link href={`/dashboard/patients/${row.patient.id}`} className={smallBtn}>{t('ed.action.openRecord')}</Link>}
    </div>
  );
}

export function BoardRowCard({ row, nowMs, actions, onAction, onOpen, draggable }: { row: BoardRow; nowMs: number } & RowHandlers) {
  const { t } = useLanguage();
  const breach = breachAt(row, nowMs);
  const key = levelKey(row.triageLevel);
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('text/ed-encounter', row.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <li
      className={`relative overflow-hidden rounded-2xl border bg-white dark:bg-gray-800 ${breach.breaching ? 'border-red-300 dark:border-red-800 ring-1 ring-red-200 dark:ring-red-900' : 'border-gray-100 dark:border-gray-700'}`}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${ED_LEVEL_STYLE[key].bar}`} aria-hidden="true" />
      <div className="pl-5 pr-4 py-3 grid gap-3 lg:grid-cols-[150px_minmax(0,1.6fr)_140px_120px_minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <EdLevelBadge level={row.triageLevel} />
          {row.ticketNumber && <span className="text-xs text-ink-muted dark:text-gray-400">{t('ed.ticket', { number: row.ticketNumber })}</span>}
        </div>
        <div className="min-w-0">
          <button type="button" onClick={() => onOpen(row)} className="text-left font-semibold text-gray-900 dark:text-white hover:underline">
            {fullName(row)}
          </button>
          <p className="text-xs text-ink-muted dark:text-gray-400">
            {row.patient.patientId}
            {row.patient.age !== null && row.patient.age !== undefined && ` · ${t('ed.ageSex', { age: row.patient.age, sex: row.patient.sex ? t(`ed.sex.${row.patient.sex}`) : '—' })}`}
            {` · ${t(`ed.mode.${row.arrivalMode}`)}`}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 truncate" title={row.chiefComplaint}>{row.chiefComplaint}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {row.patient.allergies.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800">
                <span aria-hidden="true">⚠ </span>{t('ed.allergies', { list: row.patient.allergies.join(', ') })}
              </span>
            )}
            {row.isolation && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800">{t('ed.isolation')}</span>}
            {row.pendingResults.lab > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">{t('ed.pendingLab', { count: row.pendingResults.lab })}</span>}
            {row.pendingResults.imaging > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">{t('ed.pendingImaging', { count: row.pendingResults.imaging })}</span>}
            {row.lastVitals?.tews !== null && row.lastVitals?.tews !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] ${row.lastVitals.tews >= 5 ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{t('ed.tews', { score: row.lastVitals.tews })}</span>
            )}
          </div>
        </div>
        <WaitCell breach={breach} triaged={Boolean(row.triageLevel)} />
        <div className="text-sm">
          {row.bay ? (
            <span className="inline-flex flex-col">
              <span className="font-semibold text-gray-900 dark:text-white">{row.bay.code}</span>
              <span className="text-xs text-ink-muted dark:text-gray-400">{t(`ed.zone.${row.bay.zone}`)}</span>
            </span>
          ) : (
            <span className="text-ink-muted dark:text-gray-400">{t('ed.noBay')}</span>
          )}
        </div>
        <div className="text-sm min-w-0">
          <p className={row.assignedDoctor ? 'text-gray-900 dark:text-white truncate' : 'text-ink-muted dark:text-gray-400'}>{row.assignedDoctor ? row.assignedDoctor.name : t('ed.noDoctor')}</p>
          {row.assignedNurse && <p className="text-xs text-ink-muted dark:text-gray-400 truncate">{t('ed.nurse', { name: row.assignedNurse.name })}</p>}
          <div className="mt-1"><EdStatusChip status={row.status} /></div>
        </div>
        <RowActions row={row} actions={actions} onAction={onAction} />
      </div>
    </li>
  );
}

// ---------- bay map ----------

export function BayMap({ bays, rows, nowMs, canPlace, onPlace, onOpen }: { bays: BayState[]; rows: BoardRow[]; nowMs: number; canPlace: boolean; onPlace: (encounterId: string, bayId: string) => void; onOpen: (row: BoardRow) => void }) {
  const { t } = useLanguage();
  const [over, setOver] = useState<string | null>(null);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const unplaced = rows.filter((r) => !r.bay);

  if (bays.length === 0) return <p className="text-sm text-ink-muted dark:text-gray-400">{t('ed.map.noBays')}</p>;

  const drop = (bayId: string) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/ed-encounter');
    if (id) onPlace(id, bayId);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        {canPlace && <p className="text-xs text-ink-muted dark:text-gray-400">{t('ed.map.hint')}</p>}
        {ED_ZONES.map((zone) => {
          const inZone = bays.filter((b) => b.zone === zone);
          if (inZone.length === 0) return null;
          return (
            <section key={zone} aria-label={t(`ed.zone.${zone}`)}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400 mb-2">{t(`ed.zone.${zone}`)}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {inZone.map((bay) => {
                  const row = bay.occupiedBy ? byId.get(bay.occupiedBy) : undefined;
                  const breach = row ? breachAt(row, nowMs) : null;
                  const droppable = canPlace && !bay.occupiedBy;
                  return (
                    <div
                      key={bay.id}
                      onDragOver={droppable ? (e) => { e.preventDefault(); setOver(bay.id); } : undefined}
                      onDragLeave={droppable ? () => setOver(null) : undefined}
                      onDrop={droppable ? drop(bay.id) : undefined}
                      className={`relative min-h-[88px] rounded-2xl border p-3 overflow-hidden ${row ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' : over === bay.id ? 'border-brand border-dashed bg-canvas dark:bg-gray-900' : 'border-dashed border-gray-300 dark:border-gray-600'}`}
                    >
                      {row && <span className={`absolute inset-y-0 left-0 w-1.5 ${ED_LEVEL_STYLE[levelKey(row.triageLevel)].bar}`} aria-hidden="true" />}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{bay.code}</span>
                        {row && breach?.breaching && <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-semibold animate-pulse motion-reduce:animate-none">{t('ed.breach')}</span>}
                      </div>
                      {row ? (
                        <button type="button" onClick={() => onOpen(row)} className="mt-1 block text-left w-full">
                          <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">{fullName(row)}</span>
                          <span className="flex items-center gap-1.5 mt-1"><EdLevelBadge level={row.triageLevel} /></span>
                        </button>
                      ) : (
                        <span className="mt-1 block text-xs text-ink-muted dark:text-gray-400">{over === bay.id ? t('ed.map.dropHere') : t('ed.map.free')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <aside className={`${cardClass} p-3 h-fit`} aria-label={t('ed.map.unplaced')}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('ed.map.unplaced')} ({unplaced.length})</h3>
        <ul className="space-y-2">
          {unplaced.map((row) => (
            <li
              key={row.id}
              draggable={canPlace}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/ed-encounter', row.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              className={`relative overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700 pl-4 pr-2 py-2 ${canPlace ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
              <span className={`absolute inset-y-0 left-0 w-1.5 ${ED_LEVEL_STYLE[levelKey(row.triageLevel)].bar}`} aria-hidden="true" />
              <button type="button" onClick={() => onOpen(row)} className="block text-left w-full">
                <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">{fullName(row)}</span>
                <span className="flex items-center gap-2 mt-0.5"><EdLevelBadge level={row.triageLevel} /><span className="text-xs text-ink-muted tabular-nums">{breachAt(row, nowMs).waitMinutes} min</span></span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

// ---------- detail drawer ----------

export function EncounterDrawer({ row, onClose, actions, onAction }: { row: BoardRow; onClose: () => void } & Pick<RowHandlers, 'actions' | 'onAction'>) {
  const { t, formatDateTime } = useLanguage();
  const [detail, setDetail] = useState<EdEncounterDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api
      .getEdEncounter(row.id)
      .then((d) => live && setDetail(d))
      .catch((err) => live && setError(err instanceof Error ? err.message : t('ed.loadFailed')));
    return () => {
      live = false;
    };
  }, [row.id, row.status, row.triageLevel, row.bay?.id, row.assignedDoctor?.id, row.seenAt, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const time = (iso: string) => formatDateTime(iso, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-label={t('ed.drawer.title')} onClick={onClose}>
      <div className="h-full w-full max-w-lg bg-white dark:bg-gray-800 shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-gray-400">{t('ed.drawer.title')}</p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{fullName(row)}</h2>
            <p className="text-sm text-ink-muted dark:text-gray-400">{t('ed.drawer.arrived', { time: time(row.arrivedAt), mode: t(`ed.mode.${row.arrivalMode}`) })}</p>
            <div className="mt-2 flex flex-wrap gap-2"><EdLevelBadge level={row.triageLevel} /><EdStatusChip status={row.status} /></div>
          </div>
          <button type="button" onClick={onClose} className={smallBtn}>{t('ed.close')}</button>
        </div>
        <div className="p-4 space-y-5">
          <div className="flex flex-wrap gap-1.5">
            {[...actions].filter((a) => a !== 'arrival' && a !== 'triage' && a !== 'openRecord' && (a !== 'seen' || (row.triageLevel && !row.seenAt))).map((a) => (
              <button key={a} type="button" onClick={() => onAction(a, row)} className={smallBtn}>{t(`ed.action.${a}`)}</button>
            ))}
            {actions.has('openRecord') && <Link href={`/dashboard/patients/${row.patient.id}`} className={smallBtn}>{t('ed.action.openRecord')}</Link>}
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200">{row.chiefComplaint}</p>
          {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          {!detail && !error && <p className="text-sm text-ink-muted">{t('ed.drawer.loading')}</p>}
          {detail && (
            <>
              <section>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('ed.drawer.triage')}</h3>
                {(detail.triageAssessments ?? []).length === 0 ? (
                  <p className="text-sm text-ink-muted">{t('ed.drawer.none')}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.triageAssessments!.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <EdLevelBadge level={a.level} />
                        <span className="text-ink-muted tabular-nums">{time(a.createdAt)}</span>
                        {a.tewsScore !== null && a.tewsScore !== undefined && <span>{t('ed.tews', { score: a.tewsScore })}</span>}
                        {a.chiefComplaint && <span className="text-gray-700 dark:text-gray-300">{a.chiefComplaint}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('ed.drawer.vitals')}</h3>
                {(detail.vitals ?? []).length === 0 ? (
                  <p className="text-sm text-ink-muted">{t('ed.drawer.none')}</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {detail.vitals!.map((v) => (
                      <li key={v.id} className="flex flex-wrap gap-x-3 text-gray-800 dark:text-gray-200">
                        <span className="text-ink-muted tabular-nums">{time(v.recordedAt)}</span>
                        {v.bloodPressure && <span>{t('ed.vitals.bp')} {v.bloodPressure}</span>}
                        {v.heartRate != null && <span>{t('ed.vitals.hr')} {v.heartRate}</span>}
                        {v.respiratoryRate != null && <span>{t('ed.vitals.rr')} {v.respiratoryRate}</span>}
                        {v.temperature != null && <span>{t('ed.vitals.temp')} {v.temperature}</span>}
                        {v.oxygenSaturation != null && <span>{t('ed.vitals.spo2')} {v.oxygenSaturation} %</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('ed.drawer.orders')}</h3>
                {(detail.orders ?? []).length === 0 ? (
                  <p className="text-sm text-ink-muted">{t('ed.drawer.none')}</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {detail.orders!.map((o) => (
                      <li key={o.id} className="flex flex-wrap gap-x-3 text-gray-800 dark:text-gray-200">
                        <span className="text-ink-muted tabular-nums">{time(o.createdAt)}</span>
                        <span>{o.label}</span>
                        <span className="text-ink-muted">{o.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('ed.drawer.timeline')}</h3>
                <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-1.5 space-y-3">
                  {[...detail.timeline].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).map((e) => (
                    <li key={e.id} className="ml-4">
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-brand" aria-hidden="true" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{t(`ed.event.${e.type}`)}</p>
                      <p className="text-xs text-ink-muted dark:text-gray-400">{time(e.at)}{e.by ? ` · ${e.by.name}` : ''}</p>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- TV mode ----------

/** Waiting-room / staff-room screen: initials only, large type, no actions */
export function TvBoard({ rows, nowMs, present, updatedAt, onExit }: { rows: BoardRow[]; nowMs: number; present: number; updatedAt: string; onExit: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-[70] bg-gray-950 text-white overflow-y-auto">
      <div className="px-8 py-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">{t('ed.tv.title')}</h1>
          <p className="text-lg text-gray-300">{t('ed.tv.present', { count: present })} · {t('ed.updatedAt', { time: updatedAt })}</p>
        </div>
        <button type="button" onClick={onExit} className="px-4 py-2 rounded-xl border border-white/20 text-sm text-gray-200 hover:bg-white/10 focus:opacity-100 opacity-40 hover:opacity-100">{t('ed.tv.exit')}</button>
      </div>
      <ul className="px-8 pb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => {
          const breach = breachAt(row, nowMs);
          return (
            <li key={row.id} className={`relative overflow-hidden rounded-3xl bg-gray-900 border ${breach.breaching ? 'border-red-500' : 'border-white/10'} p-6 pl-8`}>
              <span className={`absolute inset-y-0 left-0 w-3 ${ED_LEVEL_STYLE[levelKey(row.triageLevel)].bar}`} aria-hidden="true" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold">{tvLabel(row)}</p>
                  <p className="text-lg text-gray-300 mt-1">{row.bay ? `${row.bay.code} · ${t(`ed.zone.${row.bay.zone}`)}` : t('ed.noBay')}</p>
                </div>
                <EdLevelBadge level={row.triageLevel} large />
              </div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <WaitCell breach={breach} triaged={Boolean(row.triageLevel)} large />
                <span className="text-base text-gray-300">{t(`ed.status.${row.status}`)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
