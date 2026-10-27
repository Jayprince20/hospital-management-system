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
