'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type ConsentTexts, type ConsentType } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { CONSENT_TYPE_ORDER } from './consent-utils';

export interface ConsentCaptureValue {
  granted: Record<ConsentType, boolean>;
  method: 'SIGNED_FORM' | 'VERBAL';
}

export const initialConsentCapture: ConsentCaptureValue = {
  granted: { DATA_PROCESSING: false, SMS_REMINDERS: false, DATA_SHARING: false },
  method: 'SIGNED_FORM',
};

interface ConsentCaptureProps {
  value: ConsentCaptureValue;
  onChange: (value: ConsentCaptureValue) => void;
  error?: string;
}

/** Consent wording plus the patient's decisions, as recorded at the registration desk */
export function ConsentCapture({ value, onChange, error }: ConsentCaptureProps) {
  const { t, language } = useLanguage();
  const [texts, setTexts] = useState<ConsentTexts | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(() => {
    api.getConsentTexts().then(setTexts).catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setLoadFailed(false);
    load();
  };

  const toggle = (type: ConsentType, checked: boolean) =>
    onChange({ ...value, granted: { ...value.granted, [type]: checked } });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('privacy.consent.title')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('privacy.consent.subtitle')}</p>
      </div>

      {loadFailed ? (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-4">
          <span>{t('privacy.consent.loadFailed')}</span>
          <button type="button" onClick={retry} className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 font-medium">
            {t('privacy.consent.retry')}
          </button>
        </div>
      ) : !texts ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('privacy.consent.loading')}</p>
      ) : (
        <>
          {CONSENT_TYPE_ORDER.map((type) => {
            const required = texts.required.includes(type);
            return (
              <div
                key={type}
                className={`rounded-lg border p-4 ${
                  required && error && !value.granted[type]
                    ? 'border-red-400 dark:border-red-600'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t(`privacy.type.${type}`)}</h3>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      required
                        ? 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {required ? t('privacy.consent.required') : t('privacy.consent.optional')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{texts.texts[type][language]}</p>
                <label className="mt-3 flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value.granted[type]}
                    onChange={(e) => toggle(type, e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{t(`privacy.consent.accept.${type}`)}</span>
                </label>
              </div>
            );
          })}

          <fieldset>
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('privacy.consent.method')}</legend>
            <div className="flex flex-wrap gap-4">
              {(['SIGNED_FORM', 'VERBAL'] as const).map((method) => (
                <label key={method} className="flex items-center gap-2 text-sm text-gray-900 dark:text-white cursor-pointer">
                  <input
                    type="radio"
                    name="consentMethod"
                    checked={value.method === method}
                    onChange={() => onChange({ ...value, method })}
                    className="w-4 h-4 border-gray-300 text-lime-600 focus:ring-lime-500"
                  />
                  {t(`privacy.method.${method}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-xs text-gray-500 dark:text-gray-400">{t('privacy.consent.version', { version: texts.version })}</p>
        </>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
