'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { Modal } from '@/components/ui';

// Sign out after this long without activity, warning shortly before
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;
// Activity is recorded at most this often; shared across tabs through localStorage
const ACTIVITY_THROTTLE_MS = 15 * 1000;
const ACTIVITY_KEY = 'lastActivity';
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

function readLastActivity(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || Date.now();
  } catch {
    return Date.now();
  }
}

function writeLastActivity(time: number) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(time));
  } catch {
    // Storage blocked: the timer still works within this tab
  }
}

/** Idle session timeout for the dashboard: a 2-minute warning, then sign-out */
export function SessionTimeout() {
  const { logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const lastActivity = useRef(0);
  const warning = useRef(false);
  const signingOut = useRef(false);
  // logout changes identity on every render; keep the latest in a ref so the timers start once
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  useEffect(() => {
    lastActivity.current = Date.now();
    writeLastActivity(lastActivity.current);

    const onActivity = () => {
      // While the warning is open, only "Stay signed in" extends the session
      if (warning.current) return;
      const now = Date.now();
      if (now - lastActivity.current < ACTIVITY_THROTTLE_MS) return;
      lastActivity.current = now;
      writeLastActivity(now);
    };
    // Activity in another tab of the dashboard counts too
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVITY_KEY && e.newValue) lastActivity.current = Number(e.newValue);
    };

    const tick = setInterval(() => {
      const last = Math.max(lastActivity.current, readLastActivity());
      lastActivity.current = last;
      const left = IDLE_LIMIT_MS - (Date.now() - last);
      if (left <= 0) {
        if (signingOut.current) return;
        signingOut.current = true;
        clearInterval(tick);
        logoutRef.current()
          .catch(() => undefined)
          .finally(() => router.replace('/login?reason=timeout'));
      } else if (left <= WARNING_BEFORE_MS) {
        warning.current = true;
        setRemainingMs(left);
      } else if (warning.current) {
        // Extended from another tab
        warning.current = false;
        setRemainingMs(null);
      }
    }, 1000);

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(tick);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      window.removeEventListener('storage', onStorage);
    };
  }, [router]);

  const staySignedIn = () => {
    lastActivity.current = Date.now();
    writeLastActivity(lastActivity.current);
    warning.current = false;
    setRemainingMs(null);
  };

  const signOutNow = () => {
    signingOut.current = true;
    logout().catch(() => undefined);
  };

  const seconds = Math.max(0, Math.ceil((remainingMs ?? 0) / 1000));
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <Modal isOpen={remainingMs !== null} onClose={staySignedIn} size="sm">
      <Modal.Header>{t('security.timeout.title')}</Modal.Header>
      <Modal.Body>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('security.timeout.message', { time })}</p>
        <p className="mt-3 text-3xl font-semibold text-center font-mono text-gray-900 dark:text-white" aria-live="polite">
          {time}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" onClick={signOutNow} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          {t('security.timeout.logoutNow')}
        </button>
        <button type="button" onClick={staySignedIn} className="px-4 py-2 text-sm bg-brand hover:bg-brand-hover text-white rounded-lg">
          {t('security.timeout.stay')}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
