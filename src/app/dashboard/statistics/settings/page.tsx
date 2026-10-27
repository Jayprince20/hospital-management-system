'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { csvMappedKeys, mappingToCsv, type FacilitySettings, type IndicatorDef } from '@/lib/statistics';
import { ErrorBox, cardClass, inputClass, labelClass, messageOf, primaryBtn, tdClass, thClass } from '@/components/statistics/ui';

const MAX_ROWS = 200;

type IdentityField = 'facilityName' | 'category' | 'region' | 'healthDistrict' | 'healthArea' | 'dhis2OrgUnit';

export default function StatisticsSettingsPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const [settings, setSettings] = useState<FacilitySettings | null>(null);
  const [catalogue, setCatalogue] = useState<IndicatorDef[]>([]);
  const [form, setForm] = useState<Record<IdentityField, string>>({ facilityName: '', category: '', region: '', healthDistrict: '', healthArea: '', dhis2OrgUnit: '' });
  const [csv, setCsv] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyUnmapped, setOnlyUnmapped] = useState(false);

  const applySettings = (s: FacilitySettings) => {
    setSettings(s);
    setForm({
      facilityName: s.facilityName ?? '',
      category: s.category ?? '',
      region: s.region ?? '',
      healthDistrict: s.healthDistrict ?? '',
      healthArea: s.healthArea ?? '',
      dhis2OrgUnit: s.dhis2OrgUnit ?? '',
    });
    setCsv(mappingToCsv(s.dhis2Mapping));
  };

  useEffect(() => {
    Promise.all([api.getFacilitySettings(), api.getIndicatorCatalogue()])
      .then(([s, c]) => {
        applySettings(s);
        setCatalogue(c);
      })
      .catch((err) => setError(messageOf(err, t('stat.loadFailed'))));
  }, [t]);

  const mapping = useMemo(() => settings?.dhis2Mapping ?? {}, [settings]);
  const mappedCount = catalogue.filter((i) => mapping[i.key]).length;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalogue.filter((i) => (!onlyUnmapped || !mapping[i.key]) && (!q || i.key.toLowerCase().includes(q) || i.label.toLowerCase().includes(q)));
  }, [catalogue, mapping, search, onlyUnmapped]);

  const save = async () => {
    if (!form.facilityName.trim()) {
      setError(t('stat.set.nameRequired'));
      return;
    }
    setSaving(true);
    setError('');
    const blankToNull = (v: string) => (v.trim() ? v.trim() : null);
    try {
      const saved = await api.updateFacilitySettings({
        facilityName: form.facilityName.trim(),
        category: blankToNull(form.category),
        region: blankToNull(form.region),
        healthDistrict: blankToNull(form.healthDistrict),
        healthArea: blankToNull(form.healthArea),
        dhis2OrgUnit: blankToNull(form.dhis2OrgUnit),
        mappingCsv: csv,
      });
      applySettings(saved);
      toast.success(t('stat.set.saved'));
    } catch (err) {
      setError(messageOf(err, t('stat.actionFailed')));
    } finally {
      setSaving(false);
    }
  };

  const field = (name: IdentityField, label: string, hint?: string) => (
    <div>
      <label className={labelClass} htmlFor={`stat-set-${name}`}>{label}{name === 'facilityName' ? ' *' : ''}</label>
      <input id={`stat-set-${name}`} value={form[name]} onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))} className={inputClass} />
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/dashboard/statistics" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('stat.back')}</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('stat.set.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('stat.set.subtitle')}</p>
      </div>

      <ErrorBox message={error} />
      {!settings ? (
        !error && <p className="text-gray-500">{t('stat.loading')}</p>
      ) : (
        <>
          <section className={`${cardClass} p-4 space-y-4`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('stat.set.identity')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field('facilityName', t('stat.set.facilityName'))}
              {field('category', t('stat.set.category'), t('stat.set.categoryHint'))}
              {field('region', t('stat.set.region'))}
              {field('healthDistrict', t('stat.set.healthDistrict'))}
              {field('healthArea', t('stat.set.healthArea'))}
              {field('dhis2OrgUnit', t('stat.set.orgUnit'), t('stat.set.orgUnitHint'))}
            </div>
          </section>

          <section className={`${cardClass} p-4 space-y-3`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('stat.set.mapping')}</h2>
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('stat.set.mappingCount', { mapped: mappedCount, total: catalogue.length })}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('stat.set.mappingHint')}</p>
            <textarea
              rows={10}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              spellCheck={false}
              aria-label={t('stat.set.mapping')}
              placeholder="cons.total|F|1-4,AbCdEfGhIjK,LmNoPqRsTuV"
              className={`${inputClass} font-mono text-xs`}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('stat.set.mappingLines', { count: csvMappedKeys(csv).length })}</p>
          </section>

          <div className="flex justify-end">
            <button type="button" className={primaryBtn} onClick={save} disabled={saving}>{saving ? t('stat.saving') : t('stat.save')}</button>
          </div>

          <section className={`${cardClass} p-4 space-y-3`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('stat.set.catalogue')}</h2>
            <div className="flex flex-wrap items-center gap-3">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('stat.set.search')} aria-label={t('stat.set.search')} className={`${inputClass} max-w-sm`} />
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={onlyUnmapped} onChange={(e) => setOnlyUnmapped(e.target.checked)} className="w-4 h-4 text-lime-600 rounded" />
                {t('stat.set.filterUnmapped')}
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/40">
                  <tr>
                    <th className={thClass}>{t('stat.set.key')}</th>
                    <th className={thClass}>{t('stat.set.label')}</th>
                    <th className={thClass}>{t('stat.set.dataElement')}</th>
                    <th className={thClass}>{t('stat.set.coc')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.slice(0, MAX_ROWS).map((i) => {
                    const target = mapping[i.key];
                    return (
                      <tr key={i.key}>
                        <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>{i.key}</td>
                        <td className={tdClass}>{i.label}</td>
                        <td className={`${tdClass} font-mono text-xs`}>
                          {target ? target.dataElement : <span className="text-amber-700 dark:text-amber-400 font-sans">{t('stat.set.unmapped')}</span>}
                        </td>
                        <td className={`${tdClass} font-mono text-xs`}>{target?.categoryOptionCombo ?? ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > MAX_ROWS && <p className="text-xs text-gray-500 dark:text-gray-400">{t('stat.set.more', { count: filtered.length - MAX_ROWS })}</p>}
          </section>
        </>
      )}
    </div>
  );
}
