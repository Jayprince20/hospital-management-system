'use client';

import { useEffect } from 'react';

/** Production always; in development only with NEXT_PUBLIC_SW_DEV=1 (a stale worker in dev is confusing) */
export function swEnabled(env: { NODE_ENV?: string; NEXT_PUBLIC_SW_DEV?: string }): boolean {
  return env.NODE_ENV === 'production' || env.NEXT_PUBLIC_SW_DEV === '1';
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (swEnabled({ NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_SW_DEV: process.env.NEXT_PUBLIC_SW_DEV })) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    } else {
      // Development without the flag: remove a worker left by an earlier test
      void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()));
    }
  }, []);
  return null;
}
