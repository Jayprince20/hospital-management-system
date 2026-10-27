'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { localizeServerMessage } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import type { CallConnection, TeleconsultStatus } from '@/lib/teleconsultation';

export { DialogShell, ErrorBox, cancelBtn, cardClass, dangerBtn, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from '@/components/inpatient/ui';

/** Join errors from the call hook ('socket', 'timeout') or a server message (English, translated) */
export function useTeleError() {
  const { t } = useLanguage();
  return (code: string | null) => {
    if (!code) return '';
    if (code === 'socket') return t('tele.error.socket');
    if (code === 'timeout') return t('tele.error.timeout');
    return localizeServerMessage(code);
  };
}

/** A <video> bound to a MediaStream; shows `placeholder` while there is no video track */
export function VideoTile({ stream, muted = false, mirrored = false, placeholder, className = '', children }: {
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
  placeholder: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const hasVideo = Boolean(stream?.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled));
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    if (stream) video.play().catch(() => {});
  }, [stream]);
  return (
    // A tile placed by the caller (absolute/fixed, e.g. the self-view) must not get `relative`, which would win and push it out of the frame
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative '}overflow-hidden bg-gray-900 ${className}`}>
      {/* The element stays mounted (audio plays even without picture) */}
      <video ref={ref} autoPlay playsInline muted={muted} className={`w-full h-full ${mirrored ? 'object-cover -scale-x-100' : 'object-contain'} ${hasVideo ? '' : 'invisible'}`} />
      {!hasVideo && <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm text-center p-3">{placeholder}</div>}
      {children}
    </div>
  );
}

const CONNECTION_STYLE: Record<CallConnection, string> = {
  waiting: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  connecting: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  connected: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200',
  reconnecting: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

export function ConnectionBadge({ connection }: { connection: CallConnection }) {
  const { t } = useLanguage();
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${CONNECTION_STYLE[connection]}`}>{t(`tele.status.${connection}`)}</span>;
}

const SESSION_STYLE: Record<TeleconsultStatus, string> = {
  WAITING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  IN_CALL: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200',
  ENDED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

export function SessionBadge({ status }: { status: TeleconsultStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${SESSION_STYLE[status]}`}>{t(`tele.session.${status}`)}</span>;
}

// Heroicons-style outline paths
export const ICONS = {
  mic: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  camera: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  audioOnly: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z',
  chat: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  fullscreen: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4',
  hangup: 'M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
} as const;

export function Icon({ path, className = 'w-5 h-5' }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

/** Round call control; `off` shows the crossed-out state (micro/camera off) */
export function ControlButton({ label, icon, onClick, off = false, danger = false, active = false, disabled = false }: {
  label: string;
  icon: string;
  onClick: () => void;
  off?: boolean;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  const tone = danger
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : off
      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200'
      : active
        ? 'bg-brand text-white hover:bg-brand-hover'
        : 'bg-gray-700 text-white hover:bg-gray-600';
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} aria-pressed={off || active} className={`relative w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-40 ${tone}`}>
      <Icon path={icon} />
      {off && <span className="absolute w-7 h-0.5 bg-current rotate-45" aria-hidden="true" />}
    </button>
  );
}
