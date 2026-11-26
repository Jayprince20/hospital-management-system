'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { canConfirmPresence, confirmationBadge } from '@/lib/patient-extras';

type BadgeInput = Parameters<typeof confirmationBadge>[0];

/** How an appointment was confirmed (SMS, link, portal, phone, desk), or "not confirmed" when it is close */
export function ConfirmationBadge({ appointment }: { appointment: BadgeInput }) {
  const { t } = useLanguage();
  const kind = confirmationBadge(appointment);
  if (!kind) return null;
  const unconfirmed = kind === 'UNCONFIRMED';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
        unconfirmed ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
      }`}
    >
      {unconfirmed ? '!' : '✓'} {t(`conf.badge.${kind}`)}
    </span>
  );
}

/** Desk: the patient confirmed by phone */
export function ConfirmByPhoneButton({ appointmentId, onConfirmed }: { appointmentId: string; onConfirmed: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await api.confirmAppointment(appointmentId, 'PHONE');
      toast.success(t('conf.phone.done'));
      onConfirmed();
    } catch (err) {
      toast.error(t('conf.failed'), err instanceof Error ? err.message : '');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={confirm}
      disabled={busy}
      className="px-3 py-1.5 text-xs rounded-lg border border-green-300 text-green-800 hover:bg-green-50 disabled:opacity-50 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/30"
    >
      {t('conf.phone.action')}
    </button>
  );
}

/** Doctor: validate one of their own bookings in one click (the patient is notified) */
export function ConfirmBookingButton({
  appointmentId,
  patientName,
  onConfirmed,
  size = 'md',
  className = '',
}: {
  appointmentId: string;
  patientName: string;
  onConfirmed: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await api.confirmAppointment(appointmentId);
      toast.success(t('conf.doctor.done'), t('conf.doctor.doneMessage', { name: patientName }));
      onConfirmed();
    } catch (err) {
      toast.error(t('conf.failed'), err instanceof Error ? err.message : '');
    } finally {
      setBusy(false);
    }
  };
  const sizing = size === 'lg' ? 'px-4 py-3 text-sm' : size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-3.5 py-2 text-sm';
  return (
    <button
      type="button"
      onClick={confirm}
      disabled={busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 font-medium text-white shadow-sm transition-colors hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-60 ${sizing} ${className}`}
    >
      {busy ? (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {busy ? t('conf.doctor.sending') : t('conf.doctor.action')}
    </button>
  );
}

/** Patient portal: "Confirmer ma présence" on an upcoming scheduled appointment */
export function ConfirmPresenceButton({
  appointment,
  onConfirmed,
}: {
  appointment: { id: string; status: string; appointmentDate?: string | null; date?: string | null };
  onConfirmed: () => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!canConfirmPresence(appointment)) return null;
  const confirm = async () => {
    setBusy(true);
    try {
      await api.confirmAppointment(appointment.id);
      toast.success(t('conf.portal.done'));
      onConfirmed();
    } catch (err) {
      toast.error(t('conf.failed'), err instanceof Error ? err.message : '');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={confirm} disabled={busy} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
      {busy ? t('conf.portal.sending') : t('conf.portal.action')}
    </button>
  );
}
