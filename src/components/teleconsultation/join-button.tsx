'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/language-context';
import { appointmentDateTime, isJoinable, joinStateAt, joinWindow } from '@/lib/teleconsultation';

/**
 * "Join the teleconsultation" on a video appointment, shown while it can be joined: patients from
 * 15 minutes before to 60 minutes after the end, the doctor any time that day (the server decides in the end).
 */
export function JoinTeleconsultButton({ appointment, isDoctor, compact = false }: {
  appointment: { id: string; type: string; status: string; appointmentDate: string; startTime: string; endTime: string };
  isDoctor: boolean;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (appointment.type !== 'VIDEO' || !isJoinable(appointment.status)) return null;
  const start = appointmentDateTime(appointment.appointmentDate, appointment.startTime);
  const end = appointmentDateTime(appointment.appointmentDate, appointment.endTime || appointment.startTime);
  const sameDay = start.toDateString() === now.toDateString();
  const open = isDoctor ? sameDay : joinStateAt(joinWindow(start, end), now) === 'open';
  if (!open) return null;

  return (
    <Link
      href={`/teleconsultation/${appointment.id}`}
      className={compact
        ? 'inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md bg-brand hover:bg-brand-hover text-white'
        : 'inline-flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-medium transition-colors'}
    >
      {t('tele.joinAppointment')}
    </Link>
  );
}
