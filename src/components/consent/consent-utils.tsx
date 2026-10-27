'use client';

import type { ConsentStatus, ConsentType } from '@/lib/api';
import { useLanguage } from '@/context/language-context';

export const CONSENT_TYPE_ORDER: ConsentType[] = ['DATA_PROCESSING', 'SMS_REMINDERS', 'DATA_SHARING'];

export type ConsentState = 'granted' | 'refused' | 'withdrawn' | 'none';

/** Granted, refused (never given), withdrawn (given then taken back) or not recorded */
export function consentState(status: ConsentStatus, type: ConsentType): ConsentState {
  const current = status.current.find((c) => c.type === type);
  if (!current?.decidedAt) return 'none';
  if (current.granted) return 'granted';
  const everGranted = status.history.some((h) => h.type === type && h.granted);
  return everGranted ? 'withdrawn' : 'refused';
}

const stateClasses: Record<ConsentState, string> = {
  granted: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  refused: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  withdrawn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  none: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

export function ConsentBadge({ state }: { state: ConsentState }) {
  const { t } = useLanguage();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stateClasses[state]}`}>
      {t(`privacy.status.${state}`)}
    </span>
  );
}
