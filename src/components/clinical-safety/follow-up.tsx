'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { freeSlotTimes, type FollowUpAppointment, type FollowUpType } from '@/lib/clinical-safety';
import { DialogShell, ErrorBox, cancelBtn, inputClass, labelClass, messageOf, primaryBtn } from '@/components/inpatient/ui';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Default follow-up day: one week later, moved off Sunday */
const inAWeekIso = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Books the follow-up of a consultation with the same doctor; free times come from the doctor's availability */
export function FollowUpDialog({
  consultationId,
  doctorId,
  initialDate,
  onClose,
  onBooked,
}: {
  consultationId: string;
  doctorId: string;
  initialDate?: string;
  onClose: () => void;
  onBooked: () => void;
}) {
  const { t } = useLanguage();
  const [date, setDate] = useState(initialDate && initialDate >= todayIso() ? initialDate : inAWeekIso());
  const [type, setType] = useState<FollowUpType>('IN_PERSON');
  const [reason, setReason] = useState('');
  // Free times kept with the day they belong to; another day on screen means they are loading
  const [day, setDay] = useState<{ date: string; slots: string[]; working: boolean } | null>(null);
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getDoctorAvailability(doctorId, date)
      .then((a) => alive && setDay({ date, slots: freeSlotTimes(a.slots), working: a.isWorkingDay }))
      .catch((err) => {
        if (!alive) return;
        setDay({ date, slots: [], working: true });
        setError(messageOf(err, t('cs.followUp.failed')));
      });
    return () => {
      alive = false;
    };
  }, [doctorId, date, t]);
  const slots = day?.date === date ? day.slots : null;
  const working = day?.date === date ? day.working : true;

  const submit = async () => {
    if (!time) return setError(t('cs.followUp.pickSlot'));
    setSaving(true);
    setError('');
    try {
      await api.bookFollowUp(consultationId, { date, startTime: time, type, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      onBooked();
    } catch (err) {
      setError(messageOf(err, t('cs.followUp.failed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={t('cs.followUp.book')}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('cs.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={saving || !time}>{saving ? t('cs.saving') : t('cs.confirm')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="fu-date" className={labelClass}>{t('cs.followUp.date')}</label>
          <input id="fu-date" type="date" min={todayIso()} value={date} onChange={(e) => {
              if (!e.target.value) return;
              setDate(e.target.value);
              setTime('');
            }} className={inputClass} />
        </div>
        <fieldset>
          <legend className={labelClass}>{t('cs.followUp.type')}</legend>
          <div className="flex gap-2">
            {(['IN_PERSON', 'VIDEO'] as FollowUpType[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={type === k}
                onClick={() => setType(k)}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm ${type === k ? 'border-lime-600 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
              >
                {k === 'IN_PERSON' ? t('cs.followUp.typeInPerson') : t('cs.followUp.typeVideo')}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <div>
        <p className={labelClass}>{t('cs.followUp.slots')}</p>
        {slots === null && <p className="text-sm text-gray-500">{t('cs.followUp.loadingSlots')}</p>}
        {slots !== null && !working && <p className="text-sm text-gray-500">{t('cs.followUp.notWorking')}</p>}
        {slots !== null && working && slots.length === 0 && <p className="text-sm text-gray-500">{t('cs.followUp.noSlots')}</p>}
        {slots !== null && slots.length > 0 && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('cs.followUp.slots')}>
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={time === s}
                onClick={() => setTime(s)}
                className={`px-3 py-1.5 rounded-md border text-sm tabular-nums ${time === s ? 'border-lime-600 bg-lime-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <label htmlFor="fu-reason" className={labelClass}>{t('cs.followUp.reason')}</label>
        <input id="fu-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('cs.followUp.reasonPh')} className={inputClass} />
      </div>
    </DialogShell>
  );
}

/** Follow-up line: booked appointment, or the button to book it */
export function FollowUpSummary({
  appointment,
  canBook,
  onBook,
  hint,
}: {
  appointment: FollowUpAppointment | null | undefined;
  canBook: boolean;
  onBook: () => void;
  hint?: string;
}) {
  const { t, formatDate, formatTime, tEnum } = useLanguage();
  if (appointment) {
    return (
      <p className="text-sm text-lime-800 dark:text-lime-300">
        {t('cs.followUp.bookedOn', { date: formatDate(appointment.date), time: formatTime(appointment.startTime) })} · {tEnum(appointment.type)}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={primaryBtn} onClick={onBook} disabled={!canBook}>{t('cs.followUp.book')}</button>
      {hint && <span className="text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
    </div>
  );
}
