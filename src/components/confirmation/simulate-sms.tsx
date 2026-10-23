'use client';

import { useState } from 'react';
import { api, type InboundSmsResult } from '@/lib/api';
import { useLanguage } from '@/context/language-context';

/**
 * Test tool while messaging is not live: plays a patient's SMS reply to a reminder
 * ("1" confirm, "2" cancel) without an operator. The server refuses it in live mode.
 */
export function SimulateSmsReply({ onDone, collapsible = false }: { onDone?: () => void; collapsible?: boolean }) {
  const { t } = useLanguage();
  const [from, setFrom] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState<InboundSmsResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!from.trim() || !text.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.simulateInboundSms({ from: from.trim(), text: text.trim() }));
      onDone?.();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('conf.sim.failed'));
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <form onSubmit={send} className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('conf.sim.help')}</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          aria-label={t('conf.sim.from')}
          placeholder={t('conf.sim.fromPlaceholder')}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <input
          aria-label={t('conf.sim.text')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <button type="submit" disabled={busy || !from.trim()} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50">
          {t('conf.sim.send')}
        </button>
      </div>
      <div className="flex gap-2 text-xs">
        {['1', '2', 'OUI', 'NON'].map((sample) => (
          <button key={sample} type="button" onClick={() => setText(sample)} className="rounded border border-gray-300 px-2 py-1 text-gray-700 dark:border-gray-600 dark:text-gray-300">
            {sample}
          </button>
        ))}
      </div>
      {result && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-900/30 dark:text-sky-100">
          {t('conf.sim.result', { action: result.action ? t(`conf.sim.action.${result.action}`) : '—' })}
          {result.reply ? ` — « ${result.reply} »` : ''}
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>}
    </form>
  );

  if (collapsible) {
    return (
      <details className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-dashed border-sky-300 dark:border-sky-700 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-sky-800 dark:text-sky-300">{t('conf.sim.title')}</summary>
        <div className="mt-3">{body}</div>
      </details>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-sky-300 bg-white p-4 dark:border-sky-700 dark:bg-gray-800">
      <h2 className="mb-2 font-semibold text-sky-800 dark:text-sky-300">{t('conf.sim.title')}</h2>
      {body}
    </div>
  );
}
