'use client';

import type { ReactNode } from 'react';
import { useLanguage } from '@/context/language-context';
import { VACCINE_STATUS_STYLE, alertKey, ancAlertStyle, nutritionStyle, type VaccineStatus } from '@/lib/maternal-child';

export { DialogShell, ErrorBox, cardClass, inputClass, labelClass, cancelBtn, primaryBtn, smallBtn, messageOf } from '@/components/inpatient/ui';

/** Calendar day of a date or timestamp ("2026-10-26" or "2026-10-26T00:00:00.000Z") */
export const dayOf = (value: string | null | undefined) => (value ? value.slice(0, 10) : '');

/** Date formatter for calendar days (no time-zone shift) */
export function useDay() {
  const { formatDate } = useLanguage();
  return (value: string | null | undefined) => (value ? formatDate(dayOf(value)) : '—');
}

export function VaccineStatusChip({ status }: { status: VaccineStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${VACCINE_STATUS_STYLE[status]}`}>{t(`mc.vax.status.${status}`)}</span>;
}

export function NutritionBadge({ code }: { code: string }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${nutritionStyle(code)}`}>{t(`mc.nut.${code}`)}</span>;
}

export function AncAlertChip({ code, kind = 'alert' }: { code: string; kind?: 'alert' | 'risk' }) {
  const { t } = useLanguage();
  const style = kind === 'risk' ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800' : ancAlertStyle(code);
  return <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${style}`}>{t(alertKey(code, kind))}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'alert' | 'ok' }) {
  const color = tone === 'alert' ? 'text-red-700 dark:text-red-300' : tone === 'ok' ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-white';
  return (
    <div className="rounded-xl bg-canvas dark:bg-gray-900/40 px-3 py-2.5 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400">{label}</p>
      <p className={`text-lg font-bold ${color} truncate`}>{value}</p>
      {sub && <p className="text-xs text-ink-muted dark:text-gray-400">{sub}</p>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

/** Yes / No / not checked, for clinical findings where "not asked" differs from "no" */
export function TriState({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean | null) => void; label: string }) {
  const { t } = useLanguage();
  const options: { v: boolean | null; text: string }[] = [
    { v: true, text: t('mc.yes') },
    { v: false, text: t('mc.no') },
    { v: null, text: t('mc.notChecked') },
  ];
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</legend>
      <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={value === o.v}
            onClick={() => onChange(o.v)}
            className={`px-3 py-1.5 text-sm ${value === o.v ? 'bg-brand text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
