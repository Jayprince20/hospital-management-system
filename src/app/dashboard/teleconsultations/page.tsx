'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useNotifications } from '@/context/notification-context';
import {
  JOIN_OPENS_BEFORE_MIN,
  TeleEvents,
  formatCountdown,
  isJoinable,
  type TeleconsultListItem,
} from '@/lib/teleconsultation';
import { ErrorBox, SessionBadge, cancelBtn, cardClass, inputClass, messageOf, primaryBtn } from '@/components/teleconsultation/ui';

const REFRESH_MS = 30_000;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Doctors: the day's video consultations with patients waiting live; patients: their video appointments */
export default function TeleconsultationsPage() {
  const { user } = useAuth();
  const { t, formatDateTime, formatTime } = useLanguage();
  const { getSocket, isConnected } = useNotifications();
  const isPatient = user?.role === 'PATIENT';
  const isDoctor = user?.role === 'DOCTOR';
  const [date, setDate] = useState(today);
  const [items, setItems] = useState<TeleconsultListItem[] | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    api
      .getTeleconsultations(isPatient ? undefined : date)
      .then((list) => {
        setItems(list);
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('tele.loadFailed'))));
  }, [isPatient, date, t]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // A patient entering the virtual waiting room shows up immediately
  useEffect(() => {
    if (!isConnected) return;
    const socket = getSocket();
    if (!socket) return;
    const onWaiting = ({ appointmentId }: { appointmentId: string; patientName: string }) => {
      setItems((prev) => prev?.map((item) => (item.appointmentId === appointmentId ? { ...item, patientWaiting: true } : item)) ?? prev);
    };
    socket.on(TeleEvents.WAITING, onWaiting);
    return () => {
      socket.off(TeleEvents.WAITING, onWaiting);
    };
  }, [isConnected, getSocket]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tele.list.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t(isPatient ? 'tele.list.subtitlePatient' : 'tele.list.subtitleStaff')}</p>
        </div>
        <div className="flex items-end gap-2">
          {!isPatient && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1" htmlFor="tele-date">{t('tele.list.date')}</label>
              <input id="tele-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value || today())} />
            </div>
          )}
          <button type="button" className={cancelBtn} onClick={load}>{t('tele.list.refresh')}</button>
        </div>
      </div>

      <ErrorBox message={error} />
      {items === null && !error && <p className="text-sm text-gray-500">{t('tele.loading')}</p>}
      {items?.length === 0 && <div className={`${cardClass} p-6 text-sm text-gray-500 dark:text-gray-400`}>{t('tele.list.empty')}</div>}

      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => {
            const opensAt = new Date(item.scheduledAt).getTime() - JOIN_OPENS_BEFORE_MIN * 60_000;
            const joinable = isJoinable(item.appointmentStatus, item.session);
            // Doctors may join any time that day; patients from 15 minutes before
            const open = isDoctor || now >= opensAt;
            const person = isPatient ? item.doctor : item.patient;
            return (
              <li key={item.appointmentId} className={`${cardClass} p-4 flex flex-wrap items-center gap-4 ${item.patientWaiting && joinable ? 'ring-2 ring-lime-500' : ''}`}>
                <div className="w-20 shrink-0">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums">{formatTime(item.scheduledAt)}</p>
                  {isPatient && <p className="text-xs text-gray-500">{formatDateTime(item.scheduledAt, { day: 'numeric', month: 'short' })}</p>}
                </div>
                <div className="flex-1 min-w-[12rem]">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {person?.name ?? '—'}
                    {item.patient && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        {item.patient.patientNumber}
                        {item.patient.age !== null ? ` · ${t('tele.panel.age', { age: item.patient.age })}` : ''}
                      </span>
                    )}
                    {item.doctor?.specialty && <span className="ml-2 text-xs font-normal text-gray-500">{item.doctor.specialty}</span>}
                  </p>
                  {item.reason && <p className="text-sm text-gray-600 dark:text-gray-400">{item.reason}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.patientWaiting && joinable && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200 animate-pulse">{t('tele.list.waiting')}</span>
                  )}
                  {item.session && <SessionBadge status={item.session.status} />}
                  {item.session?.outcome && <span className="text-xs text-gray-500">{t(`tele.outcome.${item.session.outcome}`)}</span>}
                  {!joinable ? (
                    <span className="text-xs text-gray-500">{t('tele.list.closed')}</span>
                  ) : user?.role === 'ADMIN' ? null : open ? (
                    <Link href={`/teleconsultation/${item.appointmentId}`} className={primaryBtn}>{t('tele.list.join')}</Link>
                  ) : (
                    <span className="text-xs text-gray-500 tabular-nums">{t('tele.list.opensIn', { countdown: formatCountdown(opensAt - now) })}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
