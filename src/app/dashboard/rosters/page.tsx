'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type RosterShift, type RosterView, type RosterWarning } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';
import { addMonths, cellKey, isManagerOf, monthDays, monthOf, warningKey } from '@/lib/rosters';
import {
  CopyWeekDialog,
  PeriodBadge,
  RosterGrid,
  ShiftCellDialog,
  ShiftChip,
  myDepartment,
  rememberValue,
  rememberedValue,
  useDayLabel,
  useRosterDepartments,
  useShiftTypes,
} from '@/components/rosters';
import { cardClass, inputClass, messageOf, primaryBtn, smallBtn } from '@/components/rosters/ui';

const DEPT_KEY = 'hms.rosters.department';

export default function RostersPage() {
  const { user } = useAuth();
  const { t, formatDate } = useLanguage();
  const toast = useToast();
  const dayLabel = useDayLabel();
  const { departments } = useRosterDepartments();
  const { types: shiftTypes } = useShiftTypes();

  const [departmentId, setDepartmentId] = useState('');
  const [month, setMonth] = useState(monthOf());
  const [view, setView] = useState<RosterView | null>(null);
  const [loadError, setLoadError] = useState('');
  const [cell, setCell] = useState<{ userId: string; date: string; shifts: RosterShift[] } | null>(null);
  const [paintTypeId, setPaintTypeId] = useState<string | null>(null);
  const [painting, setPainting] = useState(false);
  const [focusedCell, setFocusedCell] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Start on the remembered department, else my own, else the first one
  useEffect(() => {
    if (!departments || departments.length === 0 || departmentId) return;
    const remembered = rememberedValue(DEPT_KEY);
    const start = departments.find((d) => d.id === remembered) ?? myDepartment(departments, user?.id) ?? departments[0];
    setDepartmentId(start.id);
  }, [departments, departmentId, user?.id]);

  const department = departments?.find((d) => d.id === departmentId) ?? null;
  const isManager = isManagerOf(user, department);

  const load = useCallback(() => {
    if (!departmentId) return;
    api
      .getRoster(departmentId, month)
      .then((v) => {
        setView(v);
        setLoadError('');
      })
      .catch((err) => {
        setView(null);
        setLoadError(messageOf(err, t('ros.loadFailed')));
      });
  }, [departmentId, month, t]);

  useEffect(() => {
    load();
  }, [load]);

  const days = useMemo(() => monthDays(month, view?.holidays ?? []), [month, view?.holidays]);
  const status = view?.period?.status ?? 'DRAFT';
  const draftHidden = !isManager && status !== 'PUBLISHED';

  const showWarnings = (warnings: Array<{ type: string; message?: string }>) => {
    if (warnings.length === 0) return;
    toast.warning(t('ros.warningsTitle'), warnings.map((w) => t(warningKey(w.type))).join(' · '));
  };

  const onCellClick = async (userId: string, date: string, shifts: RosterShift[]) => {
    if (!isManager) return;
    if (!paintTypeId) {
      setCell({ userId, date, shifts });
      return;
    }
    // Paint mode: set this type on the cell; clicking the same type again clears it
    if (painting) return;
    setPainting(true);
    try {
      const same = shifts.find((s) => s.shiftType.id === paintTypeId);
      if (same) {
        await api.deleteRosterShift(same.id);
      } else if (shifts[0]) {
        await api.updateRosterShift(shifts[0].id, { shiftTypeId: paintTypeId });
      } else {
        const res = await api.createRosterShift({ userId, departmentId, date, shiftTypeId: paintTypeId });
        showWarnings(res.warnings);
      }
      load();
    } catch (err) {
      toast.error(t('ros.actionFailed'), messageOf(err, ''));
    } finally {
      setPainting(false);
    }
  };

  const focusWarning = (w: RosterWarning) => {
    if (!w.userId) return;
    const key = cellKey(w.userId, w.date.slice(0, 10));
    setFocusedCell(key);
    document.getElementById(`cell-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await api.publishRoster(departmentId, month);
      toast.success(t('ros.publish.done'));
      showWarnings(res.warnings);
      setPublishOpen(false);
      load();
    } catch (err) {
      toast.error(t('ros.actionFailed'), messageOf(err, ''));
    } finally {
      setPublishing(false);
    }
  };

  const exportAs = async (format: 'pdf' | 'csv') => {
    try {
      await api.exportRoster(departmentId, month, format);
    } catch (err) {
      toast.error(t('ros.exportFailed'), messageOf(err, ''));
    }
  };

  const monthLabel = formatDate(`${month}-01T12:00:00`, { month: 'long', year: 'numeric' });
  const cellPerson = cell ? view?.staff.find((s) => s.userId === cell.userId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ros.planning.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('ros.planning.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/my-schedule" className={smallBtn}>{t('ros.nav.mySchedule')}</Link>
          <Link href="/dashboard/leave" className={smallBtn}>{t('ros.nav.leave')}</Link>
          <Link href="/dashboard/on-call" className={smallBtn}>{t('ros.nav.onCall')}</Link>
          {user?.role === 'ADMIN' && <Link href="/dashboard/rosters/settings" className={smallBtn}>{t('ros.nav.settings')}</Link>}
        </div>
      </div>

      <div className={`${cardClass} p-4 flex flex-wrap items-end gap-4`}>
        <div className="min-w-[14rem]">
          <label htmlFor="ros-dept" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ros.department')}</label>
          <select
            id="ros-dept"
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              rememberValue(DEPT_KEY, e.target.value);
              setFocusedCell(null);
            }}
            className={inputClass}
          >
            {(departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ros.month')}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMonth(addMonths(month, -1))} className={smallBtn} aria-label={t('ros.prevMonth')}>‹</button>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={`${inputClass} w-44`} aria-label={t('ros.month')} />
            <button type="button" onClick={() => setMonth(addMonths(month, 1))} className={smallBtn} aria-label={t('ros.nextMonth')}>›</button>
          </div>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{monthLabel}</span>
          <PeriodBadge status={view?.period?.status ?? null} />
          {view?.period?.publishedAt && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{t('ros.publishedOn', { date: formatDate(view.period.publishedAt) })}</span>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => exportAs('pdf')} disabled={!departmentId} className={smallBtn}>PDF</button>
          <button type="button" onClick={() => exportAs('csv')} disabled={!departmentId} className={smallBtn}>CSV</button>
          {isManager && (
            <>
              <button type="button" onClick={() => setCopyOpen(true)} className={smallBtn}>{t('ros.copy.button')}</button>
              <button type="button" onClick={() => setPublishOpen(true)} className={primaryBtn}>
                {status === 'PUBLISHED' ? t('ros.publish.again') : t('ros.publish.button')}
              </button>
            </>
          )}
        </div>
      </div>

      {isManager && shiftTypes && shiftTypes.length > 0 && (
        <div className={`${cardClass} p-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-1">{t('ros.paint.label')}</span>
            <button
              type="button"
              onClick={() => setPaintTypeId(null)}
              aria-pressed={paintTypeId === null}
              className={`px-3 py-1.5 rounded-lg text-sm border ${paintTypeId === null ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20 text-lime-800 dark:text-lime-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
            >
              {t('ros.paint.off')}
            </button>
            {shiftTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setPaintTypeId(type.id)}
                aria-pressed={paintTypeId === type.id}
                title={`${type.name} · ${type.startTime}–${type.endTime}`}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm border ${paintTypeId === type.id ? 'border-gray-900 dark:border-white ring-2 ring-offset-1 ring-gray-900 dark:ring-white' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <ShiftChip shiftType={type} />
                <span className="text-gray-700 dark:text-gray-300">{type.name}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{paintTypeId ? t('ros.paint.hintOn') : t('ros.paint.hintOff')}</p>
        </div>
      )}

      {loadError && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/40 text-sm text-red-700 dark:text-red-300">{loadError}</div>}

      {view && view.warnings.length > 0 && isManager && (
        <section className={`${cardClass} p-4`} aria-labelledby="ros-warnings">
          <h2 id="ros-warnings" className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">{t('ros.warnings.title', { count: view.warnings.length })}</h2>
          <ul className="grid gap-1 sm:grid-cols-2">
            {view.warnings.map((w, i) => (
              <li key={`${w.type}-${w.userId ?? ''}-${w.date}-${i}`}>
                <button type="button" onClick={() => focusWarning(w)} className="w-full text-left text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                  <span className="font-medium text-gray-900 dark:text-white">{dayLabel(w.date)}</span>
                  {w.userName && <span className="text-gray-700 dark:text-gray-300"> · {w.userName}</span>}
                  <span className="text-red-700 dark:text-red-300"> — {t(warningKey(w.type))}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${cardClass} overflow-hidden`}>
        {!view && !loadError ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('ros.loading')}</p>
        ) : view && draftHidden ? (
          <p className="p-6 text-sm text-gray-600 dark:text-gray-300">{t('ros.notPublishedYet')}</p>
        ) : view ? (
          <RosterGrid view={view} days={days} canEdit={isManager} focusedCell={focusedCell} onCellClick={onCellClick} />
        ) : null}
      </section>

      {shiftTypes && shiftTypes.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
          {shiftTypes.map((type) => (
            <span key={type.id} className="flex items-center gap-1.5">
              <ShiftChip shiftType={type} size="xs" /> {type.name} ({type.startTime}–{type.endTime})
            </span>
          ))}
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-100 dark:bg-sky-900/40" /> {t('ros.legend.leave')}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-900/60" /> {t('ros.legend.dayOff')}</span>
        </div>
      )}

      {cell && cellPerson && shiftTypes && (
        <ShiftCellDialog
          person={cellPerson}
          date={cell.date}
          shifts={cell.shifts}
          shiftTypes={shiftTypes}
          departmentId={departmentId}
          onClose={() => setCell(null)}
          onChanged={(warnings) => {
            setCell(null);
            showWarnings(warnings);
            load();
          }}
        />
      )}
      {copyOpen && (
        <CopyWeekDialog
          departmentId={departmentId}
          month={month}
          onClose={() => setCopyOpen(false)}
          onDone={() => {
            setCopyOpen(false);
            load();
          }}
        />
      )}
      <ConfirmModal
        isOpen={publishOpen}
        title={t('ros.publish.title', { month: monthLabel })}
        message={view && view.warnings.length > 0 ? t('ros.publish.messageWarnings', { count: view.warnings.length }) : t('ros.publish.message')}
        confirmText={t('ros.publish.confirm')}
        cancelText={t('ros.cancel')}
        variant={view && view.warnings.length > 0 ? 'warning' : 'info'}
        isLoading={publishing}
        onConfirm={publish}
        onClose={() => setPublishOpen(false)}
      />
    </div>
  );
}
