'use client';

import { useEffect, useState } from 'react';
import { api, CoveragePreview, InvoiceItemInput, PatientCoverage } from '@/lib/api';
import { useLanguage } from '@/context/language-context';

export interface CoverageChoice {
  /** 'auto' = the patient's primary coverage, 'none' = bill the patient fully, else a coverage id */
  coverage: 'auto' | 'none' | string;
  preAuthId: string;
}

export const initialCoverageChoice: CoverageChoice = { coverage: 'auto', preAuthId: '' };

/** Fields to send with POST /api/invoices for this choice */
export function coverageRequestFields(choice: CoverageChoice): { useCoverage: boolean; coverageId?: string; preAuthId?: string } {
  if (choice.coverage === 'none') return { useCoverage: false };
  return {
    useCoverage: true,
    coverageId: choice.coverage === 'auto' ? undefined : choice.coverage,
    preAuthId: choice.preAuthId || undefined,
  };
}

interface Props {
  patientId: string;
  items: InvoiceItemInput[];
  tax: number;
  discount: number;
  value: CoverageChoice;
  onChange: (value: CoverageChoice) => void;
  onPreview?: (preview: CoveragePreview | null) => void;
}

/** Create-invoice form: which insurer pays, the split per line and the prise en charge to use */
export function InvoiceCoveragePanel({ patientId, items, tax, discount, value, onChange, onPreview }: Props) {
  const { t, formatCurrency, formatDate } = useLanguage();
  const [coverages, setCoverages] = useState<PatientCoverage[]>([]);
  const [preview, setPreview] = useState<CoveragePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.getPatientCoverages(patientId)
      .then((list) => { if (!cancelled) setCoverages(list.filter((c) => c.isActive)); })
      .catch(() => { if (!cancelled) setCoverages([]); });
    return () => { cancelled = true; };
  }, [patientId]);

  // Price-list lines are priced by the server (acts at 0 FCFA included); free lines need a price
  const validItems = items.filter((item) => item.tariff || (item.description && (item.unitPrice ?? 0) > 0));
  const itemsKey = JSON.stringify(validItems);

  useEffect(() => {
    if (value.coverage === 'none' || validItems.length === 0) {
      setPreview(null);
      onPreview?.(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api.previewCoverage({
          patientId,
          coverageId: value.coverage === 'auto' ? null : value.coverage,
          items: validItems,
          tax,
          discount,
        });
        if (cancelled) return;
        setPreview(result);
        setPreviewError('');
        onPreview?.(result);
      } catch (err) {
        if (cancelled) return;
        setPreview(null);
        onPreview?.(null);
        setPreviewError(err instanceof Error ? err.message : t('ins.preview.failed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, itemsKey, tax, discount, value.coverage]);

  // Drop a selected pre-auth that no longer applies
  useEffect(() => {
    if (value.preAuthId && preview && !preview.eligiblePreAuths.some((p) => p.id === value.preAuthId)) {
      onChange({ ...value, preAuthId: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  if (coverages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-sm text-gray-500 dark:text-gray-400">
        {t('ins.invoice.noCoverage')}
      </div>
    );
  }

  const coverage = preview?.coverage ?? null;

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 sm:w-48">{t('ins.invoice.coverage')}</label>
        <select
          value={value.coverage}
          onChange={(e) => onChange({ coverage: e.target.value, preAuthId: '' })}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="auto">{t('ins.invoice.primary')}</option>
          {coverages.map((c) => (
            <option key={c.id} value={c.id}>
              {c.payer.name} · {c.memberNumber} ({c.effectivePercent} %){c.isValidToday ? '' : ` — ${t('ins.coverage.notValid')}`}
            </option>
          ))}
          <option value="none">{t('ins.invoice.none')}</option>
        </select>
      </div>

      {previewError && <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>}

      {value.coverage !== 'none' && preview && (
        <>
          {coverage ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('ins.invoice.coveredBy', { payer: coverage.payer.name, member: coverage.memberNumber })}
            </p>
          ) : (
            <p className="text-sm text-amber-700 dark:text-amber-400">{t('ins.invoice.noValidCoverage')}</p>
          )}

          {coverage && preview.lines.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                  <th className="py-1">{t('ins.invoice.line')}</th>
                  <th className="py-1 text-right">{t('ins.invoice.rate')}</th>
                  <th className="py-1 text-right">{t('ins.insurerShare')}</th>
                  <th className="py-1 text-right">{t('ins.patientShare')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line) => (
                  <tr key={line.index} className="border-t border-blue-100 dark:border-blue-900">
                    <td className="py-1 text-gray-900 dark:text-white">{validItems[line.index]?.description}</td>
                    <td className="py-1 text-right text-gray-600 dark:text-gray-400">
                      {line.excluded ? t('ins.invoice.excluded') : `${line.percent} %`}
                    </td>
                    <td className="py-1 text-right text-blue-700 dark:text-blue-400">{formatCurrency(line.coveredAmount)}</td>
                    <td className="py-1 text-right text-gray-900 dark:text-white">{formatCurrency(line.patientAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white dark:bg-gray-800 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('ins.insurerShare')}</p>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{formatCurrency(preview.insurerShare)}</p>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('ins.patientShare')}</p>
              <p className="text-lg font-bold text-lime-700 dark:text-lime-400">{formatCurrency(preview.patientShare)}</p>
            </div>
          </div>

          {preview.preAuthRequired && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {preview.preAuthReason === 'ABOVE_THRESHOLD' && coverage?.payer.preAuthThreshold != null
                  ? t('ins.invoice.preAuthAbove', { payer: coverage.payer.name, amount: formatCurrency(coverage.payer.preAuthThreshold) })
                  : t('ins.invoice.preAuthAlways', { payer: coverage?.payer.name ?? '' })}
              </p>
              {preview.eligiblePreAuths.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('ins.invoice.noEligiblePreAuth')}</p>
              ) : (
                <select
                  value={value.preAuthId}
                  onChange={(e) => onChange({ ...value, preAuthId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">{t('ins.invoice.choosePreAuth')}</option>
                  {preview.eligiblePreAuths.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number} · {formatCurrency(p.approvedAmount ?? 0)}{p.validUntil ? ` · ${t('ins.preAuth.until', { date: formatDate(p.validUntil) })}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {!preview.preAuthRequired && preview.eligiblePreAuths.length > 0 && (
            <select
              value={value.preAuthId}
              onChange={(e) => onChange({ ...value, preAuthId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">{t('ins.invoice.noPreAuth')}</option>
              {preview.eligiblePreAuths.map((p) => (
                <option key={p.id} value={p.id}>{p.number} · {formatCurrency(p.approvedAmount ?? 0)}</option>
              ))}
            </select>
          )}
        </>
      )}
      {loading && <p className="text-xs text-gray-500 dark:text-gray-400">{t('ins.preview.loading')}</p>}
    </div>
  );
}
