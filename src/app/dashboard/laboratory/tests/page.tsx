'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePolling } from '@/components/inpatient/ui';
import Link from 'next/link';
import { api, LabTest } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { formatRange, selectRange } from '@/lib/lab';
import { LabTestEditor } from '@/components/lab/test-editor';
import { ContainerBadge, ErrorBox, cardClass, inputClass, messageOf, smallBtn } from '@/components/lab/ui';

export default function LabCataloguePage() {
  const { user } = useAuth();
  const { t, formatCurrency } = useLanguage();
  const toast = useToast();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'LAB_TECH';
  const [tests, setTests] = useState<LabTest[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<LabTest | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getLabTests({ limit: 500 });
      setTests(res.labTests);
      setError('');
    } catch (err) {
      setError(messageOf(err, t('labw.loadFailed')));
    }
  }, [t]);

  usePolling(load, null);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tests ?? []).filter((x) => !q || x.name.toLowerCase().includes(q) || x.code.toLowerCase().includes(q) || x.category.toLowerCase().includes(q));
  }, [tests, search]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/dashboard/laboratory" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('labw.back')}</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{t('labw.catalogue.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('labw.catalogue.subtitle')}</p>
      </div>
      <div className={`${cardClass} p-4 space-y-3`}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('labw.catalogue.search')} aria-label={t('labw.catalogue.search')} className={inputClass} />
        {error && <ErrorBox message={error} />}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-3">{t('labw.col.test')}</th>
                <th className="py-2 pr-3">{t('labw.catalogue.container')}</th>
                <th className="py-2 pr-3">{t('labw.catalogue.resultType')}</th>
                <th className="py-2 pr-3">{t('labw.col.reference')}</th>
                <th className="py-2 pr-3">{t('labw.catalogue.critical')}</th>
                <th className="py-2 pr-3">{t('labw.catalogue.price')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {tests === null ? (
                <tr><td colSpan={7} className="py-6 text-center text-gray-500 dark:text-gray-400">{t('labw.loading')}</td></tr>
              ) : (
                shown.map((x) => {
                  const def = selectRange({ refLow: x.refLow, refHigh: x.refHigh, criticalLow: x.criticalLow, criticalHigh: x.criticalHigh }, null, null);
                  const critical = [def.criticalLow != null ? `< ${def.criticalLow.toLocaleString('fr')}` : null, def.criticalHigh != null ? `> ${def.criticalHigh.toLocaleString('fr')}` : null].filter(Boolean).join(' · ');
                  return (
                    <tr key={x.id} className={x.isActive ? '' : 'opacity-60'}>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-gray-900 dark:text-white">{x.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{x.code} · {x.category}{x.unit ? ` · ${x.unit}` : ''}</p>
                      </td>
                      <td className="py-2.5 pr-3"><ContainerBadge container={x.container} /></td>
                      <td className="py-2.5 pr-3 text-gray-700 dark:text-gray-300">
                        {t(`labw.type.${x.resultType ?? 'NUMERIC'}`)}
                        {x.resultType === 'OPTION' && (x.options ?? []).length > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{(x.options ?? []).join(' / ')}</p>}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700 dark:text-gray-300">
                        {formatRange(def) || x.normalRange || '—'}
                        {(x.referenceRanges ?? []).length > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{t('labw.catalogue.rangesCount', { n: (x.referenceRanges ?? []).length })}</p>}
                      </td>
                      <td className="py-2.5 pr-3 text-red-700 dark:text-red-400">{critical || '—'}</td>
                      <td className="py-2.5 pr-3 text-gray-700 dark:text-gray-300">{formatCurrency(x.price)}</td>
                      <td className="py-2.5 text-right">
                        {canEdit && <button type="button" className={smallBtn} onClick={() => setEditing(x)}>{t('labw.catalogue.edit')}</button>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <LabTestEditor
          test={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            toast.success(t('labw.catalogue.saved', { name: saved.name ?? editing.name }));
            load();
          }}
        />
      )}
    </div>
  );
}
