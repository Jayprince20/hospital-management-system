'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type LeaveBalance, type LeaveRequest, type LeaveType, type PublicHoliday } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';
import { addMonths, countWorkingDays, isManagerOf, isoDate, monthDays, monthOf, remainingAfter } from '@/lib/rosters';
import { LeaveDecisionDialog, LeaveStatusBadge, myDepartment, useDayLabel, useRosterDepartments } from '@/components/rosters';
import { ErrorBox, cardClass, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from '@/components/rosters/ui';

const LEAVE_TYPES: LeaveType[] = ['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'TRAINING', 'UNPAID', 'OTHER'];

const personName = (r: LeaveRequest) => r.userName ?? r.user?.name ?? `${r.user?.firstName ?? ''} ${r.user?.lastName ?? ''}`.trim();
const departmentName = (r: LeaveRequest) => (typeof r.department === 'string' ? r.department : r.department?.name ?? '');

function useHolidays(years: number[]) {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const key = [...new Set(years)].sort().join(',');
  useEffect(() => {
    let live = true;
    Promise.all(key.split(',').map((y) => api.getPublicHolidays(Number(y)).catch(() => [] as PublicHoliday[]))).then(
      (lists) => live && setHolidays(lists.flat())
    );
    return () => {
      live = false;
    };
  }, [key]);
  return holidays;
}

function BalanceCard({ balance }: { balance: LeaveBalance | null }) {
  const { t } = useLanguage();
  if (!balance) return null;
  const items = [
    { label: t('ros.balance.entitlement'), value: balance.entitlement },
    { label: t('ros.balance.taken'), value: balance.taken },
    { label: t('ros.balance.pending'), value: balance.pending },
    { label: t('ros.balance.remaining'), value: balance.remaining, strong: true },
  ];
  return (
    <section className={`${cardClass} p-5`} aria-labelledby="balance-title">
      <h2 id="balance-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('ros.balance.title', { year: balance.year })}</h2>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((i) => (
          <div key={i.label} className={`p-3 rounded-lg ${i.strong ? 'bg-lime-50 dark:bg-lime-900/20' : 'bg-gray-50 dark:bg-gray-700/40'}`}>
            <dt className="text-xs text-gray-500 dark:text-gray-400">{i.label}</dt>
            <dd className={`text-2xl font-bold tabular-nums ${i.strong ? 'text-lime-700 dark:text-lime-400' : 'text-gray-900 dark:text-white'}`}>{i.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('ros.balance.hint')}</p>
    </section>
  );
}

function RequestForm({ balance, onSent }: { balance: LeaveBalance | null; onSent: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const today = isoDate(new Date());
  const [type, setType] = useState<LeaveType>('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const years = [startDate, endDate].filter(Boolean).map((d) => Number(d.slice(0, 4)));
  const holidays = useHolidays(years.length ? years : [new Date().getFullYear()]);
  const validRange = Boolean(startDate && endDate && endDate >= startDate);
  const days = validRange ? countWorkingDays(startDate, endDate, holidays.map((h) => h.date.slice(0, 10))) : 0;
  const holidaysInRange = validRange ? holidays.filter((h) => h.date.slice(0, 10) >= startDate && h.date.slice(0, 10) <= endDate) : [];
  const after = balance && type === 'ANNUAL' ? remainingAfter(balance, days) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validRange) return setError(t('ros.request.badRange'));
    if (days === 0) return setError(t('ros.request.noWorkingDays'));
    setSaving(true);
    setError('');
    try {
      await api.requestLeave({ type, startDate, endDate, reason: reason.trim() || undefined });
      toast.success(t('ros.request.sent'));
      setStartDate('');
      setEndDate('');
      setReason('');
      onSent();
    } catch (err) {
      setError(messageOf(err, t('ros.actionFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`${cardClass} p-5`} aria-labelledby="request-title">
      <h2 id="request-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('ros.request.title')}</h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="lv-type" className={labelClass}>{t('ros.request.type')}</label>
          <select id="lv-type" value={type} onChange={(e) => setType(e.target.value as LeaveType)} className={inputClass}>
            {LEAVE_TYPES.map((lt) => (
              <option key={lt} value={lt}>{t(`ros.leaveType.${lt}`)}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lv-start" className={labelClass}>{t('ros.request.start')}</label>
            <input
              id="lv-start"
              type="date"
              value={startDate}
              min={type === 'SICK' ? undefined : today}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="lv-end" className={labelClass}>{t('ros.request.end')}</label>
            <input id="lv-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
          </div>
        </div>
        {validRange && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 text-sm text-gray-700 dark:text-gray-200 space-y-1">
            <p className="font-medium">{t('ros.request.workingDays', { count: days })}</p>
            {holidaysInRange.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('ros.request.holidaysExcluded', { names: holidaysInRange.map((h) => h.name).join(', ') })}</p>
            )}
            {after !== null && (
              <p className={`text-xs ${after < 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                {after < 0 ? t('ros.request.overBalance', { count: -after }) : t('ros.request.remainingAfter', { count: after })}
              </p>
            )}
          </div>
        )}
        <div>
          <label htmlFor="lv-reason" className={labelClass}>{t('ros.request.reason')}</label>
          <textarea id="lv-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
        </div>
        <ErrorBox message={error} />
        <div className="flex justify-end">
          <button type="submit" disabled={saving || !validRange} className={primaryBtn}>{t('ros.request.submit')}</button>
        </div>
      </form>
    </section>
  );
}

function LeaveCalendar({ departmentId, departmentOptions }: { departmentId: string; departmentOptions: Array<{ id: string; name: string }> }) {
  const { t, formatDate } = useLanguage();
  const [deptId, setDeptId] = useState(departmentId);
  const [month, setMonth] = useState(monthOf());
  const [calendar, setCalendar] = useState<Awaited<ReturnType<typeof api.getLeaveCalendar>> | null>(null);
  const [failed, setFailed] = useState(false);
  const holidays = useHolidays([Number(month.slice(0, 4))]);

  useEffect(() => {
    if (!deptId) return;
    let live = true;
    api
      .getLeaveCalendar(deptId, month)
      .then((c) => {
        if (!live) return;
        setCalendar(c);
        setFailed(false);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [deptId, month]);

  const days = useMemo(() => monthDays(month, holidays), [month, holidays]);
  const byDay = useMemo(() => new Map((calendar ?? []).map((d) => [d.date.slice(0, 10), d.people])), [calendar]);
  const leadingBlanks = days.length ? (days[0].weekday + 6) % 7 : 0;

  if (failed) return null;
  return (
    <section className={`${cardClass} p-5`} aria-labelledby="leave-cal-title">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 id="leave-cal-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('ros.calendar.title')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {departmentOptions.length > 1 && (
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} aria-label={t('ros.department')} className={`${inputClass} w-56`}>
              {departmentOptions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <button type="button" onClick={() => setMonth(addMonths(month, -1))} className={smallBtn} aria-label={t('ros.prevMonth')}>‹</button>
          <span className="text-sm font-medium text-gray-900 dark:text-white capitalize w-32 text-center">{formatDate(`${month}-01T12:00:00`, { month: 'long', year: 'numeric' })}</span>
          <button type="button" onClick={() => setMonth(addMonths(month, 1))} className={smallBtn} aria-label={t('ros.nextMonth')}>›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {[1, 2, 3, 4, 5, 6, 0].map((w) => (
          <div key={w} className="py-1 text-center font-medium text-gray-500 dark:text-gray-400">{t(`ros.weekday.${w}`)}</div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => <div key={`b${i}`} />)}
        {days.map((d) => {
          const people = byDay.get(d.date) ?? [];
          return (
            <div
              key={d.date}
              title={d.holidayName ?? undefined}
              className={`min-h-[3.5rem] rounded-lg p-1 border ${d.isToday ? 'border-lime-500' : 'border-transparent'} ${d.isHoliday || d.isSunday ? 'bg-gray-100 dark:bg-gray-900/60' : 'bg-gray-50 dark:bg-gray-700/40'}`}
            >
              <p className={`text-[11px] ${d.isHoliday ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>{d.day}</p>
              {people.slice(0, 3).map((p) => (
                <p key={p.userId} className="truncate text-[10px] text-sky-800 dark:text-sky-200 bg-sky-100 dark:bg-sky-900/40 rounded px-1 mt-0.5" title={`${p.name} · ${t(`ros.leaveType.${p.type}`)}`}>
                  {p.name}
                </p>
              ))}
              {people.length > 3 && <p className="text-[10px] text-gray-500 dark:text-gray-400">+{people.length - 3}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function LeavePage() {
  const { user } = useAuth();
  const { t, formatDate } = useLanguage();
  const toast = useToast();
  const dayLabel = useDayLabel();
  const { departments } = useRosterDepartments();
  const today = isoDate(new Date());

  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [toDecide, setToDecide] = useState<LeaveRequest[]>([]);
  const [deciding, setDeciding] = useState<LeaveRequest | null>(null);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .getMyLeave()
      .then((res) => {
        setRequests(res.requests);
        setBalance(res.balance);
      })
      .catch(() => setRequests([]));
    // Only managers get requests to decide; others get an empty list or a 403
    api
      .getLeaveRequests({ status: 'PENDING' })
      .then((list) => setToDecide(list.filter((r) => r.userId !== user?.id)))
      .catch(() => setToDecide([]));
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const managed = (departments ?? []).filter((d) => isManagerOf(user, d));
  const mine = myDepartment(departments, user?.id);
  const calendarDepartments = managed.length > 0 ? managed : mine ? [mine] : [];

  const cancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await api.cancelLeave(cancelling.id);
      toast.success(t('ros.myLeave.cancelled'));
      setCancelling(null);
      load();
    } catch (err) {
      toast.error(t('ros.actionFailed'), messageOf(err, ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ros.leavePage.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('ros.leavePage.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/my-schedule" className={smallBtn}>{t('ros.nav.mySchedule')}</Link>
          <Link href="/dashboard/rosters" className={smallBtn}>{t('ros.nav.planning')}</Link>
        </div>
      </div>

      {toDecide.length > 0 && (
        <section className={`${cardClass} p-5`} aria-labelledby="to-decide-title">
          <h2 id="to-decide-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('ros.decide.title', { count: toDecide.length })}</h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {toDecide.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {personName(r)}
                    {departmentName(r) && <span className="font-normal text-gray-500 dark:text-gray-400"> · {departmentName(r)}</span>}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {t(`ros.leaveType.${r.type}`)} · {dayLabel(r.startDate)} → {dayLabel(r.endDate)} · {t('ros.leave.daysCount', { count: r.days })}
                  </p>
                  {(r.conflicts ?? 0) > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">{t('ros.leave.conflicts', { count: r.conflicts ?? 0 })}</p>}
                </div>
                <button type="button" onClick={() => setDeciding(r)} className={primaryBtn}>{t('ros.decide.open')}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BalanceCard balance={balance} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RequestForm balance={balance} onSent={load} />

        <section className={`${cardClass} p-5`} aria-labelledby="my-requests-title">
          <h2 id="my-requests-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('ros.myLeave.title')}</h2>
          {!requests ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('ros.loading')}</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('ros.myLeave.none')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {requests.map((r) => {
                const cancellable = r.status === 'PENDING' || (r.status === 'APPROVED' && r.startDate.slice(0, 10) > today);
                return (
                  <li key={r.id} className="py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {t(`ros.leaveType.${r.type}`)} · {t('ros.leave.daysCount', { count: r.days })}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300">{dayLabel(r.startDate)} → {dayLabel(r.endDate)}</p>
                        {r.decisionNote && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {r.decidedByName ? `${r.decidedByName} : ` : ''}« {r.decisionNote} »
                          </p>
                        )}
                        {r.createdAt && <p className="text-xs text-gray-400 dark:text-gray-500">{t('ros.myLeave.sentOn', { date: formatDate(r.createdAt) })}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <LeaveStatusBadge status={r.status} />
                        {cancellable && (
                          <button type="button" onClick={() => setCancelling(r)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                            {t('ros.myLeave.cancel')}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {calendarDepartments.length > 0 && (
        <LeaveCalendar key={calendarDepartments[0].id} departmentId={calendarDepartments[0].id} departmentOptions={calendarDepartments} />
      )}

      {deciding && (
        <LeaveDecisionDialog
          request={deciding}
          onClose={() => setDeciding(null)}
          onDone={() => {
            setDeciding(null);
            load();
          }}
        />
      )}
      <ConfirmModal
        isOpen={Boolean(cancelling)}
        title={t('ros.myLeave.cancelTitle')}
        message={cancelling ? t('ros.myLeave.cancelMessage', { from: dayLabel(cancelling.startDate), to: dayLabel(cancelling.endDate) }) : ''}
        confirmText={t('ros.myLeave.cancel')}
        cancelText={t('ros.close')}
        variant="warning"
        isLoading={busy}
        onConfirm={cancel}
        onClose={() => setCancelling(null)}
      />
    </div>
  );
}
