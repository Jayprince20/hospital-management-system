'use client';

import { useState, type ReactNode } from 'react';
import { useLanguage } from '@/context/language-context';
import {
  AGE_BANDS,
  SEXES,
  STATUS_STYLE,
  cellKey,
  formatIndicator,
  isDisaggregated,
  sexTotal,
  type DisaggregatedRow,
  type MdoAlert,
  type MonthlyReportListStatus,
  type ReportChange,
  type ReportSection,
  type SimpleRow,
} from '@/lib/statistics';
import { DialogShell, ErrorBox, cancelBtn, cardClass, dangerBtn, inputClass, labelClass, primaryBtn } from '@/components/inpatient/ui';

export { ErrorBox, cardClass, cancelBtn, primaryBtn, dangerBtn, inputClass, labelClass, messageOf, smallBtn } from '@/components/inpatient/ui';

export const thClass = 'px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase';
export const tdClass = 'px-3 py-2 text-sm text-gray-700 dark:text-gray-300';

export function ReportStatusBadge({ status }: { status: MonthlyReportListStatus }) {
  const { t } = useLanguage();
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[status]}`}>{t(`stat.status.${status}`)}</span>;
}

/**
 * Indicators split by sex and age band: one row per indicator, M/F columns for each band, then totals.
 * Only the table scrolls sideways on narrow screens; the indicator name stays visible.
 */
export function SexAgeGrid({ rows }: { rows: DisaggregatedRow[] }) {
  const { t, formatNumber } = useLanguage();
  if (rows.length === 0) return null;
  const cell = 'px-2 py-1.5 text-right tabular-nums text-sm';
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="min-w-full text-gray-700 dark:text-gray-300">
        <thead className="bg-gray-50 dark:bg-gray-700/40">
          <tr>
            <th rowSpan={2} className={`${thClass} sticky left-0 bg-gray-50 dark:bg-gray-700 min-w-[11rem]`}>{t('stat.indicator')}</th>
            {AGE_BANDS.map((band) => (
              <th key={band} colSpan={2} className="px-2 py-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap border-l border-gray-200 dark:border-gray-600">
                {t(`stat.age.${band}`)}
              </th>
            ))}
            <th colSpan={3} className="px-2 py-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-gray-600">{t('stat.total')}</th>
          </tr>
          <tr>
            {AGE_BANDS.flatMap((band) =>
              SEXES.map((sex) => (
                <th key={`${band}-${sex}`} className={`px-2 py-1 text-right text-xs font-medium text-gray-500 dark:text-gray-400 ${sex === 'M' ? 'border-l border-gray-200 dark:border-gray-600' : ''}`}>
                  {t(sex === 'M' ? 'stat.male' : 'stat.female')}
                </th>
              ))
            )}
            <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-gray-600">{t('stat.male')}</th>
            <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{t('stat.female')}</th>
            <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{t('stat.total')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="px-3 py-1.5 text-left text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800">{row.label}</th>
              {AGE_BANDS.flatMap((band) =>
                SEXES.map((sex) => {
                  const value = row.bySexAge[cellKey(sex, band)] ?? 0;
                  return (
                    <td key={`${band}-${sex}`} className={`${cell} ${sex === 'M' ? 'border-l border-gray-100 dark:border-gray-700' : ''} ${value === 0 ? 'text-gray-300 dark:text-gray-600' : ''}`}>
                      {formatNumber(value)}
                    </td>
                  );
                })
              )}
              <td className={`${cell} border-l border-gray-100 dark:border-gray-700`}>{formatNumber(sexTotal(row, 'M'))}</td>
              <td className={cell}>{formatNumber(sexTotal(row, 'F'))}</td>
              <td className={`${cell} font-semibold text-gray-900 dark:text-white`}>{formatNumber(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Single-value indicators as tiles */
export function IndicatorTiles({ rows }: { rows: SimpleRow[] }) {
  const { t, formatNumber } = useLanguage();
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {rows.map((row) => (
        <div key={row.key} className="rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2">
          <dt className="text-xs text-gray-500 dark:text-gray-400">{row.label}</dt>
          <dd className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums">{formatIndicator(row, formatNumber, t('stat.days'), t('stat.day'))}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Small table for the lists that come with a section (by department, by ward, tracers…) */
export function ListTable({ title, head, rows, empty }: { title: string; head: ReactNode; rows: ReactNode[]; empty?: string }) {
  const { t } = useLanguage();
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{empty ?? t('stat.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/40">{head}</thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{rows}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** One report section: the age×sex grid, value tiles, then its lists */
export function SectionCard({ section, children }: { section: ReportSection; children?: ReactNode }) {
  const { t } = useLanguage();
  const grid = section.rows.filter(isDisaggregated);
  const tiles = section.rows.filter((r): r is SimpleRow => !isDisaggregated(r));
  return (
    <section className={`${cardClass} p-4 space-y-4`} aria-labelledby={`section-${section.key}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`section-${section.key}`} className="text-lg font-semibold text-gray-900 dark:text-white">{section.title}</h2>
        {section.key === 'finance' && <span className="text-xs text-gray-500 dark:text-gray-400">{t('stat.notExported')}</span>}
      </div>
      <SexAgeGrid rows={grid} />
      <IndicatorTiles rows={tiles} />
      {children}
    </section>
  );
}

