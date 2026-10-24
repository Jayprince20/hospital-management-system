'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { LoadingState } from '@/components/ui';
import { readActingProfile } from '@/lib/patient-extras';
import { formatCountdown, type TeleconsultDetail, type TeleconsultOutcome } from '@/lib/teleconsultation';
import { ConsentStep, DeviceCheck } from '@/components/teleconsultation/precall';
import { CallRoom } from '@/components/teleconsultation/call-room';
import { ErrorBox, cancelBtn, cardClass, messageOf, primaryBtn, useTeleError } from '@/components/teleconsultation/ui';

type Stage = 'prejoin' | 'call' | 'left' | 'ended';

/**
 * Video consultation, full screen (outside the dashboard chrome), for the appointment's doctor and patient
 * (or a relative acting for the patient: the API client sends the acting-patient header).
 */
export default function TeleconsultationPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { t, formatDateTime } = useLanguage();
  const teleError = useTeleError();

  const [detail, setDetail] = useState<TeleconsultDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [stage, setStage] = useState<Stage>('prejoin');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [ended, setEnded] = useState<{ outcome: TeleconsultOutcome | null; byDoctor: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const streamRef = useRef<MediaStream | null>(null);

  const load = useCallback(() => {
    api
      .getTeleconsultation(appointmentId)
      .then((d) => {
        setDetail(d);
        setLoadError('');
      })
      .catch((err) => setLoadError(messageOf(err, t('tele.loadFailed'))));
  }, [appointmentId, t]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  // Countdown to the opening of the waiting room; reload when it opens
  const opensAt = detail && !detail.canJoin ? new Date(detail.joinOpensAt).getTime() : null;
  useEffect(() => {
    if (opensAt === null || opensAt <= Date.now()) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= opensAt) load();
    }, 1000);
    return () => clearInterval(timer);
  }, [opensAt, load]);

  // Devices are released when the page goes away
  const keepStream = useCallback((next: MediaStream | null) => {
    streamRef.current = next;
    setStream(next);
  }, []);
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const acceptConsent = async () => {
    setBusy(true);
    setActionError('');
    try {
      await api.acceptTeleconsultationConsent(appointmentId);
      load();
    } catch (err) {
      setActionError(messageOf(err, t('tele.consent.failed')));
    } finally {
      setBusy(false);
    }
  };

  const join = async (chosen: MediaStream | null) => {
    setBusy(true);
    setActionError('');
    try {
      const fresh = await api.joinTeleconsultation(appointmentId);
      setDetail(fresh);
      keepStream(chosen);
      setStage('call');
    } catch (err) {
      setActionError(messageOf(err, t('tele.joinFailed')));
    } finally {
      setBusy(false);
    }
  };

  const onEnded = useCallback((outcome: TeleconsultOutcome | null, byDoctor: boolean) => {
    setEnded({ outcome, byDoctor });
    setStage('ended');
    streamRef.current?.getTracks().forEach((track) => track.stop());
    keepStream(null);
  }, [keepStream]);

  if (isLoading || !isAuthenticated) {
    return <FullScreen><LoadingState label={t('tele.loading')} minHeight="h-64" /></FullScreen>;
  }

  const acting = readActingProfile(typeof window === 'undefined' ? null : sessionStorage, user?.id);
  const homeHref = '/dashboard/teleconsultations';

  return (
    <FullScreen>
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('tele.title')}</h1>
          {detail && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {detail.role === 'DOCTOR' ? t('tele.withPatient', { name: detail.patient.name }) : t('tele.withDoctor', { name: detail.doctor.name })}
              {' · '}
              {t('tele.scheduledFor', { date: formatDateTime(detail.scheduledAt) })}
            </p>
          )}
          {acting && detail?.role === 'PATIENT' && (
            <p className="mt-1 inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 text-xs font-medium">
              {t('tele.actingFor', { name: `${acting.firstName} ${acting.lastName}` })}
            </p>
          )}
        </div>
        {stage !== 'call' && <Link href={homeHref} className={cancelBtn}>{t('tele.backToSpace')}</Link>}
      </header>

      {loadError && <ErrorBox message={loadError} />}
      {!detail && !loadError && <LoadingState label={t('tele.loading')} minHeight="h-64" />}

      {detail && stage === 'prejoin' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          {detail.reason && <p className="text-sm text-gray-700 dark:text-gray-300">{t('tele.reason', { reason: detail.reason })}</p>}
          <ErrorBox message={actionError} />
          {!detail.canJoin ? (
            <div className={`${cardClass} p-6 space-y-2`}>
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('tele.cannotJoin')}</h2>
              {detail.cannotJoinReason && <p className="text-sm text-gray-700 dark:text-gray-300">{teleError(detail.cannotJoinReason)}</p>}
              {opensAt !== null && opensAt > now && <p className="text-sm text-lime-700 dark:text-lime-300 tabular-nums">{t('tele.opensIn', { countdown: formatCountdown(opensAt - now) })}</p>}
            </div>
          ) : detail.consentRequired ? (
            <ConsentStep text={detail.consentText} busy={busy} onAccept={acceptConsent} onCancel={() => window.history.back()} />
          ) : (
            <DeviceCheck role={detail.role} stream={stream} onStream={keepStream} busy={busy} onJoin={join} />
          )}
        </div>
      )}

      {detail && stage === 'call' && <CallRoom detail={detail} stream={stream} onLeft={() => setStage('left')} onEnded={onEnded} />}

      {detail && stage === 'left' && (
        <div className={`${cardClass} p-6 space-y-4 max-w-xl mx-auto text-center`}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('tele.left.title')}</h2>
          <ErrorBox message={actionError} />
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={homeHref} className={cancelBtn}>{t('tele.backToSpace')}</Link>
            <button type="button" className={primaryBtn} onClick={() => join(stream)} disabled={busy}>{t('tele.rejoin')}</button>
          </div>
        </div>
      )}

      {detail && stage === 'ended' && (
        <div className={`${cardClass} p-6 space-y-3 max-w-xl mx-auto text-center`}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('tele.ended.title')}</h2>
          {ended?.byDoctor && <p className="text-sm text-gray-600 dark:text-gray-400">{t('tele.ended.byDoctor')}</p>}
          {ended?.outcome && detail.role === 'DOCTOR' && <p className="text-sm text-gray-600 dark:text-gray-400">{t(`tele.outcome.${ended.outcome}`)}</p>}
          <p className="text-sm text-gray-700 dark:text-gray-300">{t(detail.role === 'DOCTOR' ? 'tele.ended.doctorText' : 'tele.ended.patientText')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {detail.role === 'DOCTOR' ? (
              <>
                <Link href="/dashboard/teleconsultations" className={cancelBtn}>{t('tele.backToSpace')}</Link>
                {ended?.outcome !== 'NO_SHOW' && <Link href={`/dashboard/appointments/${appointmentId}/consultation`} className={primaryBtn}>{t('tele.writeUp')}</Link>}
              </>
            ) : (
              <Link href="/dashboard/my-health" className={primaryBtn}>{t('tele.ended.mySpace')}</Link>
            )}
          </div>
        </div>
      )}
    </FullScreen>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">{children}</div>;
}
