'use client';

import { useLanguage } from '@/context/language-context';

/** 1–5 stars with large touch targets; tapping the chosen star again clears an optional rating */
export function StarRating({
  id,
  label,
  value,
  onChange,
  required = false,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  required?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <fieldset>
      <legend id={`${id}-label`} className="mb-2 text-base font-medium text-gray-900 dark:text-white">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </legend>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = value !== null && n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={t('fb.stars', { count: n })}
              onClick={() => onChange(value === n && !required ? null : n)}
              className="flex h-12 w-12 items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
            >
              <svg viewBox="0 0 24 24" className={`h-9 w-9 ${filled ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`} fill="currentColor" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          );
        })}
      </div>
      {value !== null && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t(`fb.starLabel.${value}`)}</p>}
    </fieldset>
  );
}

/** 0–10 "would you recommend" scale (NPS) */
export function RecommendScale({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const { t } = useLanguage();
  return (
    <fieldset>
      <legend id="recommend-label" className="mb-2 text-base font-medium text-gray-900 dark:text-white">
        {t('fb.survey.recommend')}
      </legend>
      <div role="radiogroup" aria-labelledby="recommend-label" className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(value === n ? null : n)}
            className={`h-12 rounded-lg border text-base font-semibold focus:outline-none focus:ring-2 focus:ring-lime-500 ${
              value === n
                ? n >= 9
                  ? 'border-green-600 bg-green-600 text-white'
                  : n >= 7
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-red-600 bg-red-600 text-white'
                : 'border-gray-300 bg-white text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{t('fb.survey.recommendLow')}</span>
        <span>{t('fb.survey.recommendHigh')}</span>
      </div>
    </fieldset>
  );
}

/** Read-only stars for staff lists */
export function StarsDisplay({ value }: { value: number | null | undefined }) {
  const { t } = useLanguage();
  if (value === null || value === undefined) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={t('fb.stars', { count: value })} title={t('fb.stars', { count: value })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className={`h-4 w-4 ${n <= value ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`} fill="currentColor" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}
