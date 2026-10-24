'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/language-context';
import type { TeleRole } from '@/lib/teleconsultation';
import { VideoTile, cancelBtn, cardClass, inputClass, labelClass, primaryBtn } from './ui';

export function ConsentStep({ text, busy, onAccept, onCancel }: { text: string; busy: boolean; onAccept: () => void; onCancel: () => void }) {
  const { t } = useLanguage();
  return (
    <section className={`${cardClass} p-6 space-y-4`} aria-labelledby="tele-consent-title">
      <h2 id="tele-consent-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('tele.consent.title')}</h2>
      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed max-h-80 overflow-y-auto">{text}</div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={cancelBtn} onClick={onCancel} disabled={busy}>{t('tele.cancel')}</button>
        <button type="button" className={primaryBtn} onClick={onAccept} disabled={busy}>{t('tele.consent.accept')}</button>
      </div>
    </section>
  );
}

type DeviceProblem = '' | 'denied' | 'unavailable';

/**
 * Camera and microphone check before joining. Nothing is requested until the person asks for it;
 * joining works with no device at all. The chosen stream is handed to the call (and stopped by the page).
 */
export function DeviceCheck({ role, stream, onStream, busy, onJoin }: {
  role: TeleRole;
  stream: MediaStream | null;
  onStream: (stream: MediaStream | null) => void;
  busy: boolean;
  onJoin: (stream: MediaStream | null) => void;
}) {
  const { t } = useLanguage();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [micId, setMicId] = useState('');
  const [problem, setProblem] = useState<DeviceProblem>('');
  const [asking, setAsking] = useState(false);
  const streamRef = useRef(stream);
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list.filter((d) => d.kind === 'videoinput' || d.kind === 'audioinput'));
  }, []);

  /** Ask for the chosen devices ('' = none); replaces the current stream */
  const acquire = useCallback(
    async (camera: string | null, mic: string | null) => {
      setProblem('');
      setAsking(true);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      onStream(null);
      const wantVideo = camera !== '';
      const wantAudio = mic !== '';
      if (!wantVideo && !wantAudio) {
        setAsking(false);
        return;
      }
      const constraints: MediaStreamConstraints = {
        video: wantVideo ? (camera ? { deviceId: { exact: camera } } : true) : false,
        audio: wantAudio ? (mic ? { deviceId: { exact: mic } } : true) : false,
      };
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unavailable'), { name: 'NotFoundError' });
        let next: MediaStream;
        try {
          next = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          // No camera: try the microphone alone
          if ((err as Error).name === 'NotFoundError' && wantVideo && wantAudio) next = await navigator.mediaDevices.getUserMedia({ audio: constraints.audio });
          else throw err;
        }
        onStream(next);
        setCameraId(next.getVideoTracks()[0]?.getSettings().deviceId ?? '');
        setMicId(next.getAudioTracks()[0]?.getSettings().deviceId ?? '');
        await refreshDevices();
      } catch (err) {
        setProblem((err as Error).name === 'NotAllowedError' || (err as Error).name === 'SecurityError' ? 'denied' : 'unavailable');
      } finally {
        setAsking(false);
      }
    },
    [onStream, refreshDevices]
  );

  /** Drop one kind of track and join with what is left */
  const joinWithout = (kind: 'video' | 'audio') => {
    const current = streamRef.current;
    if (!current) return onJoin(null);
    const kept = current.getTracks().filter((track) => track.kind !== kind);
    current.getTracks().filter((track) => track.kind === kind).forEach((track) => track.stop());
    const next = kept.length ? new MediaStream(kept) : null;
    onStream(next);
    onJoin(next);
  };

  const cameras = devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
  const mics = devices.filter((d) => d.kind === 'audioinput' && d.deviceId);

  return (
    <section className={`${cardClass} p-6 space-y-4`} aria-labelledby="tele-devices-title">
      <h2 id="tele-devices-title" className="text-lg font-semibold text-gray-900 dark:text-white">{t('tele.devices.title')}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <VideoTile stream={stream} muted mirrored className="aspect-video rounded-lg" placeholder={t('tele.devices.noPreview')} />
        <div className="space-y-3">
          {!stream && (
            <button type="button" className={primaryBtn} onClick={() => acquire(null, null)} disabled={asking}>
              {t('tele.devices.enable')}
            </button>
          )}
          {stream && (
            <>
              <div>
                <label className={labelClass} htmlFor="tele-camera">{t('tele.devices.camera')}</label>
                <select id="tele-camera" className={inputClass} value={cameraId} disabled={asking} onChange={(e) => acquire(e.target.value, micId || null)}>
                  <option value="">{t('tele.devices.none')}</option>
                  {cameras.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `${t('tele.devices.camera')} ${i + 1}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="tele-mic">{t('tele.devices.microphone')}</label>
                <select id="tele-mic" className={inputClass} value={micId} disabled={asking} onChange={(e) => acquire(cameraId || null, e.target.value)}>
                  <option value="">{t('tele.devices.none')}</option>
                  {mics.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `${t('tele.devices.microphone')} ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {problem && <p className="text-sm text-amber-700 dark:text-amber-300">{t(problem === 'denied' ? 'tele.devices.denied' : 'tele.devices.unavailable')}</p>}
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('tele.devices.privacy')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('tele.devices.network')}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {stream?.getVideoTracks().length ? <button type="button" className={cancelBtn} onClick={() => joinWithout('video')} disabled={busy}>{t('tele.devices.withoutCamera')}</button> : null}
        {stream?.getAudioTracks().length ? <button type="button" className={cancelBtn} onClick={() => joinWithout('audio')} disabled={busy}>{t('tele.devices.withoutMic')}</button> : null}
        <button type="button" className={primaryBtn} onClick={() => onJoin(stream)} disabled={busy || asking}>
          {busy ? t('tele.joining') : t(role === 'DOCTOR' ? 'tele.start' : 'tele.joinWaitingRoom')}
        </button>
      </div>
    </section>
  );
}
