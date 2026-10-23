'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type ConsentStatus, type ConsentType } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { ConsentBadge, CONSENT_TYPE_ORDER, consentState } from './consent-utils';

interface PatientConsentsPanelProps {
  patientId: string;
  /** Staff may record a decision; patients manage theirs in the portal */
  canRecord: boolean;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-lime-500 focus:border-transparent';

/** Consents tab on the patient record: current status, full history, new decisions */
export function PatientConsentsPanel({ patientId, canRecord }: PatientConsentsPanelProps) {
  const { t, formatDate, formatDateTime } = useLanguage();
  const toast = useToast();
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ type: ConsentType; granted: boolean; method: 'SIGNED_FORM' | 'VERBAL'; notes: string }>({
    type: 'DATA_PROCESSING',
    granted: true,
    method: 'SIGNED_FORM',
    notes: '',
  });

  const load = useCallback(() => {
    api.getPatientConsents(patientId).then(setStatus).catch(() => setLoadFailed(true));
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setLoadFailed(false);
    load();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.recordPatientConsent(patientId, {
        type: form.type,
        granted: form.granted,
        method: form.method,
        notes: form.notes.trim() || undefined,
      });
      setStatus(updated);
      setForm((prev) => ({ ...prev, notes: '' }));
      toast.success(t('privacy.record.saved'));
    } catch (err) {
      toast.error(t('privacy.record.failed'), err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loadFailed) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
        <span>{t('privacy.loadFailed')}</span>
        <button onClick={retry} className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 font-medium">
          {t('privacy.consent.retry')}
        </button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 text-sm text-gray-500">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('privacy.current')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-700">
          {CONSENT_TYPE_ORDER.map((type) => {
            const current = status.current.find((c) => c.type === type);
            return (
              <div key={type} className="p-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t(`privacy.type.${type}`)}</p>
                <div className="mt-2 flex items-center gap-2">
                  <ConsentBadge state={consentState(status, type)} />
                  {current?.decidedAt && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t('privacy.decidedOn', { date: formatDate(current.decidedAt) })}
                    </span>
                  )}
                </div>
                {current?.decidedAt && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {current.method ? t(`privacy.method.${current.method}`) : ''}
                    {current.version ? ` · ${current.version}` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Record a decision */}
      {canRecord && (
        <form onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('privacy.record.title')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('privacy.record.type')}</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ConsentType })}
                className={inputClass}
              >
                {CONSENT_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {t(`privacy.type.${type}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('privacy.record.decision')}</label>
              <select
                value={form.granted ? 'granted' : 'withdrawn'}
                onChange={(e) => setForm({ ...form, granted: e.target.value === 'granted' })}
                className={inputClass}
              >
                <option value="granted">{t('privacy.record.grant')}</option>
                <option value="withdrawn">{t('privacy.record.withdraw')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('privacy.record.method')}</label>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as 'SIGNED_FORM' | 'VERBAL' })}
                className={inputClass}
              >
                <option value="SIGNED_FORM">{t('privacy.method.SIGNED_FORM')}</option>
                <option value="VERBAL">{t('privacy.method.VERBAL')}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('privacy.record.notes')}</label>
            <input
              type="text"
              maxLength={500}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t('privacy.record.notesPlaceholder')}
              className={inputClass}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? t('privacy.record.saving') : t('privacy.record.submit')}
            </button>
          </div>
        </form>
      )}

      {/* History */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('privacy.history')}</h3>
        </div>
        {status.history.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('privacy.noHistory')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">{t('privacy.col.date')}</th>
                  <th className="px-4 py-3">{t('privacy.col.type')}</th>
                  <th className="px-4 py-3">{t('privacy.col.decision')}</th>
                  <th className="px-4 py-3">{t('privacy.col.method')}</th>
                  <th className="px-4 py-3">{t('privacy.col.version')}</th>
                  <th className="px-4 py-3">{t('privacy.col.recordedBy')}</th>
                  <th className="px-4 py-3">{t('privacy.col.notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {status.history.map((entry, index) => (
                  <tr key={entry.id} className="text-gray-900 dark:text-white">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(entry.grantedAt)}</td>
                    <td className="px-4 py-3">{t(`privacy.type.${entry.type}`)}</td>
                    <td className="px-4 py-3">
                      {/* A "no" is a withdrawal only if the same consent was granted earlier (history is newest first) */}
                      <ConsentBadge
                        state={
                          entry.granted
                            ? 'granted'
                            : status.history.slice(index + 1).some((older) => older.type === entry.type && older.granted)
                              ? 'withdrawn'
                              : 'refused'
                        }
                      />
                      {entry.granted && entry.withdrawnAt && (
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t('privacy.withdrawnOn', { date: formatDate(entry.withdrawnAt) })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{t(`privacy.method.${entry.method}`)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{entry.version}</td>
                    <td className="px-4 py-3">{entry.recordedBy || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{entry.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
