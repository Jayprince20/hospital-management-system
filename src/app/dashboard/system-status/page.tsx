'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type SystemStatus } from '@/lib/api';
import { useLanguage } from '@/context/language-context';

const REFRESH_MS = 30_000;
// A nightly backup older than this means last night's run did not happen
const BACKUP_MAX_AGE_HOURS = 26;

type Tone = 'good' | 'warning' | 'critical' | 'neutral';

const TONE_CLASSES: Record<Tone, string> = {
  good: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
  critical: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300',
  neutral: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const DOT_CLASSES: Record<Tone, string> = {
  good: 'bg-green-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
  neutral: 'bg-gray-400',
};

function StatusCard({ title, tone, value, detail }: { title: string; tone: Tone; value: string; detail?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${DOT_CLASSES[tone]}`} aria-hidden="true" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      </div>
      <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white break-words">{value}</p>
      {detail && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 break-all">{detail}</p>}
    </div>
  );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: Tone }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone === 'critical' ? 'text-red-600 dark:text-red-400' : tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </p>
    </div>
  );
}

export default function SystemStatusPage() {
  const { t, formatDateTime, formatNumber } = useLanguage();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await api.getSystemStatus());
      setError(false);
      setCheckedAt(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const none = t('ops.none');
  const num = (value: number | undefined | null) => (typeof value === 'number' ? formatNumber(value) : none);

  const duration = (seconds: number | undefined) => {
    if (typeof seconds !== 'number') return none;
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return t('ops.duration.days', { d, h });
    if (h > 0) return t('ops.duration.hours', { h, m });
    return t('ops.duration.minutes', { m });
  };

  const health = status?.health;
  const checks = health?.checks;

  // Overall banner
  const overall: Tone =
    health?.status === 'ok' ? 'good' : health?.status === 'degraded' ? 'warning' : health?.status === 'down' ? 'critical' : 'neutral';
  const overallText =
    health?.status === 'ok'
      ? t('ops.status.ok')
      : health?.status === 'degraded'
        ? t('ops.status.degraded')
        : health?.status === 'down'
          ? t('ops.status.down')
          : t('ops.status.unknown');

  // Database
  const db = checks?.database;
  const dbTone: Tone = db?.ok === true ? 'good' : db?.ok === false ? 'critical' : 'neutral';

  // Disk
  const disk = checks?.disk;
  const diskTone: Tone = disk?.ok === true ? 'good' : disk?.ok === false ? 'critical' : 'neutral';
  const diskValue =
    typeof disk?.freeBytes === 'number' ? t('ops.card.diskFree', { gb: (disk.freeBytes / 1024 ** 3).toFixed(1) }) : none;

  // Backup: red when missing or older than a day and a bit
  const backup = checks?.lastBackup;
  const backupAge = typeof backup?.ageHours === 'number' ? backup.ageHours : null;
  const backupStale = backupAge === null || backupAge > BACKUP_MAX_AGE_HOURS || backup?.ok === false;
  const backupTone: Tone = backup ? (backupStale ? 'critical' : 'good') : 'neutral';
  const backupValue =
    backupAge === null
      ? t('ops.card.backupMissing')
      : backupAge < 1
        ? t('ops.card.backupRecent')
        : t('ops.card.backupAge', { hours: Math.round(backupAge) });
  const backupDetail = [backup?.file, backupAge !== null && backupAge > BACKUP_MAX_AGE_HOURS ? t('ops.card.backupStale') : null]
    .filter(Boolean)
    .join(' · ');

  // Restore drill
  const drill = status?.lastRestoreDrill;
  const mismatchCount = Array.isArray(drill?.mismatches) ? drill.mismatches.length : typeof drill?.mismatches === 'number' ? drill.mismatches : 0;
  const drillTone: Tone = !drill ? 'warning' : drill.ok ? 'good' : 'critical';
  const drillValue = !drill ? t('ops.card.restoreNever') : drill.ok ? t('ops.passed') : t('ops.failed');
  const drillDetail = drill
    ? [
        drill.at ? formatDateTime(drill.at) : null,
        typeof drill.checkedTables === 'number' ? t('ops.card.restoreTables', { count: drill.checkedTables }) : null,
        mismatchCount > 0 ? t('ops.card.restoreMismatches', { count: mismatchCount }) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  // Security
  const counts = status?.counts;
  const mfaShort =
    typeof counts?.mfaEnrolled === 'number' && typeof counts?.mfaRequired === 'number' && counts.mfaEnrolled < counts.mfaRequired;
  const failedTone: Tone = (counts?.failedLoginsLast24h ?? 0) >= 20 ? 'critical' : (counts?.failedLoginsLast24h ?? 0) >= 5 ? 'warning' : 'neutral';

  const errors = status?.recentErrors ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ops.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('ops.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {checkedAt && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('ops.lastChecked', { time: formatDateTime(checkedAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })}
            </span>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 hover:bg-lime-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? t('ops.refreshing') : t('ops.refresh')}
          </button>
        </div>
      </div>

      {error && !status ? (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between ${TONE_CLASSES.critical}`}>
          <span>{t('ops.loadFailed')}</span>
          <button type="button" onClick={load} className="font-medium underline">
            {t('ops.retry')}
          </button>
        </div>
      ) : (
        <>
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${TONE_CLASSES[overall]}`} role="status">
            <span className={`h-3 w-3 rounded-full ${DOT_CLASSES[overall]}`} aria-hidden="true" />
            <span className="font-medium">{status ? overallText : t('ops.refreshing')}</span>
            {error && <span className="ml-auto text-xs">{t('ops.loadFailed')}</span>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatusCard
              title={t('ops.card.database')}
              tone={dbTone}
              value={db?.ok === undefined ? none : db.ok ? t('ops.ok') : t('ops.problem')}
              detail={typeof db?.latencyMs === 'number' ? t('ops.card.databaseLatency', { ms: Math.round(db.latencyMs) }) : undefined}
            />
            <StatusCard title={t('ops.card.disk')} tone={diskTone} value={diskValue} />
            <StatusCard title={t('ops.card.backup')} tone={backupTone} value={backup ? backupValue : none} detail={backupDetail || undefined} />
            <StatusCard title={t('ops.card.restore')} tone={drillTone} value={drillValue} detail={drillDetail || undefined} />
            <StatusCard
              title={t('ops.card.server')}
              tone={health ? 'good' : 'neutral'}
              value={t('ops.card.uptime', { value: duration(health?.uptimeSec) })}
              detail={health?.version ? t('ops.card.version', { value: health.version }) : undefined}
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white">{t('ops.security.title')}</h2>
            <div className="mt-4 grid gap-6 grid-cols-2 lg:grid-cols-5">
              <Metric label={t('ops.security.failedLogins')} value={num(counts?.failedLoginsLast24h)} tone={failedTone} />
              <Metric
                label={t('ops.security.mfa')}
                value={
                  typeof counts?.mfaEnrolled === 'number' && typeof counts?.mfaRequired === 'number'
                    ? t('ops.security.mfaValue', { enrolled: counts.mfaEnrolled, required: counts.mfaRequired })
                    : none
                }
                tone={mfaShort ? 'warning' : 'neutral'}
              />
              <Metric label={t('ops.security.audit')} value={num(counts?.auditLast24h)} />
              <Metric label={t('ops.security.users')} value={num(counts?.users)} />
              <Metric label={t('ops.security.patients')} value={num(counts?.patients)} />
            </div>
            {mfaShort && (
              <p className={`mt-4 rounded-lg border px-3 py-2 text-sm ${TONE_CLASSES.warning}`}>{t('ops.security.mfaMissing')}</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('ops.errors.title')}</h2>
            </div>
            {errors.length === 0 ? (
              <p className="p-5 text-sm text-gray-500 dark:text-gray-400">{t('ops.errors.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">{t('ops.errors.time')}</th>
                      <th className="px-4 py-3">{t('ops.errors.route')}</th>
                      <th className="px-4 py-3">{t('ops.errors.message')}</th>
                      <th className="px-4 py-3">{t('ops.errors.requestId')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {errors.map((entry, index) => (
                      <tr key={`${entry.requestId ?? 'e'}-${index}`} className="text-gray-900 dark:text-white align-top">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {entry.time ? formatDateTime(entry.time, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : none}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{entry.route || none}</td>
                        <td className="px-4 py-3 break-words max-w-md">{entry.msg || none}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{entry.requestId || none}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
