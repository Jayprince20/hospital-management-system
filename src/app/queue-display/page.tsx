'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError, type QueueDisplayData } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { formatWait } from '@/lib/queue';

const REFRESH_MS = 5_000;

/** Two soft tones, made with Web Audio so the screen needs no sound file */
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [660, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.35;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.65);
  });
}

function Clock() {
  const { formatDate } = useLanguage();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Set from timers only: the server-rendered page has no clock
    const first = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  if (!now) return null;
  return (
    <div className="text-right">
      <p className="text-5xl font-bold tabular-nums">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      <p className="text-xl text-slate-300 capitalize">{formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    </div>
  );
}

function DisplayScreen() {
  const token = useSearchParams().get('token') ?? '';
  const { t } = useLanguage();
  const [data, setData] = useState<QueueDisplayData | null>(null);
  const [invalid, setInvalid] = useState(!token);
  const [offline, setOffline] = useState(false);
  const [flash, setFlash] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const lastCallRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const next = await api.getQueueDisplay(token);
      setOffline(false);
      setInvalid(false);
      const latest = next.called[0];
      const key = latest ? `${latest.number}|${latest.calledAt}` : null;
      // A new call (or a call again): flash, and chime when sound is on. Not on the first load.
      if (key && lastCallRef.current !== null && key !== lastCallRef.current) {
        setFlash(true);
        setTimeout(() => setFlash(false), 4000);
        if (audioRef.current) playChime(audioRef.current);
      }
      lastCallRef.current = key ?? '';
      setData(next);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 400)) setInvalid(true);
      else setOffline(true);
    }
  }, [token]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  // Browsers only allow sound after a click on the page
  const enableSound = () => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioRef.current = new Ctx();
      playChime(audioRef.current);
      setSoundOn(true);
    } catch {
      setSoundOn(false);
    }
  };

  if (invalid) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-8">
        <div className="max-w-xl text-center space-y-4">
          <p className="text-4xl font-bold">{t('q.screen.invalid')}</p>
          <p className="text-xl text-slate-300">{t('q.screen.invalidHint')}</p>
        </div>
      </div>
    );
  }

  const current = data?.called[0] ?? null;
  const recent = data?.called.slice(1) ?? [];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col select-none">
      <header className="flex items-center justify-between px-10 py-6 border-b border-slate-700">
        <div>
          <p className="text-3xl font-bold text-lime-400">BB Diagnostics</p>
          <p className="text-2xl text-slate-200">{data?.departmentName ?? t('q.screen.allDepartments')}</p>
        </div>
        <Clock />
      </header>

      <main className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-8 p-10">
        <section
          className={`xl:col-span-2 rounded-3xl flex flex-col items-center justify-center p-10 transition-colors duration-500 ${
            flash ? 'bg-lime-500 text-slate-900' : 'bg-slate-800'
          }`}
          aria-live="assertive"
        >
          <p className={`text-4xl font-semibold uppercase tracking-wider ${flash ? 'text-slate-900' : 'text-lime-400'}`}>{t('q.screen.calling')}</p>
          {current ? (
            <>
              <p className="text-[12rem] leading-none font-black tabular-nums my-6">{current.number}</p>
              {current.room && (
                <p className="text-6xl font-bold">
                  {t('q.screen.goTo')} <span className="underline decoration-4 underline-offset-8">{current.room}</span>
                </p>
              )}
              {!data?.departmentName && current.departmentName && <p className="text-3xl mt-4 opacity-80">{current.departmentName}</p>}
            </>
          ) : (
            <p className="text-4xl text-slate-300 mt-10 text-center">{t('q.screen.nobodyCalled')}</p>
          )}
        </section>

        <aside className="space-y-8">
          <div className="bg-slate-800 rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-slate-300 mb-4">{t('q.screen.recent')}</h2>
            {recent.length === 0 ? (
              <p className="text-xl text-slate-500">—</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((c) => (
                  <li key={`${c.number}-${c.calledAt}`} className="flex items-baseline justify-between text-3xl">
                    <span className="font-bold tabular-nums">{c.number}</span>
                    <span className="text-slate-300">{c.room ?? ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-slate-800 rounded-3xl p-6">
            <h2 className="text-2xl font-semibold text-slate-300 mb-4">{t('q.screen.next')}</h2>
            {data && data.nextNumbers.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {data.nextNumbers.map((n) => (
                  <span key={n} className="px-4 py-2 rounded-xl bg-slate-700 text-3xl font-bold tabular-nums">{n}</span>
                ))}
              </div>
            ) : (
              <p className="text-xl text-slate-500">
                {data && data.waitingCount > 0 ? t('q.screen.triageInProgress') : t('q.screen.noneWaiting')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-3xl p-6">
              <p className="text-xl text-slate-300">{t('q.screen.waiting')}</p>
              <p className="text-5xl font-bold tabular-nums">{data?.waitingCount ?? '—'}</p>
            </div>
            <div className="bg-slate-800 rounded-3xl p-6">
              <p className="text-xl text-slate-300">{t('q.screen.avgWait')}</p>
              <p className="text-5xl font-bold tabular-nums">{data ? formatWait(data.averageWaitMinutes) : '—'}</p>
            </div>
          </div>
        </aside>
      </main>

      <footer className="flex items-center justify-between px-10 py-4 border-t border-slate-700 text-lg text-slate-400">
        <span>{offline ? <span className="text-amber-400">{t('q.screen.offline')}</span> : t('q.screen.privacy')}</span>
        {!soundOn && (
          <button type="button" onClick={enableSound} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800">
            {t('q.screen.sound')}
          </button>
        )}
      </footer>
    </div>
  );
}

export default function QueueDisplayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <DisplayScreen />
    </Suspense>
  );
}
