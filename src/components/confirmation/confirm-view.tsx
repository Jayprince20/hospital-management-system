'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type AppointmentConfirmationInfo } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { PublicShell } from '@/components/feedback/public-shell';

type Appointment = AppointmentConfirmationInfo['appointment'];
type State =
  | { kind: 'loading' }
  | { kind: 'open'; appointment: Appointment }
  | { kind: 'done'; action: 'confirm' | 'cancel'; appointment: Appointment }
  | { kind: 'closed'; appointment: Appointment }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string };

const CLOSED = ['CANCELLED', 'COMPLETED', 'NO_SHOW', 'CHECKED_IN', 'IN_PROGRESS'];

/** Public page from the reminder SMS: confirm or cancel one appointment (no login) */
export function ConfirmView({ token }: { token: string }) {
  const { t, formatDate, formatTime } = useLanguage();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const load = useCallback(async () => {
    try {
      const { appointment } = await api.getAppointmentConfirmation(token);
      setState(CLOSED.includes(appointment.status) ? { kind: 'closed', appointment } : { kind: 'open', appointment });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) setState({ kind: 'invalid' });
      else setState({ kind: 'error', message: err instanceof Error && err.message ? err.message : t('conf.link.loadFailed') });
    }
  }, [token, t]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const respond = async (action: 'confirm' | 'cancel') => {
    if (state.kind !== 'open') return;
    setBusy(true);
    setProblem('');
    try {
      const result = await api.respondToAppointmentConfirmation(token, action, action === 'cancel' && reason.trim() ? reason.trim() : undefined);
      setState({ kind: 'done', action, appointment: result?.appointment ?? state.appointment });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) await load();
      else if (err instanceof ApiError && err.status === 401) setState({ kind: 'invalid' });
      else setProblem(err instanceof Error && err.message ? err.message : t('conf.link.failed'));
    } finally {
      setBusy(false);
    }
  };

  const summary = (a: Appointment) => (
    <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-base">
      <dt className="text-gray-600 dark:text-gray-400">{t('conf.link.date')}</dt>
      <dd className="col-span-2 font-semibold text-gray-900 dark:text-white">{formatDate(a.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</dd>
      <dt className="text-gray-600 dark:text-gray-400">{t('conf.link.time')}</dt>
      <dd className="col-span-2 font-semibold text-gray-900 dark:text-white">{formatTime(a.startTime)}</dd>
      {a.doctorName && (
        <>
          <dt className="text-gray-600 dark:text-gray-400">{t('conf.link.doctor')}</dt>
          <dd className="col-span-2 text-gray-900 dark:text-white">{a.doctorName}</dd>
        </>
      )}
      {a.department && (
        <>
          <dt className="text-gray-600 dark:text-gray-400">{t('conf.link.department')}</dt>
          <dd className="col-span-2 text-gray-900 dark:text-white">{a.department}</dd>
        </>
      )}
    </dl>
  );

  return (
    <PublicShell title={t('conf.link.title')}>
      {state.kind === 'loading' && <p className="text-gray-500 dark:text-gray-400">{t('fb.loading')}</p>}
      {state.kind === 'invalid' && (
        <div className="rounded-xl border-2 border-red-500 bg-red-50 p-5 text-red-900 dark:bg-red-900/20 dark:text-red-200">
          <p className="text-lg font-bold">{t('conf.link.invalid')}</p>
          <p className="mt-1 text-sm">{t('conf.link.invalidHelp')}</p>
        </div>
      )}
      {state.kind === 'error' && <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">{state.message}</p>}

      {state.kind === 'open' && (
        <div className="space-y-5">
          <p className="text-lg text-gray-900 dark:text-white">
            {state.appointment.patientFirstName ? t('conf.link.hello', { name: state.appointment.patientFirstName }) : t('conf.link.helloAnon')}
          </p>
          {summary(state.appointment)}
          {state.appointment.status === 'CONFIRMED' && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-200">{t('conf.link.alreadyConfirmed')}</p>}
          {!cancelling ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {state.appointment.status !== 'CONFIRMED' && (
                <button type="button" disabled={busy} onClick={() => respond('confirm')} className="h-14 rounded-xl bg-green-600 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                  {t('conf.link.confirm')}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelling(true)}
                className="h-14 rounded-xl border-2 border-red-300 text-lg font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
              >
                {t('conf.link.cancel')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label htmlFor="cancel-reason" className="block text-base font-medium text-gray-900 dark:text-white">
                {t('conf.link.reason')}
              </label>
              <textarea
                id="cancel-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" disabled={busy} onClick={() => respond('cancel')} className="h-14 rounded-xl bg-red-600 text-lg font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  {t('conf.link.cancelConfirm')}
                </button>
                <button type="button" disabled={busy} onClick={() => setCancelling(false)} className="h-14 rounded-xl border border-gray-300 text-lg text-gray-700 dark:border-gray-600 dark:text-gray-300">
                  {t('conf.link.keep')}
                </button>
              </div>
            </div>
          )}
          {problem && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {problem}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('conf.link.help')}</p>
        </div>
      )}

      {state.kind === 'done' && (
        <div className={`rounded-xl border-2 p-5 ${state.action === 'confirm' ? 'border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200' : 'border-gray-400 bg-gray-50 text-gray-900 dark:bg-gray-700/40 dark:text-gray-100'}`}>
          <p className="text-lg font-bold">{state.action === 'confirm' ? t('conf.link.confirmed') : t('conf.link.cancelled')}</p>
          <p className="mt-1 text-sm">{state.action === 'confirm' ? t('conf.link.confirmedHelp') : t('conf.link.cancelledHelp')}</p>
          <div className="mt-4">{summary(state.appointment)}</div>
        </div>
      )}

      {state.kind === 'closed' && (
        <div className="space-y-4">
          <p className="rounded-xl border-2 border-gray-300 bg-gray-50 p-4 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-700/40 dark:text-gray-100">
            {t(state.appointment.status === 'CANCELLED' ? 'conf.link.closedCancelled' : 'conf.link.closedPast')}
          </p>
          {summary(state.appointment)}
        </div>
      )}
    </PublicShell>
  );
}
