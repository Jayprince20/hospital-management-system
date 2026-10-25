'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type DocumentVerification } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { documentLabelKey, normalizeCode } from '@/lib/medical-documents';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'found'; result: DocumentVerification }
  | { kind: 'notFound' }
  | { kind: 'error'; message: string };

/**
 * Public check of a certificate: anyone holding the paper (employer, school, police) types or
 * scans the code. Shows only what proves the document is genuine — never the medical content.
 */
export function VerifyView({ initialCode }: { initialCode?: string }) {
  const { t, formatDate, language, setLanguage } = useLanguage();
  const router = useRouter();
  const [input, setInput] = useState(initialCode ?? '');
  const [state, setState] = useState<State>({ kind: 'idle' });

  const check = useCallback(
    async (raw: string) => {
      const code = normalizeCode(raw);
      if (!code) {
        setState({ kind: 'error', message: t('mdoc.verify.badFormat') });
        return;
      }
      setState({ kind: 'loading' });
      try {
        setState({ kind: 'found', result: await api.verifyMedicalDocument(code) });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) setState({ kind: 'notFound' });
        else if (err instanceof ApiError && err.status === 429) setState({ kind: 'error', message: t('mdoc.verify.tooMany') });
        else setState({ kind: 'error', message: err instanceof Error && err.message ? err.message : t('mdoc.verify.failed') });
      }
    },
    [t]
  );

  useEffect(() => {
    if (!initialCode) return;
    // Checked from a timer: no state change during the first render
    const timer = setTimeout(() => check(initialCode), 0);
    return () => clearTimeout(timer);
  }, [initialCode, check]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeCode(input);
    // A new code goes in the address (shareable); that page checks it on load
    if (code && code !== normalizeCode(initialCode ?? '')) {
      router.replace(`/verify/${code}`);
      return;
    }
    check(input);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lime-700 dark:text-lime-400 font-bold text-xl">BB Diagnostics</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{t('mdoc.verify.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('mdoc.verify.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
            className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300"
          >
            {language === 'fr' ? 'EN' : 'FR'}
          </button>
        </div>

        <form onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
          <label htmlFor="verify-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('mdoc.verify.codeLabel')}</label>
          <div className="flex gap-2">
            <input
              id="verify-code"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="XXXXX-XXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono tracking-wider uppercase focus:ring-2 focus:ring-lime-500 focus:border-transparent"
            />
            <button type="submit" disabled={state.kind === 'loading'} className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg disabled:opacity-50">
              {t('mdoc.verify.check')}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('mdoc.verify.codeHelp')}</p>
        </form>

        <div aria-live="polite">
          {state.kind === 'loading' && <p className="text-sm text-gray-500 dark:text-gray-400">{t('mdoc.verify.checking')}</p>}

          {state.kind === 'found' && state.result.valid && (
            <div className="rounded-xl border-2 border-green-500 bg-green-50 dark:bg-green-900/20 p-5 space-y-3">
              <p className="text-lg font-bold text-green-800 dark:text-green-300">✓ {t('mdoc.verify.valid')}</p>
              {state.result.expired && (
                <p className="rounded-lg bg-amber-100 dark:bg-amber-900/40 px-3 py-2 text-sm font-medium text-amber-900 dark:text-amber-200">{t('mdoc.verify.expired')}</p>
              )}
              <ResultDetails result={state.result} formatDate={formatDate} t={t} />
            </div>
          )}

          {state.kind === 'found' && !state.result.valid && (
            <div className="rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-900/20 p-5 space-y-3">
              <p className="text-lg font-bold text-red-800 dark:text-red-300">✗ {state.result.status === 'REVOKED' ? t('mdoc.verify.revoked') : t('mdoc.verify.invalid')}</p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {state.result.revokedAt ? t('mdoc.verify.revokedOn', { date: formatDate(state.result.revokedAt) }) : t('mdoc.verify.revokedHelp')}
              </p>
              <ResultDetails result={state.result} formatDate={formatDate} t={t} />
            </div>
          )}

          {state.kind === 'notFound' && (
            <div className="rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-900/20 p-5">
              <p className="text-lg font-bold text-red-800 dark:text-red-300">✗ {t('mdoc.verify.notFound')}</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{t('mdoc.verify.notFoundHelp')}</p>
            </div>
          )}

          {state.kind === 'error' && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">{state.message}</div>
          )}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">{t('mdoc.verify.privacy')}</p>
      </div>
    </div>
  );
}

function ResultDetails({
  result,
  formatDate,
  t,
}: {
  result: DocumentVerification;
  formatDate: (value: string) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const rows: Array<[string, string]> = [
    [t('mdoc.verify.document'), t(documentLabelKey({ type: result.type, certificateKind: result.certificateKind ?? null, direction: result.direction ?? null }))],
    [t('mdoc.verify.number'), result.number],
    [t('mdoc.verify.issuedAt'), formatDate(result.issuedAt)],
  ];
  if (result.validFrom || result.validUntil) {
    rows.push([
      t('mdoc.verify.validity'),
      result.validFrom && result.validUntil
        ? t('mdoc.verify.fromTo', { from: formatDate(result.validFrom), to: formatDate(result.validUntil) })
        : result.validUntil
          ? t('mdoc.verify.until', { date: formatDate(result.validUntil) })
          : formatDate(result.validFrom as string),
    ]);
  }
  rows.push([t('mdoc.verify.doctor'), result.doctorName]);
  rows.push([t('mdoc.verify.facility'), result.facility]);
  rows.push([
    t('mdoc.verify.patient'),
    result.patientBirthYear ? t('mdoc.verify.patientValue', { initials: result.patientInitials, year: result.patientBirthYear }) : result.patientInitials,
  ]);
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="sm:contents">
          <dt className="text-gray-600 dark:text-gray-400">{label}</dt>
          <dd className="sm:col-span-2 font-medium text-gray-900 dark:text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
