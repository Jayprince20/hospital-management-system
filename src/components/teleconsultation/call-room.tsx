'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useTeleconsultCall } from '@/hooks/useTeleconsultCall';
import { CHAT_MAX_LENGTH, TELE_OUTCOMES, formatElapsed, type TeleChatMessage, type TeleMedia, type TeleconsultDetail, type TeleconsultOutcome } from '@/lib/teleconsultation';
import {
  ConnectionBadge,
  ControlButton,
  DialogShell,
  ErrorBox,
  ICONS,
  Icon,
  VideoTile,
  cancelBtn,
  cardClass,
  dangerBtn,
  inputClass,
  labelClass,
  messageOf,
  primaryBtn,
  smallBtn,
  useTeleError,
} from './ui';

/** Ticks every second while `since` is set (call timer, waiting time) */
function useElapsed(since: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);
  return since === null ? '' : formatElapsed(now - since);
}

export function CallRoom({ detail, media, stream, onLeft, onEnded }: {
  detail: TeleconsultDetail;
  media: TeleMedia | null;
  stream: MediaStream | null;
  onLeft: () => void;
  onEnded: (outcome: TeleconsultOutcome | null, byDoctor: boolean) => void;
}) {
  const { t } = useLanguage();
  const teleError = useTeleError();
  const isDoctor = detail.role === 'DOCTOR';
  const call = useTeleconsultCall({ appointmentId: detail.appointmentId, role: detail.role, iceServers: detail.iceServers, localStream: stream, media });
  const [chatOpen, setChatOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [unread, setUnread] = useState(0);
  const [enteredAt] = useState(() => Date.now());
  const rootRef = useRef<HTMLDivElement>(null);
  const joinRef = useRef(call.join);
  const attempted = useRef(false);
  useEffect(() => {
    joinRef.current = call.join;
  });

  // Join the room once the socket is up (the REST join was done by the page)
  useEffect(() => {
    if (!call.ready || attempted.current) return;
    attempted.current = true;
    void joinRef.current();
  }, [call.ready]);

  // The doctor ended the consultation (for the patient; the doctor ends from the dialog)
  useEffect(() => {
    if (call.endedOutcome && !isDoctor) {
      call.leave();
      onEnded(call.endedOutcome, true);
    }
  }, [call, isDoctor, onEnded]);

  const lastCount = useRef(0);
  useEffect(() => {
    const added = call.messages.length - lastCount.current;
    lastCount.current = call.messages.length;
    if (added > 0 && !chatOpen) setUnread((n) => n + added);
  }, [call.messages.length, chatOpen]);

  const callTime = useElapsed(call.connectedSince);
  const waitingTime = useElapsed(call.peerPresent ? null : enteredAt);
  const other = isDoctor ? detail.patient.name : detail.doctor.name;
  const hasMic = Boolean(stream?.getAudioTracks().length);
  const hasCamera = Boolean(stream?.getVideoTracks().length);

  const hangUp = () => {
    call.leave();
    onLeft();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  if (call.joinError) {
    return (
      <div className={`${cardClass} p-6 space-y-4`}>
        <ErrorBox message={`${t('tele.joinFailed')} — ${teleError(call.joinError)}`} />
        <div className="flex justify-end gap-2">
          <button type="button" className={cancelBtn} onClick={onLeft}>{t('tele.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={() => void call.join()}>{t('tele.rejoin')}</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex flex-col lg:flex-row gap-4 bg-gray-950 lg:bg-transparent rounded-xl">
      <div className="flex-1 min-w-0 space-y-3">
        {/* Height capped so the controls stay on screen (header + controls ≈ 12rem) */}
        <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video w-full max-h-[calc(100dvh-12rem)]">
          {call.peerPresent ? (
            <VideoTile
              stream={call.remoteStream}
              className="absolute inset-0"
              placeholder={call.audioOnly ? t('tele.audioOnlyActive') : call.peerMedia.video ? t('tele.waitingForVideo') : t('tele.peerCameraOff')}
            >
              {!call.peerMedia.audio && <span className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 text-white text-xs">{t('tele.peerMicOff')}</span>}
            </VideoTile>
          ) : (
            <WaitingCard isDoctor={isDoctor} elapsed={waitingTime} phone={detail.patient.phone ?? null} />
          )}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {callTime && <span className="px-2 py-1 rounded bg-black/60 text-white text-xs tabular-nums">{callTime}</span>}
            <ConnectionBadge connection={call.connection} />
          </div>
          {call.quality === 'poor' && !call.audioOnly && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium">{t('tele.qualityPoor')}</div>
          )}
          <VideoTile
            stream={call.audioOnly ? null : stream}
            muted
            mirrored
            className="absolute bottom-3 right-3 w-28 sm:w-40 aspect-video rounded-lg border border-white/20 shadow-lg"
            placeholder={<span className="text-xs">{hasCamera ? t('tele.devices.noPreview') : t('tele.noDevice')}</span>}
          >
            <span className="absolute top-1 left-1 px-1.5 rounded bg-black/60 text-white text-[10px]">{t('tele.you')}</span>
          </VideoTile>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 py-2">
          <ControlButton label={t(call.audioEnabled ? 'tele.ctrl.micOff' : 'tele.ctrl.micOn')} icon={ICONS.mic} off={!call.audioEnabled} onClick={call.toggleAudio} disabled={!hasMic} />
          <ControlButton label={t(call.videoEnabled ? 'tele.ctrl.camOff' : 'tele.ctrl.camOn')} icon={ICONS.camera} off={!call.videoEnabled} onClick={call.toggleVideo} disabled={!hasCamera || call.audioOnly} />
          <ControlButton label={t(call.audioOnly ? 'tele.ctrl.videoBack' : 'tele.ctrl.audioOnly')} icon={ICONS.audioOnly} active={call.audioOnly} onClick={() => call.setAudioOnly(!call.audioOnly)} disabled={!hasCamera} />
          <span className="relative">
            <ControlButton label={t('tele.ctrl.chat')} icon={ICONS.chat} active={chatOpen} onClick={() => { setChatOpen((open) => !open); setUnread(0); }} />
            {unread > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">{unread}</span>}
          </span>
          <ControlButton label={t('tele.ctrl.fullscreen')} icon={ICONS.fullscreen} onClick={toggleFullscreen} />
          <ControlButton label={t('tele.ctrl.hangup')} icon={ICONS.hangup} danger onClick={hangUp} />
          {isDoctor && <button type="button" className={dangerBtn} onClick={() => setEnding(true)}>{t('tele.ctrl.end')}</button>}
        </div>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">{isDoctor ? t('tele.withPatient', { name: other }) : t('tele.withDoctor', { name: other })}</p>
      </div>

      {(chatOpen || isDoctor) && (
        <aside className="w-full lg:w-80 shrink-0 space-y-4">
          {chatOpen && <ChatPanel messages={call.messages} onSend={call.sendChat} />}
          {isDoctor && <PatientPanel detail={detail} />}
        </aside>
      )}

      {ending && (
        <EndDialog
          appointmentId={detail.appointmentId}
          onClose={() => setEnding(false)}
          onDone={(outcome) => {
            setEnding(false);
            call.leave();
            onEnded(outcome, false);
          }}
        />
      )}
    </div>
  );
}

function WaitingCard({ isDoctor, elapsed, phone }: { isDoctor: boolean; elapsed: string; phone: string | null }) {
  const { t } = useLanguage();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-gray-100 p-6 gap-3">
      <span className="w-10 h-10 rounded-full border-4 border-lime-400 border-t-transparent animate-spin" aria-hidden="true" />
      <h2 className="text-lg font-semibold">{t(isDoctor ? 'tele.waiting.doctorTitle' : 'tele.waiting.patientTitle')}</h2>
      <p className="text-sm text-gray-300 max-w-md">{t(isDoctor ? 'tele.waiting.doctorText' : 'tele.waiting.patientText')}</p>
      {elapsed && <p className="text-xs text-gray-400 tabular-nums">{t('tele.waiting.elapsed', { time: elapsed })}</p>}
      {isDoctor && phone && (
        <a href={`tel:${phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm">
          <Icon path={ICONS.phone} className="w-4 h-4" />
          {t('tele.callByPhone')} · {phone}
        </a>
      )}
      {!isDoctor && (
        <ul className="text-xs text-gray-400 space-y-1 max-w-md">
          <li>{t('tele.waiting.tip1')}</li>
          <li>{t('tele.waiting.tip2')}</li>
        </ul>
      )}
    </div>
  );
}

function ChatPanel({ messages, onSend }: { messages: TeleChatMessage[]; onSend: (text: string) => void }) {
  const { t, formatTime } = useLanguage();
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);
  const send = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };
  return (
    <section className={`${cardClass} flex flex-col h-80`} aria-label={t('tele.chat.title')}>
      <h3 className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white">{t('tele.chat.title')}</h3>
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2" aria-live="polite">
        {messages.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{t('tele.chat.empty')}</p>}
        {messages.map((m, i) => (
          <div key={`${m.at}-${i}`} className="text-sm">
            <span className="font-medium text-gray-900 dark:text-white">{m.name}</span>
            <span className="ml-2 text-xs text-gray-400">{formatTime(m.at)}</span>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{m.text}</p>
          </div>
        ))}
      </div>
      <form className="p-2 border-t border-gray-100 dark:border-gray-700 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input className={inputClass} value={text} maxLength={CHAT_MAX_LENGTH} onChange={(e) => setText(e.target.value)} placeholder={t('tele.chat.placeholder')} aria-label={t('tele.chat.placeholder')} />
        <button type="submit" className={primaryBtn} disabled={!text.trim()}>{t('tele.chat.send')}</button>
      </form>
    </section>
  );
}

interface PatientSummary {
  allergies: string[];
  chronicConditions: string[];
  treatments: Array<{ id: string; date: string; medications: string }>;
}

/** Doctor side panel: what matters while talking (allergies, history, recent treatments) */
function PatientPanel({ detail }: { detail: TeleconsultDetail }) {
  const { t, formatDate } = useLanguage();
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    api
      .getPatient(detail.patient.id)
      .then((p) => {
        if (!current) return;
        setSummary({
          allergies: p.allergies ?? [],
          chronicConditions: p.chronicConditions ?? [],
          treatments: (p.prescriptions ?? []).slice(0, 3).map((rx) => ({ id: rx.id, date: rx.date, medications: rx.medications.map((m) => `${m.name} ${m.dosage}`.trim()).join(', ') })),
        });
      })
      .catch((err) => current && setError(messageOf(err, t('tele.panel.loadFailed'))));
    return () => {
      current = false;
    };
  }, [detail.patient.id, t]);

  const p = detail.patient;
  return (
    <section className={`${cardClass} p-4 space-y-3 text-sm`} aria-label={t('tele.panel.title')}>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">{p.name}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {p.patientNumber}
          {p.age !== null ? ` · ${t('tele.panel.age', { age: p.age })}` : ''}
          {p.phone ? ` · ${p.phone}` : ''}
        </p>
        {detail.reason && <p className="mt-1 text-gray-700 dark:text-gray-300">{t('tele.reason', { reason: detail.reason })}</p>}
      </div>
      <ErrorBox message={error} />
      {summary && (
        <>
          <div>
            <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{t('tele.panel.allergies')}</h4>
            {summary.allergies.length ? (
              <p className="text-red-700 dark:text-red-300 font-medium">{summary.allergies.join(', ')}</p>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">{t('tele.panel.noAllergies')}</p>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{t('tele.panel.conditions')}</h4>
            <p className="text-gray-700 dark:text-gray-300">{summary.chronicConditions.length ? summary.chronicConditions.join(', ') : t('tele.panel.none')}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{t('tele.panel.treatments')}</h4>
            {summary.treatments.length ? (
              <ul className="space-y-1">
                {summary.treatments.map((rx) => (
                  <li key={rx.id} className="text-gray-700 dark:text-gray-300">
                    <span className="text-xs text-gray-500">{formatDate(rx.date)}</span> — {rx.medications || '—'}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">{t('tele.panel.none')}</p>
            )}
          </div>
        </>
      )}
      <a href={`/dashboard/appointments/${detail.appointmentId}/consultation`} target="_blank" rel="noopener noreferrer" className={`${smallBtn} inline-block`}>
        {t('tele.writeUp')}
      </a>
    </section>
  );
}

function EndDialog({ appointmentId, onClose, onDone }: { appointmentId: string; onClose: () => void; onDone: (outcome: TeleconsultOutcome) => void }) {
  const { t } = useLanguage();
  const [outcome, setOutcome] = useState<TeleconsultOutcome>('COMPLETED');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api.endTeleconsultation(appointmentId, { outcome, ...(notes.trim() ? { notes: notes.trim() } : {}) });
      onDone(outcome);
    } catch (err) {
      setError(messageOf(err, t('tele.end.failed')));
      setBusy(false);
    }
  };
  return (
    <DialogShell
      title={t('tele.end.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose} disabled={busy}>{t('tele.cancel')}</button>
          <button type="button" className={dangerBtn} onClick={submit} disabled={busy}>{t('tele.end.confirm')}</button>
        </>
      }
    >
      <fieldset>
        <legend className={labelClass}>{t('tele.end.outcome')}</legend>
        <div className="space-y-2">
          {TELE_OUTCOMES.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="radio" name="tele-outcome" value={value} checked={outcome === value} onChange={() => setOutcome(value)} className="text-lime-600" />
              {t(`tele.outcome.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className={labelClass} htmlFor="tele-end-notes">{t('tele.end.notes')}</label>
        <textarea id="tele-end-notes" className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('tele.end.notesPlaceholder')} />
      </div>
      <ErrorBox message={error} />
    </DialogShell>
  );
}
