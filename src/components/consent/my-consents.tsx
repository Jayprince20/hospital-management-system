'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type ConsentStatus, type ConsentTexts, type ConsentType } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { ConsentBadge, CONSENT_TYPE_ORDER, consentState } from './consent-utils';

/** Patient portal: the patient's own consents, the optional ones as switches, and a data download */
export function MyConsents({ patientId }: { patientId: string }) {
  const { t, language, formatDate } = useLanguage();
  const toast = useToast();
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [texts, setTexts] = useState<ConsentTexts | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [savingType, setSavingType] = useState<ConsentType | null>(null);
  const [openText, setOpenText] = useState<ConsentType | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.getPatientConsents(patientId), api.getConsentTexts()])
      .then(([s, tx]) => {
        setStatus(s);
        setTexts(tx);
      })
      .catch(() => setLoadFailed(true));
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setLoadFailed(false);
    load();
  };

  const toggle = async (type: ConsentType, granted: boolean) => {
    setSavingType(type);
    try {
      setStatus(await api.recordPatientConsent(patientId, { type, granted }));
      toast.success(t('privacy.portal.updated'));
    } catch (err) {
      toast.error(t('privacy.portal.updateFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setSavingType(null);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      await api.exportPatientData(patientId);
      toast.success(t('privacy.portal.downloaded'));
    } catch (err) {
      toast.error(t('privacy.dp.exportFailed'), err instanceof Error ? err.message : undefined);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{t('privacy.portal.title')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('privacy.portal.subtitle')}</p>
      </div>

      {loadFailed ? (
        <div className="p-4 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{t('privacy.loadFailed')}</span>
          <button onClick={retry} className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 font-medium">
            {t('privacy.consent.retry')}
          </button>
        </div>
      ) : !status || !texts ? (
        <p className="p-4 text-sm text-gray-500">{t('common.loading')}</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {CONSENT_TYPE_ORDER.map((type) => {
            const state = consentState(status, type);
            const current = status.current.find((c) => c.type === type);
            const required = texts.required.includes(type);
            const on = state === 'granted';
            return (
              <li key={type} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{t(`privacy.type.${type}`)}</p>
                    {required ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('privacy.portal.dataProcessingNote')}</p>
                    ) : (
                      current?.decidedAt && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t('privacy.portal.since', { date: formatDate(current.decidedAt) })}
                        </p>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => setOpenText(openText === type ? null : type)}
                      className="mt-1 text-xs font-medium text-lime-700 dark:text-lime-400 hover:underline"
                    >
                      {openText === type ? t('privacy.portal.hideText') : t('privacy.portal.readText')}
                    </button>
                    {openText === type && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{texts.texts[type][language]}</p>
                    )}
                  </div>
                  {required ? (
                    <div className="flex flex-col items-end gap-2">
                      <ConsentBadge state={state} />
                      {/* Patients registered before consent capture can give it here */}
                      {state === 'none' && (
                        <button
                          type="button"
                          disabled={savingType === type}
                          onClick={() => toggle(type, true)}
                          className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-medium disabled:opacity-50"
                        >
                          {t('privacy.portal.accept')}
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={t(`privacy.type.${type}`)}
                      disabled={savingType === type}
                      onClick={() => toggle(type, !on)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                        on ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className="sr-only">{on ? t('privacy.portal.on') : t('privacy.portal.off')}</span>
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          on ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('privacy.portal.downloadHint')}</p>
        <button
          onClick={download}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? t('privacy.portal.downloading') : t('privacy.portal.download')}
        </button>
      </div>
    </div>
  );
}
