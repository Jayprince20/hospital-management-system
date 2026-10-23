'use client';

import { useState } from 'react';
import { api, type ImagingOrder, type ImagingOrderSummary } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { ReasonDialog } from '@/components/inpatient/dialogs';
import { scheduleInPast } from '@/lib/imaging';
import { DialogShell, ErrorBox, cancelBtn, inputClass, labelClass, messageOf, primaryBtn } from './ui';

type OrderLike = Pick<ImagingOrderSummary, 'id' | 'number' | 'scheduledAt' | 'room' | 'patient'> & { exam: { name: string; preparation?: string | null; durationMinutes?: number } };

/** "2026-10-24T09:30" for a datetime-local input, in local time */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Give the patient an appointment for the exam and tell them how to prepare */
export function ScheduleDialog({ order, onClose, onDone }: { order: OrderLike; onClose: () => void; onDone: (order: ImagingOrder) => void }) {
  const { t } = useLanguage();
  const initial = order.scheduledAt ? new Date(order.scheduledAt) : (() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15 + 15, 0, 0);
    return d;
  })();
  const [when, setWhen] = useState(toLocalInput(initial));
  const [room, setRoom] = useState(order.room ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!when || scheduleInPast(when)) return setError(t('img.schedule.past'));
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateImagingOrder(order.id, { action: 'schedule', scheduledAt: new Date(when).toISOString(), ...(room.trim() ? { room: room.trim() } : {}) });
      onDone(updated);
    } catch (err) {
      setError(messageOf(err, t('img.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={t('img.schedule.title', { number: order.number })}
      subtitle={`${order.patient.name} · ${order.exam.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('img.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('img.schedule.confirm')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label htmlFor="img-when" className={labelClass}>{t('img.schedule.when')}</label>
        <input id="img-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="img-room" className={labelClass}>{t('img.schedule.room')}</label>
        <input id="img-room" value={room} onChange={(e) => setRoom(e.target.value)} className={inputClass} placeholder={t('img.schedule.roomPlaceholder')} />
      </div>
      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-900 dark:text-blue-100">
        <p className="font-medium">{t('img.schedule.tellPatient')}</p>
        <p className="mt-1">{order.exam.preparation ? order.exam.preparation : t('img.schedule.noPreparation')}</p>
        <p className="mt-1 text-xs opacity-80">{t('img.schedule.smsHint')}</p>
      </div>
    </DialogShell>
  );
}

/** Cancel an exam that hasn't been reported (a reason is required) */
export function CancelOrderDialog({ order, onClose, onDone }: { order: Pick<ImagingOrderSummary, 'id' | 'number'>; onClose: () => void; onDone: (order: ImagingOrder) => void }) {
  const { t } = useLanguage();
  return (
    <ReasonDialog
      title={t('img.cancelOrder.title', { number: order.number })}
      label={t('img.cancelOrder.reason')}
      confirmLabel={t('img.cancelOrder.confirm')}
      danger
      onClose={onClose}
      onConfirm={async (reason) => {
        const updated = await api.updateImagingOrder(order.id, { action: 'cancel', reason });
        onDone(updated);
      }}
    />
  );
}
