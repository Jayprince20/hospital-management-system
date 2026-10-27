'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type ImagingModalityDevice } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { ErrorState, LoadingState } from '@/components/ui';
import { cardClass, inputClass, messageOf, primaryBtn, smallBtn } from '@/components/imaging/ui';

/** Admin: devices (or a PACS router) allowed to push studies with STOW-RS, each with its own key */
export default function ImagingModalitiesPage() {
  const { t, formatDateTime } = useLanguage();
  const toast = useToast();
  const [devices, setDevices] = useState<ImagingModalityDevice[] | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [aeTitle, setAeTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [shownKey, setShownKey] = useState<{ id: string; key: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setDevices(await api.getImagingModalities());
      setError('');
    } catch (err) {
      setError(messageOf(err, t('dicom.loadFailed')));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err) {
      toast.error(t('img.actionFailed'), messageOf(err, ''));
    } finally {
      setBusy(false);
    }
  };

  if (error && !devices) return <ErrorState title={t('dicom.loadFailed')} message={error} onRetry={load} />;
  if (!devices) return <LoadingState label={t('dicom.loading')} />;

  return (
    <div className="space-y-4">
      <Link href="/dashboard/imaging" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('img.back')}</Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dicom.modalities.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('dicom.modalities.subtitle')}</p>
        <p className="text-xs text-gray-500 mt-1 font-mono">{t('dicom.modalities.endpoint', { url: `${api.apiBaseUrl()}/api/dicomweb/studies` })}</p>
      </div>

      <form
        className={`${cardClass} p-4 flex flex-wrap items-end gap-3`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !aeTitle.trim()) return;
          void run(async () => {
            await api.createImagingModality({ name: name.trim(), aeTitle: aeTitle.trim() });
            setName('');
            setAeTitle('');
          });
        }}
      >
        <label className="text-sm text-gray-700 dark:text-gray-300">
          {t('dicom.modalities.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} required className={`${inputClass} mt-1 w-56`} />
        </label>
        <label className="text-sm text-gray-700 dark:text-gray-300">
          {t('dicom.modalities.aeTitle')}
          <input value={aeTitle} onChange={(e) => setAeTitle(e.target.value.toUpperCase())} required maxLength={16} className={`${inputClass} mt-1 w-40 font-mono`} />
        </label>
        <button type="submit" disabled={busy} className={primaryBtn}>{t('dicom.modalities.new')}</button>
      </form>

      {shownKey && (
        <div role="alert" className="rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 p-4 text-sm space-y-2">
          <p className="font-semibold">{t('dicom.modalities.keyOnce')}</p>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 rounded bg-white/70 dark:bg-black/30 break-all">{shownKey.key}</code>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(shownKey.key)} className={smallBtn}>{t('dicom.modalities.copy')}</button>
          </div>
        </div>
      )}

      {devices.length === 0 ? (
        <p className={`${cardClass} p-5 text-sm text-gray-600 dark:text-gray-300`}>{t('dicom.modalities.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {devices.map((d) => (
            <li key={d.id} className={`${cardClass} p-4 flex flex-wrap items-center justify-between gap-3`}>
              <div className="text-sm">
                <p className="font-medium text-gray-900 dark:text-white">{d.name} <span className="font-mono text-xs text-gray-500">{d.aeTitle}</span></p>
                <p className="text-xs text-gray-500">
                  {d.active ? t('dicom.modalities.active') : t('dicom.modalities.inactive')}
                  {d.lastReceivedAt ? ` · ${formatDateTime(d.lastReceivedAt)}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(async () => setShownKey({ id: d.id, key: await api.generateImagingModalityKey(d.id) }))}
                  className={smallBtn}
                >
                  {t('dicom.modalities.key')}
                </button>
                <button type="button" disabled={busy} onClick={() => void run(() => api.updateImagingModality(d.id, { active: !d.active }))} className={smallBtn}>
                  {d.active ? t('dicom.modalities.disable') : t('dicom.modalities.enable')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
