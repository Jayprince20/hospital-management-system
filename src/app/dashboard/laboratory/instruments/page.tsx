'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { InstrumentsPanel, MessageLog, useLabTestOptions } from '@/components/lab-qc';
import { ErrorBox, cardClass, messageOf } from '@/components/lab-qc/ui';
import { usePolling } from '@/components/inpatient/ui';
import type { LabInstrument } from '@/lib/lab-qc';

type Tab = 'list' | 'messages';

/** Analysers: settings and mappings (administration), read-only for lab technicians, plus the message log */
export default function LabInstrumentsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const tests = useLabTestOptions();
  const [tab, setTab] = useState<Tab>('list');
  const [instruments, setInstruments] = useState<LabInstrument[] | null>(null);
  const [error, setError] = useState('');
  const canEdit = user?.role === 'ADMIN';
  const allowed = user?.role === 'ADMIN' || user?.role === 'LAB_TECH';

  const load = useCallback(async () => {
    try {
      setInstruments(await api.getLabInstruments());
      setError('');
    } catch (err) {
      setError(messageOf(err, t('qc.loadFailed')));
      setInstruments((list) => list ?? []);
    }
  }, [t]);

  const refresh = useCallback(() => {
    if (allowed) void load();
  }, [allowed, load]);
  usePolling(refresh, null);

  if (!user) return null;
  if (!allowed) {
    return (
      <div className={`${cardClass} p-6`}>
        <p className="text-gray-700 dark:text-gray-300">{t('instr.restricted')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard/laboratory" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">
          ← {t('labw.back')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('instr.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('instr.subtitle')}</p>
      </div>

      <div role="tablist" aria-label={t('instr.title')} className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
        {(['list', 'messages'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === key ? 'border-brand text-brand dark:text-lime-300 dark:border-lime-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t(`instr.tab.${key}`)}
          </button>
        ))}
      </div>

      <ErrorBox message={error} />

      {tab === 'list' && (
        <section>
          {instruments === null ? (
            <p className="text-sm text-gray-500">{t('qc.loading')}</p>
          ) : (
            <InstrumentsPanel instruments={instruments} tests={tests} canEdit={canEdit} onChanged={() => void load()} />
          )}
        </section>
      )}

      {tab === 'messages' && (
        <section className={`${cardClass} p-4`}>
          <MessageLog instruments={instruments ?? []} />
        </section>
      )}
    </div>
  );
}
