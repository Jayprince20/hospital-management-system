'use client';

import { useLanguage } from '@/context/language-context';
import { ED_LEVEL_STYLE, formatWait, levelKey, type Breach, type EdLevel, type EdStatus } from '@/lib/emergency';

export { DialogShell, ErrorBox, cardClass, inputClass, labelClass, cancelBtn, primaryBtn, dangerBtn, smallBtn, messageOf } from '@/components/inpatient/ui';

/** Triage level as a coloured pill that always carries its label (colour is never the only cue) */
export function EdLevelBadge({ level, large = false }: { level: EdLevel | null; large?: boolean }) {
  const { t } = useLanguage();
  const key = levelKey(level);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${large ? 'px-3 py-1 text-base' : 'px-2 py-0.5 text-xs'} ${ED_LEVEL_STYLE[key].badge}`}>
      <span aria-hidden="true">{key === 'UNTRIAGED' ? '?' : key.charAt(0)}</span>
      {t(`ed.level.${key}`)}
    </span>
  );
}

const STATUS_STYLE: Record<EdStatus, string> = {
  WAITING_TRIAGE: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  WAITING_DOCTOR: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  IN_TREATMENT: 'bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  AWAITING_RESULTS: 'bg-purple-50 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  OBSERVATION: 'bg-teal-50 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
  READY_FOR_DISPOSITION: 'bg-green-50 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  DEPARTED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

export function EdStatusChip({ status }: { status: EdStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLE[status]}`}>{t(`ed.status.${status}`)}</span>;
}

/** Wait since arrival plus where the patient stands against the SATS target (large: TV screen, dark background) */
export function WaitCell({ breach, triaged, large = false }: { breach: Breach; triaged: boolean; large?: boolean }) {
  const { t } = useLanguage();
  const { waitMinutes, targetMinutes, breaching, minutesToBreach } = breach;
  return (
    <div className="min-w-0">
      <p className={`font-bold tabular-nums ${large ? 'text-3xl' : 'text-base'} ${breaching ? (large ? 'text-red-400' : 'text-red-700 dark:text-red-300') : large ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{formatWait(waitMinutes)}</p>
      {breaching ? (
        <span className={`inline-flex items-center gap-1 rounded-full bg-red-600 text-white font-semibold animate-pulse motion-reduce:animate-none ${large ? 'px-3 py-1 text-base' : 'px-2 py-0.5 text-[11px]'}`}>
          <span aria-hidden="true">!</span>
          {minutesToBreach !== null && minutesToBreach < 0 ? t('ed.breachBy', { time: formatWait(-minutesToBreach) }) : t('ed.breach')}
        </span>
      ) : targetMinutes !== null && minutesToBreach !== null ? (
        <p className={large ? 'text-base text-gray-300' : 'text-xs text-ink-muted dark:text-gray-400'}>
          {targetMinutes === 0 ? t('ed.targetImmediate') : triaged ? t('ed.breachIn', { time: formatWait(minutesToBreach) }) : t('ed.triageDue', { time: formatWait(minutesToBreach) })}
        </p>
      ) : null}
    </div>
  );
}

export function selectClass(extra = '') {
  return `px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white ${extra}`;
}
