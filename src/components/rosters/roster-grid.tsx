'use client';

import { useMemo } from 'react';
import type { RosterShift, RosterView } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { cellKey, coversDay, type GridDay } from '@/lib/rosters';
import { ShiftChip } from './ui';

/**
 * Month planning: one row per person, one column per day. Weekends and public holidays are
 * shaded, today is outlined, approved leave shows as "Congé", cells with a warning get a red
 * ring, and the last row counts who is on call each day (red when nobody).
 */
export function RosterGrid({
  view,
  days,
  canEdit,
  focusedCell,
  onCellClick,
}: {
  view: RosterView;
  days: GridDay[];
  canEdit: boolean;
  focusedCell?: string | null;
  onCellClick?: (userId: string, date: string, shifts: RosterShift[]) => void;
}) {
  const { t, tEnum } = useLanguage();

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, RosterShift[]>();
    for (const s of view.shifts) {
      if (s.status === 'CANCELLED') continue;
      const key = cellKey(s.userId, s.date.slice(0, 10));
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [view.shifts]);

  const warnedCells = useMemo(() => {
    const set = new Set<string>();
    for (const w of view.warnings) if (w.userId) set.add(cellKey(w.userId, w.date.slice(0, 10)));
    return set;
  }, [view.warnings]);

  const coverageByDate = useMemo(() => new Map(view.coverage.map((c) => [c.date.slice(0, 10), c])), [view.coverage]);
  // Departments without any on-call shift this month (and not an emergency department) aren't flagged red
  const usesOnCall = view.coverage.some((c) => c.onCall.length > 0) || /urgence|emergenc/i.test(view.department?.name ?? '');
  const approvedLeave = useMemo(() => view.leave.filter((l) => l.status === 'APPROVED'), [view.leave]);

  const dayClass = (d: GridDay) =>
    d.isHoliday || d.isSunday
      ? 'bg-gray-100 dark:bg-gray-900/60'
      : d.isSaturday
        ? 'bg-gray-50 dark:bg-gray-900/30'
        : '';

  if (view.staff.length === 0) {
    return <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('ros.grid.noStaff')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-white dark:bg-gray-800 text-left px-3 py-2 min-w-[12rem] border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium">
              {t('ros.grid.staff')}
            </th>
            {days.map((d) => (
              <th
                key={d.date}
                scope="col"
                title={d.holidayName ?? undefined}
                className={`w-9 min-w-[2.25rem] px-0.5 py-1 text-center border-b border-gray-200 dark:border-gray-700 font-medium ${dayClass(d)} ${d.isToday ? 'text-lime-700 dark:text-lime-400' : 'text-gray-600 dark:text-gray-300'}`}
              >
                <div className="text-[10px] uppercase">{t(`ros.weekday.${d.weekday}`)}</div>
                <div className={d.isToday ? 'mx-auto w-6 h-6 leading-6 rounded-full bg-lime-600 text-white' : ''}>{d.day}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.staff.map((person) => (
            <tr key={person.userId}>
              <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-gray-800 text-left px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 font-normal">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[12rem]">{person.name}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">{person.title || tEnum(person.role)}</div>
              </th>
              {days.map((d) => {
                const key = cellKey(person.userId, d.date);
                const shifts = shiftsByCell.get(key) ?? [];
                const onLeave = approvedLeave.some((l) => l.userId === person.userId && coversDay(l, d.date));
                const warned = warnedCells.has(key);
                const focused = focusedCell === key;
                const label = `${person.name} — ${d.date}`;
                const content = (
                  <div className="flex flex-col items-center gap-0.5">
                    {onLeave && shifts.length === 0 && <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-300">{t('ros.grid.leave')}</span>}
                    {shifts.map((s) => (
                      <ShiftChip key={s.id} shiftType={s.shiftType} size="xs" />
                    ))}
                  </div>
                );
                return (
                  <td
                    key={d.date}
                    id={`cell-${key}`}
                    className={`h-11 p-0.5 text-center align-middle border-b border-gray-100 dark:border-gray-700 ${dayClass(d)} ${onLeave ? 'bg-sky-50 dark:bg-sky-900/20' : ''}`}
                  >
                    {canEdit && onCellClick ? (
                      <button
                        type="button"
                        aria-label={label}
                        onClick={() => onCellClick(person.userId, d.date, shifts)}
                        className={`w-full h-full min-h-[2.5rem] rounded hover:bg-lime-50 dark:hover:bg-lime-900/20 focus:outline-none focus:ring-2 focus:ring-lime-500 ${warned ? 'ring-2 ring-red-400' : ''} ${focused ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className={`w-full h-full min-h-[2.5rem] flex items-center justify-center rounded ${warned ? 'ring-2 ring-red-400' : ''} ${focused ? 'ring-2 ring-blue-500' : ''}`}>{content}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-gray-800 text-left px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t('ros.grid.coverage')}
            </th>
            {days.map((d) => {
              const c = coverageByDate.get(d.date);
              // The row is about on-call cover: count the people on an on-call shift, not every shift that day
              const count = c?.onCall.length ?? 0;
              return (
                <td
                  key={d.date}
                  title={c && c.onCall.length ? c.onCall.join(', ') : t('ros.grid.noOnCall')}
                  className={`text-center py-2 font-semibold ${!usesOnCall ? 'text-gray-400' : count === 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'text-green-700 dark:text-green-400'}`}
                >
                  {count}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