/** Notifiable diseases this month: the district must be told straight away */
export function MdoAlertBanner({ alerts }: { alerts: MdoAlert[] }) {
  const { t, formatDate } = useLanguage();
  if (alerts.length === 0) return null;
  return (
    <div role="alert" className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4 space-y-2">
      <p className="font-semibold text-red-800 dark:text-red-200">{t('stat.mdoAlertTitle')}</p>
      <p className="text-sm text-red-700 dark:text-red-300">{t('stat.mdoCases', { count: alerts.length })}</p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-red-900 dark:text-red-100">
          <thead>
            <tr className="text-left text-xs uppercase text-red-700 dark:text-red-300">
              <th className="px-2 py-1">{t('stat.alert.disease')}</th>
              <th className="px-2 py-1">{t('stat.alert.date')}</th>
              <th className="px-2 py-1">{t('stat.alert.age')}</th>
              <th className="px-2 py-1">{t('stat.alert.sex')}</th>
              <th className="px-2 py-1">{t('stat.alert.city')}</th>
              <th className="px-2 py-1">{t('stat.alert.source')}</th>
              <th className="px-2 py-1">{t('stat.alert.patient')}</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a, i) => (
              <tr key={`${a.patientRef}-${a.date}-${i}`} className="border-t border-red-200 dark:border-red-800">
                <td className="px-2 py-1 font-medium">{a.disease}</td>
                <td className="px-2 py-1 whitespace-nowrap">{formatDate(a.date)}</td>
                <td className="px-2 py-1">{a.age ?? '—'}</td>
                <td className="px-2 py-1">{a.sex ?? '—'}</td>
                <td className="px-2 py-1">{a.city ?? '—'}</td>
                <td className="px-2 py-1">{t(`stat.source.${a.source}`)}</td>
                <td className="px-2 py-1 whitespace-nowrap">{a.patientRef}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Indicators whose live value no longer matches the validated figures */
export function ChangesBanner({ changes }: { changes: ReportChange[] }) {
  const { t, formatNumber } = useLanguage();
  if (changes.length === 0) return null;
  const show = (v: number | null) => (v === null ? '—' : formatNumber(v));
  return (
    <div role="status" className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-4 space-y-2">
      <p className="font-semibold text-amber-900 dark:text-amber-200">{t('stat.changedTitle')}</p>
      <p className="text-sm text-amber-800 dark:text-amber-300">{t('stat.changedHint', { count: changes.length })}</p>
      <div className="overflow-x-auto max-h-64">
        <table className="min-w-full text-sm text-amber-900 dark:text-amber-100">
          <thead>
            <tr className="text-left text-xs uppercase text-amber-700 dark:text-amber-300">
              <th className="px-2 py-1">{t('stat.indicator')}</th>
              <th className="px-2 py-1 text-right">{t('stat.frozen')}</th>
              <th className="px-2 py-1 text-right">{t('stat.live')}</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.key} className="border-t border-amber-200 dark:border-amber-800">
                <td className="px-2 py-1">{c.label}</td>
                <td className="px-2 py-1 text-right tabular-nums">{show(c.frozen)}</td>
                <td className="px-2 py-1 text-right tabular-nums font-semibold">{show(c.live)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Dialog asking for one text (reason, reference, notes). `minLength` makes it required;
 * the server's message is shown when the action fails.
 */
export function TextDialog({
  title,
  hint,
  label,
  confirmLabel,
  initial = '',
  minLength = 0,
  multiline = true,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  hint?: string;
  label: string;
  confirmLabel: string;
  initial?: string;
  minLength?: number;
  multiline?: boolean;
  danger?: boolean;
  onConfirm: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (text.trim().length < minLength) {
      setError(t('stat.reasonTooShort'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConfirm(text.trim());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('stat.actionFailed'));
      setBusy(false);
    }
  };
  return (
    <DialogShell
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose} disabled={busy}>{t('stat.cancel')}</button>
          <button type="button" className={danger ? dangerBtn : primaryBtn} onClick={submit} disabled={busy}>{busy ? t('stat.saving') : confirmLabel}</button>
        </>
      }
    >
      {hint && <p className="text-sm text-gray-600 dark:text-gray-300">{hint}</p>}
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="stat-dialog-text">{label}{minLength > 0 ? ' *' : ''}</label>
        {multiline ? (
          <textarea id="stat-dialog-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} className={inputClass} />
        ) : (
          <input id="stat-dialog-text" value={text} onChange={(e) => setText(e.target.value)} className={inputClass} />
        )}
      </div>
    </DialogShell>
  );
}
