'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Appointment } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { toLocalDateString } from '@/lib/formatters';
import { ConfirmBookingButton } from './confirmation-ui';

const DAYS_AHEAD = 60;

/** A booking the doctor can still validate: scheduled and not yet started */
export function awaitsConfirmation(a: Pick<Appointment, 'status' | 'appointmentDate' | 'startTime'>, now: Date = new Date()): boolean {
  if (a.status !== 'SCHEDULED') return false;
  const day = a.appointmentDate.slice(0, 10);
  const today = toLocalDateString(now);
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return day > today || (day === today && a.startTime > time);
}

/** Bookings still to validate, soonest first */
export function pendingBookings(appointments: Appointment[], now: Date = new Date()): Appointment[] {
  return appointments
    .filter((a) => awaitsConfirmation(a, now))
    .sort((a, b) => a.appointmentDate.slice(0, 10).localeCompare(b.appointmentDate.slice(0, 10)) || a.startTime.localeCompare(b.startTime));
}

/** Doctor dashboard: new bookings waiting for the doctor's confirmation, one click each */
export function PendingBookingsCard({ doctorId, onChanged }: { doctorId: string; onChanged?: () => void }) {
  const { t, tEnum, formatDate, formatTime } = useLanguage();
  const toast = useToast();
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [error, setError] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const until = new Date();
      until.setDate(until.getDate() + DAYS_AHEAD);
      const res = await api.getAppointments({ doctorId, status: 'SCHEDULED', dateFrom: toLocalDateString(), dateTo: toLocalDateString(until), limit: 100 });
      setItems(pendingBookings(res.data || []));
      setError(false);
    } catch {
      setError(true);
    }
  }, [doctorId]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const remove = (id: string) => {
    setItems((current) => (current ?? []).filter((a) => a.id !== id));
    onChanged?.();
  };

  const confirmAll = async () => {
    if (!items?.length) return;
    setConfirmingAll(true);
    let done = 0;
    for (const a of items) {
      try {
        await api.confirmAppointment(a.id);
        done += 1;
      } catch {
        // Left in the list: the doctor can retry that one
      }
    }
    setConfirmingAll(false);
    if (done) toast.success(t('conf.doctor.allConfirmed', { count: done }));
    await load();
    onChanged?.();
  };

  const dayLabel = (date: string) => {
    const day = date.slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (day === toLocalDateString()) return t('conf.doctor.today');
    if (day === toLocalDateString(tomorrow)) return t('conf.doctor.tomorrow');
    return formatDate(`${day}T12:00:00`, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const count = items?.length ?? 0;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-amber-200 dark:border-amber-800/60" aria-labelledby="pending-bookings-title">
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 id="pending-bookings-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('conf.doctor.title')}</h2>
            {count > 0 && (
              <span className="inline-flex min-w-[1.5rem] justify-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">{count}</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{t('conf.doctor.help')}</p>
        </div>
        {count > 1 && (
          <button
            type="button"
            onClick={confirmAll}
            disabled={confirmingAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-600 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-60 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-900/30"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            {confirmingAll ? t('conf.doctor.sending') : t('conf.doctor.confirmAll', { count })}
          </button>
        )}
      </div>

      {error ? (
        <p className="p-5 text-sm text-red-600 dark:text-red-400">{t('conf.doctor.loadFailed')}</p>
      ) : items === null ? (
        <div className="p-5 space-y-3" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
          ))}
        </div>
      ) : count === 0 ? (
        <div className="flex items-center gap-3 p-5 text-sm text-gray-600 dark:text-gray-300">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" aria-hidden="true">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          {t('conf.doctor.allDone')}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.map((a) => {
            const name = `${a.patient?.firstName ?? ''} ${a.patient?.lastName ?? ''}`.trim();
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
                <div className="w-24 shrink-0 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">{dayLabel(a.appointmentDate)}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{formatTime(a.startTime)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900 dark:text-white">{name}</p>
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                    {tEnum(a.type)}
                    {a.reason ? ` · ${a.reason}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={`/dashboard/appointments/${a.id}`} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-lime-600 dark:text-gray-400 dark:hover:text-lime-400">
                    {t('conf.doctor.view')}
                  </Link>
                  <ConfirmBookingButton appointmentId={a.id} patientName={name} onConfirmed={() => remove(a.id)} size="sm" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
