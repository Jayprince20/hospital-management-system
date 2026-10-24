'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { PermissionGate } from '@/components/permission-gate';
import { MdoBadge } from '@/components/clinical-safety/diagnosis-picker';
import { SEVERITY_ORDER, SEVERITY_STYLE, type DrugInteraction, type Icd10Code } from '@/lib/clinical-safety';
import { ErrorBox, cardClass, inputClass, messageOf } from '@/components/inpatient/ui';

const th = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase';
const td = 'px-3 py-2 text-sm text-gray-700 dark:text-gray-300 align-top';

/** Admin, read-only: the ICD-10 codes offered to doctors and the drug interactions checked at prescribing */
export default function ClinicalReferencePage() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [codes, setCodes] = useState<Icd10Code[]>([]);
  const [codesError, setCodesError] = useState('');
  const [interactions, setInteractions] = useState<DrugInteraction[] | null>(null);
  const [interactionsError, setInteractionsError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api
      .getDrugInteractions()
      .then(setInteractions)
      .catch((err) => {
        setInteractions([]);
        setInteractionsError(messageOf(err, t('cs.settings.loadFailed')));
      });
  }, [t]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return; // the hint is shown instead of results
    let alive = true;
    const timer = setTimeout(() => {
      api
        .searchIcd10(q, 50)
        .then((list) => {
          if (!alive) return;
          setCodes(list);
          setCodesError('');
        })
        .catch((err) => alive && setCodesError(messageOf(err, t('cs.settings.loadFailed'))));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, t]);

  const shownInteractions = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (interactions ?? [])
      .filter((i) => !f || i.substanceA.includes(f) || i.substanceB.includes(f))
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.substanceA.localeCompare(b.substanceA));
  }, [interactions, filter]);

  return (
    <PermissionGate permission="settings:manage_system">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('cs.settings.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('cs.settings.subtitle')}</p>
        </div>

        <section className={`${cardClass} p-4 space-y-3`}>
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('cs.settings.icdTitle')}</h2>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('cs.settings.icdSearch')} aria-label={t('cs.settings.icdSearch')} className={`${inputClass} max-w-md`} />
          <ErrorBox message={codesError} />
          {query.trim().length < 2 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('cs.settings.icdHint')}</p>
          ) : codes.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('cs.dx.noResult')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className={th}>{t('cs.col.code')}</th>
                    <th className={th}>{t('cs.col.label')}</th>
                    <th className={th}>{t('cs.col.chapter')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {codes.map((c) => (
                    <tr key={c.code}>
                      <td className={`${td} font-mono font-semibold whitespace-nowrap`}>{c.code}</td>
                      <td className={td}>
                        {c.label} {c.notifiable && <MdoBadge />}
                      </td>
                      <td className={`${td} text-xs text-gray-500 dark:text-gray-400`}>{c.chapter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={`${cardClass} p-4 space-y-3`}>
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('cs.settings.interactionsTitle')}</h2>
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('cs.settings.interactionsFilter')} aria-label={t('cs.settings.interactionsFilter')} className={`${inputClass} max-w-md`} />
          <ErrorBox message={interactionsError} />
          {interactions === null ? null : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className={th}>{t('cs.col.substances')}</th>
                    <th className={th}>{t('cs.col.severity')}</th>
                    <th className={th}>{t('cs.col.effect')}</th>
                    <th className={th}>{t('cs.col.recommendation')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {shownInteractions.map((i) => (
                    <tr key={i.id} className={i.isActive ? '' : 'opacity-50'}>
                      <td className={`${td} whitespace-nowrap`}>{i.substanceA} + {i.substanceB}</td>
                      <td className={td}>
                        <span className={`px-2 py-0.5 rounded border text-xs font-medium ${SEVERITY_STYLE[i.severity]}`}>{t(`cs.safety.severity.${i.severity}`)}</span>
                      </td>
                      <td className={td}>{i.effect}</td>
                      <td className={td}>{i.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PermissionGate>
  );
}
