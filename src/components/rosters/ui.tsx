'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type LeaveStatus, type RosterDepartment, type RosterPeriodStatus, type RosterShift, type ShiftType } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { readableTextColor } from '@/lib/rosters';

export { DialogShell, ErrorBox, cancelBtn, cardClass, dangerBtn, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from '@/components/inpatient/ui';

type ShiftLike = Pick<ShiftType, 'code' | 'name' | 'color'> & Partial<Pick<ShiftType, 'startTime' | 'endTime' | 'isOnCall'>>;

/** Coloured code of a shift type ("J", "N", "G"…) with its name and hours as a tooltip */
export function ShiftChip({ shiftType, size = 'sm', className = '' }: { shiftType: ShiftLike; size?: 'xs' | 'sm'; className?: string }) {
  const color = shiftType.color || '#84cc16';
  const title = shiftType.startTime && shiftType.endTime ? `${shiftType.name} · ${shiftType.startTime}–${shiftType.endTime}` : shiftType.name;
  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center rounded font-bold leading-none ${size === 'xs' ? 'text-[10px] px-1 py-0.5 min-w-[1.25rem]' : 'text-xs px-1.5 py-1 min-w-[1.75rem]'} ${className}`}
      style={{ backgroundColor: color, color: readableTextColor(color) }}
    >
      {shiftType.code}
    </span>
  );
}

export function PeriodBadge({ status }: { status: RosterPeriodStatus | null | undefined }) {
  const { t } = useLanguage();
  const published = status === 'PUBLISHED';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${published ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}`}>
      {t(published ? 'ros.period.PUBLISHED' : 'ros.period.DRAFT')}
    </span>
  );
}

const LEAVE_STATUS_STYLE: Record<LeaveStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${LEAVE_STATUS_STYLE[status]}`}>{t(`ros.leaveStatus.${status}`)}</span>;
}

/** "Lun. 26 oct." style label of a YYYY-MM-DD day */
export function useDayLabel() {
  const { formatDate } = useLanguage();
  return useCallback((date: string) => formatDate(`${date.slice(0, 10)}T12:00:00`, { weekday: 'short', day: 'numeric', month: 'short' }), [formatDate]);
}

/** Hours of a shift, e.g. "19:00 → 07:00 (+1 j)" */
export function ShiftHours({ shift }: { shift: Pick<RosterShift, 'shiftType'> }) {
  const { t } = useLanguage();
  const { startTime, endTime } = shift.shiftType;
  const overnight = endTime <= startTime;
  return (
    <span className="tabular-nums">
      {startTime} → {endTime}
      {overnight && <span className="text-gray-500 dark:text-gray-400"> {t('ros.nextDay')}</span>}
    </span>
  );
}

export function useShiftTypes(includeInactive = false) {
  const [types, setTypes] = useState<ShiftType[] | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    api
      .getShiftTypes(includeInactive)
      .then((list) => setTypes(includeInactive ? list : list.filter((s) => s.isActive !== false)))
      .catch((err) => setError(err instanceof Error ? err.message : ''));
  }, [includeInactive]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { types, error, reload };
}

export function useRosterDepartments() {
  const [departments, setDepartments] = useState<RosterDepartment[] | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    api
      .getRosterDepartments()
      .then(setDepartments)
      .catch((err) => {
        setDepartments([]);
        setError(err instanceof Error ? err.message : '');
      });
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { departments, error, reload };
}

/** Department the signed-in person belongs to (first one listing them as staff) */
export function myDepartment(departments: RosterDepartment[] | null, userId: string | undefined): RosterDepartment | null {
  if (!departments || !userId) return null;
  return departments.find((d) => d.staff.some((s) => s.userId === userId) || d.head?.id === userId) ?? null;
}

/** Remembered choice (department, month) for the planning screens; storage may be unavailable */
export function rememberedValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function rememberValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not critical: the choice simply isn't remembered
  }
}
