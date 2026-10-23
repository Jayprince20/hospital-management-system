'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type Appointment } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { confirmationBadge, tomorrowString } from '@/lib/patient-extras';
import { ConfirmByPhoneButton, ConfirmationBadge } from './confirmation-ui';

/**
 * Desk: tomorrow's appointments and whether patients confirmed (SMS reply, link, portal).
 * The unconfirmed ones come first so the desk can call them.
 */
export function TomorrowConfirmations() {
  const { t, formatTime, formatDate, tEnum } = useLanguage();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState(false);
  const tomorrow = tomorrowString();

  const load = useCallback(async () => {
    try {
      const res = await api.getAppointments({ dateFrom: tomorrow, dateTo: tomorrow, limit: 100 });
      const open = (res.data ?? []).filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED');
      open.sort((a, b) => {
        const ua = confirmationBadge(a) === 'UNCONFIRMED' ? 0 : 1;
        const ub = confirmationBadge(b) === 'UNCONFIRMED' ? 0 : 1;
        return ua - ub || a.startTime.localeCompare(b.startTime);
      });
      setAppointments(open);
      setError(false);
    } catch {
      setError(true);
    }
  }, [tomorrow]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const unconfirmed = (appointments ?? []).filter((a) => confirmationBadge(a) === 'UNCONFIRMED').length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('conf.tomorrow.title', { date: formatDate(tomorrow, { weekday: 'long', day: 'numeric', month: 'long' }) })}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('conf.tomorrow.help')}</p>
        </div>
        {appointments && (
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${unconfirmed ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'}`}>
            {t('conf.tomorrow.count', { unconfirmed, total: appointments.length })}
          </span>
        )}
      </div>
      {error && <p className="p-4 text-sm text-red-600 dark:text-red-400">{t('conf.tomorrow.loadFailed')}</p>}
      {appointments && appointments.length === 0 && <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('conf.tomorrow.none')}</p>}
      {appointments && appointments.length > 0 && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {appointments.map((apt) => (
            <li key={apt.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="w-14 text-sm font-semibold text-gray-900 dark:text-white">{formatTime(apt.startTime)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {apt.patient.firstName} {apt.patient.lastName}
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{apt.patient.phoneNumber}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Dr {apt.doctor.firstName} {apt.doctor.lastName} · {tEnum(apt.type)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ConfirmationBadge appointment={apt} />
                {confirmationBadge(apt) === 'UNCONFIRMED' && <ConfirmByPhoneButton appointmentId={apt.id} onConfirmed={load} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
