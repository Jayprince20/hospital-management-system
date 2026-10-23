'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { OnCallEntry } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { OnCallList, departmentNameOf, useOnCall } from '@/components/rosters';
import { cardClass, smallBtn } from '@/components/rosters/ui';

export default function OnCallPage() {
  const { t, formatTime } = useLanguage();
  const { entries, error, reload } = useOnCall(null, 60_000);

  const groups = useMemo(() => {
    const map = new Map<string, OnCallEntry[]>();
    for (const e of entries ?? []) {
      const name = departmentNameOf(e) || t('ros.onCall.noDepartment');
      map.set(name, [...(map.get(name) ?? []), e]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries, t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ros.onCall.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('ros.onCall.subtitle', { time: formatTime(new Date().toISOString()) })}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={reload} className={smallBtn}>{t('ros.refresh')}</button>
          <Link href="/dashboard/rosters" className={smallBtn}>{t('ros.nav.planning')}</Link>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/40 text-sm text-red-700 dark:text-red-300">{t('ros.loadFailed')}</div>}

      {entries === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('ros.loading')}</p>
      ) : groups.length === 0 ? (
        <div className={`${cardClass} p-6 text-sm text-gray-600 dark:text-gray-300`}>{t('ros.onCall.nobodyAnywhere')}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(([name, list]) => (
            <section key={name} className={`${cardClass} p-4`}>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{name}</h2>
              <OnCallList entries={list} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
