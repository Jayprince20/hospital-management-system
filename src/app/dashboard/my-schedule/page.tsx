'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type LeaveRequest, type PublicHoliday, type RosterShift } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { addDays, addMonths, coversDay, isoDate, monthDays, monthOf } from '@/lib/rosters';
import {
  LeaveStatusBadge,
  ProposeSwapDialog,
  ShiftChip,
  ShiftHours,
  SwapInbox,
  myDepartment,
  useDayLabel,
  useRosterDepartments,
} from '@/components/rosters';
import { cardClass, messageOf, smallBtn } from '@/components/rosters/ui';

const UPCOMING_DAYS = 30;

export default function MySchedulePage() {
  const { user } = useAuth();
  const { t, formatDate } = useLanguage();
  const dayLabel = useDayLabel();
  const { departments } = useRosterDepartments();
  const today = isoDate(new Date());

  const [month, setMonth] = useState(monthOf());
  const [shifts, setShifts] = useState<RosterShift[] | null>(null);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [error, setError] = useState('');
  const [swapShift, setSwapShift] = useState<RosterShift | null>(null);

  // One fetch covers the displayed month and the upcoming list
  const range = useMemo(() => {
    const monthStart = `${month}-01`;
    const monthEnd = addDays(`${addMonths(month, 1)}-01`, -1);
    const upcomingEnd = addDays(today, UPCOMING_DAYS);
    return { from: monthStart < today ? monthStart : today, to: monthEnd > upcomingEnd ? monthEnd : upcomingEnd };
  }, [month, today]);

  const load = useCallback(() => {
    api
      .getMyRoster(range.from, range.to)
      .then((res) => {
        setError('');
        setShifts(res.shifts.filter((s) => s.status !== 'CANCELLED'));
        setLeave(res.leave);
      })
      .catch((err) => {
        setShifts([]);
        setError(messageOf(err, t('ros.loadFailed')));
      });
  }, [range, t]);

  useEffect(() => {
    load();
  }, [load]);

  const year = Number(month.slice(0, 4));
  useEffect(() => {
    api.getPublicHolidays(year).then(setHolidays).catch(() => setHolidays([]));
  }, [year]);

  const days = useMemo(() => monthDays(month, holidays), [month, holidays]);
  const upcoming = (shifts ?? [])
    .filter((s) => s.date.slice(0, 10) >= today && s.date.slice(0, 10) <= addDays(today, UPCOMING_DAYS))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const approvedLeave = leave.filter((l) => l.status === 'APPROVED');
  const department = myDepartment(departments, user?.id);
  const colleagues = (department?.staff ?? []).filter((s) => s.userId !== user?.id);
  // Monday-first calendar: blanks before the 1st
  const leadingBlanks = days.length ? (days[0].weekday + 6) % 7 : 0;
  const monthLabel = formatDate(`${month}-01T12:00:00`, { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ros.mine.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('ros.mine.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/rosters" className={smallBtn}>{t('ros.nav.planning')}</Link>
          <Link href="/dashboard/leave" className={smallBtn}>{t('ros.nav.leave')}</Link>
          {user?.role === 'DOCTOR' && <Link href="/dashboard/schedule" className={smallBtn}>{t('ros.mine.availability')}</Link>}
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/40 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className={`${cardClass} p-5 lg:col-span-2`} aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('ros.mine.upcoming', { count: UPCOMING_DAYS })}</h2>
          {!shifts ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('ros.loading')}</p>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('ros.mine.noUpcoming')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <ShiftChip shiftType={s.shiftType} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{dayLabel(s.date)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {s.shiftType.name} · <ShiftHours shift={s} />
                        {s.departmentName ? ` · ${s.departmentName}` : ''}
                      </p>
                    </div>
                  </div>
                  {colleagues.length > 0 && (
                    <button type="button" onClick={() => setSwapShift(s)} className={`${smallBtn} shrink-0`}>{t('ros.mine.proposeSwap')}</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${cardClass} p-5 lg:col-span-3`} aria-labelledby="calendar-title">
          <div className="flex items-center justify-between mb-3">
            <h2 id="calendar-title" className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{monthLabel}</h2>
            <div className="flex gap-1">
              <button type="button" onClick={() => setMonth(addMonths(month, -1))} className={smallBtn} aria-label={t('ros.prevMonth')}>‹</button>
              <button type="button" onClick={() => setMonth(monthOf())} className={smallBtn}>{t('ros.thisMonth')}</button>
              <button type="button" onClick={() => setMonth(addMonths(month, 1))} className={smallBtn} aria-label={t('ros.nextMonth')}>›</button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {[1, 2, 3, 4, 5, 6, 0].map((w) => (
              <div key={w} className="py-1 font-medium text-gray-500 dark:text-gray-400">{t(`ros.weekday.${w}`)}</div>
            ))}
            {Array.from({ length: leadingBlanks }, (_, i) => <div key={`b${i}`} />)}
            {days.map((d) => {
              const dayShifts = (shifts ?? []).filter((s) => s.date.slice(0, 10) === d.date);
              const onLeave = approvedLeave.some((l) => coversDay(l, d.date));
              return (
                <div
                  key={d.date}
                  title={d.holidayName ?? undefined}
                  className={`min-h-[3.5rem] rounded-lg p-1 border ${d.isToday ? 'border-lime-500' : 'border-transparent'} ${
                    onLeave ? 'bg-sky-50 dark:bg-sky-900/30' : d.isHoliday || d.isSunday ? 'bg-gray-100 dark:bg-gray-900/60' : 'bg-gray-50 dark:bg-gray-700/40'
                  }`}
                >
                  <p className={`text-[11px] ${d.isHoliday ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>{d.day}</p>
                  <div className="flex flex-wrap justify-center gap-0.5 mt-0.5">
                    {dayShifts.map((s) => <ShiftChip key={s.id} shiftType={s.shiftType} size="xs" />)}
                    {onLeave && dayShifts.length === 0 && <span className="text-[10px] text-sky-700 dark:text-sky-300">{t('ros.grid.leave')}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${cardClass} p-5`} aria-labelledby="my-leave-title">
          <div className="flex items-center justify-between mb-3">
            <h2 id="my-leave-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('ros.mine.leave')}</h2>
            <Link href="/dashboard/leave" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">{t('ros.mine.requestLeave')}</Link>
          </div>
          {leave.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('ros.mine.noLeave')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {leave.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-gray-900 dark:text-white">
                    {t(`ros.leaveType.${l.type}`)} · {formatDate(`${l.startDate.slice(0, 10)}T12:00:00`)} → {formatDate(`${l.endDate.slice(0, 10)}T12:00:00`)}
                  </span>
                  <LeaveStatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <SwapInbox onChanged={load} />
      </div>

      {swapShift && (
        <ProposeSwapDialog
          shift={swapShift}
          colleagues={colleagues}
          onClose={() => setSwapShift(null)}
          onDone={() => {
            setSwapShift(null);
            load();
          }}
        />
      )}
    </div>
  );
}
