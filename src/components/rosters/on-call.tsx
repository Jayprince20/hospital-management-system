'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type OnCallEntry } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { ShiftChip, myDepartment, useRosterDepartments } from './ui';

const STAFF_ROLES = ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECH'];

export const departmentNameOf = (entry: OnCallEntry) =>
  typeof entry.department === 'string' ? entry.department : entry.department?.name ?? '';

function OnCallRow({ entry }: { entry: OnCallEntry }) {
  const { t, tEnum, formatTime } = useLanguage();
  const type = typeof entry.shiftType === 'object' && entry.shiftType ? entry.shiftType : null;
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{entry.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tEnum(entry.role)}
          {entry.until ? ` · ${t('ros.onCall.until', { time: formatTime(entry.until) })}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {type && <ShiftChip shiftType={type} size="xs" />}
        {entry.phone && (
          <a href={`tel:${entry.phone.replace(/\s/g, '')}`} className="text-sm text-lime-700 dark:text-lime-400 hover:underline tabular-nums">
            {entry.phone}
          </a>
        )}
      </div>
    </li>
  );
}

/** People on call now (or at `at`), optionally for one department */
export function useOnCall(departmentId?: string | null, refreshMs = 5 * 60_000, enabled = true) {
  const [entries, setEntries] = useState<OnCallEntry[] | null>(null);
  const [error, setError] = useState(false);
  // Only the latest request may update the list (a slow answer for another department must not win)
  const seq = useRef(0);
  const load = useCallback(() => {
    const mine = ++seq.current;
    api
      .getOnCall(departmentId ? { departmentId } : {})
      .then((res) => {
        if (mine !== seq.current) return;
        setEntries(res.onCall);
        setError(false);
      })
      .catch(() => {
        if (mine !== seq.current) return;
        setEntries([]);
        setError(true);
      });
  }, [departmentId]);
  useEffect(() => {
    if (!enabled) return;
    load();
    const timer = setInterval(load, refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs, enabled]);
  return { entries, error, reload: load };
}

export function OnCallList({ entries, emptyLabel }: { entries: OnCallEntry[]; emptyLabel?: string }) {
  const { t } = useLanguage();
  if (entries.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400 py-2">{emptyLabel ?? t('ros.onCall.nobody')}</p>;
  return <ul className="divide-y divide-gray-100 dark:divide-gray-700">{entries.map((e) => <OnCallRow key={`${e.userId}-${e.until ?? ''}`} entry={e} />)}</ul>;
}

/** Header quick view for staff: who is on call now in my department */
export function OnCallButton() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isStaff = Boolean(user && STAFF_ROLES.includes(user.role));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!isStaff) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        <span className="hidden lg:inline">{t('ros.onCall.button')}</span>
      </button>
      {open && <OnCallPopover onNavigate={() => setOpen(false)} />}
    </div>
  );
}

function OnCallPopover({ onNavigate }: { onNavigate: () => void }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { departments } = useRosterDepartments();
  const mine = myDepartment(departments, user?.id);
  // Wait for the department list, otherwise the first answer would be for every department
  const { entries } = useOnCall(mine?.id ?? null, undefined, departments !== null);
  return (
    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('ros.onCall.now')}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{mine ? mine.name : t('ros.onCall.allDepartments')}</p>
      {entries === null ? <p className="text-sm text-gray-500 py-2">{t('ros.loading')}</p> : <OnCallList entries={entries} />}
      <Link href="/dashboard/on-call" onClick={onNavigate} className="block mt-3 text-sm text-lime-700 dark:text-lime-400 hover:underline">
        {t('ros.onCall.seeAll')}
      </Link>
    </div>
  );
}

/**
 * Non-blocking hint in the "call the doctor" steps (critical lab/imaging results): who is on call
 * now in the ordering doctor's department. Silent when nothing can be found.
 */
export function OnCallSuggestion({ doctorId, onPick }: { doctorId?: string | null; onPick?: (label: string) => void }) {
  const { t, tEnum } = useLanguage();
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [entries, setEntries] = useState<OnCallEntry[] | null>(null);

  useEffect(() => {
    if (!doctorId) return;
    let live = true;
    api
      .getDoctor(doctorId)
      .then((d) => live && setDepartmentId(d.departmentId ?? null))
      .catch(() => live && setDepartmentId(null));
    return () => {
      live = false;
    };
  }, [doctorId]);

  useEffect(() => {
    if (!departmentId) return;
    let live = true;
    api
      .getOnCall({ departmentId })
      .then((res) => live && setEntries(res.onCall.filter((e) => e.role === 'DOCTOR' || res.onCall.every((x) => x.role !== 'DOCTOR'))))
      .catch(() => live && setEntries([]));
    return () => {
      live = false;
    };
  }, [departmentId]);

  if (!entries || entries.length === 0) return null;
  return (
    <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sm text-sky-900 dark:text-sky-100">
      <p className="font-medium">{t('ros.onCall.suggestion')}</p>
      <ul className="mt-1 space-y-1">
        {entries.map((e) => {
          const label = `${e.name} (${tEnum(e.role)}${e.phone ? `, ${e.phone}` : ''})`;
          return (
            <li key={e.userId} className="flex items-center justify-between gap-2">
              <span>
                {e.name}
                {e.phone && (
                  <>
                    {' · '}
                    <a href={`tel:${e.phone.replace(/\s/g, '')}`} className="underline tabular-nums">{e.phone}</a>
                  </>
                )}
              </span>
              {onPick && (
                <button type="button" onClick={() => onPick(label)} className="text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline shrink-0">
                  {t('ros.onCall.use')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
