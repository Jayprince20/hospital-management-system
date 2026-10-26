'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import {
  CorrectiveActionsPanel,
  LeveyJenningsChart,
  MaterialsPanel,
  QcEntryDialog,
  QcStatusBoard,
  QcStatusChip,
  materialLabel,
  useLabStaff,
  useLabTestOptions,
} from '@/components/lab-qc';
import { ErrorBox, cardClass, labelClass, messageOf, primaryBtn, selectClass } from '@/components/lab-qc/ui';
import { usePolling } from '@/components/inpatient/ui';
import { ljChartData, num, pendingCorrectiveActions, ruleLabel, type LabInstrument, type QcLevel, type QcMaterial, type QcResult, type QcSeries, type QcStatusEntry } from '@/lib/lab-qc';

type Tab = 'board' | 'chart' | 'actions' | 'materials';
const TABS: Tab[] = ['board', 'chart', 'actions', 'materials'];

const dayString = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysAgo = (n: number) => dayString(new Date(Date.now() - n * 86_400_000));

export default function LabQcPage() {
  const { t, formatDateTime } = useLanguage();
  const staff = useLabStaff();
  const tests = useLabTestOptions();
  const [tab, setTab] = useState<Tab>('board');
  const [date, setDate] = useState(dayString(new Date()));
  const [status, setStatus] = useState<QcStatusEntry[] | null>(null);
  const [materials, setMaterials] = useState<QcMaterial[]>([]);
  const [instruments, setInstruments] = useState<LabInstrument[]>([]);
  const [recent, setRecent] = useState<QcResult[]>([]);
  const [error, setError] = useState('');
  const [entryFor, setEntryFor] = useState<string | 'any' | null>(null);

  // Chart
  const [chartMaterialId, setChartMaterialId] = useState('');
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(dayString(new Date()));
  const [series, setSeries] = useState<QcSeries | null>(null);
  const [chartError, setChartError] = useState('');

  const load = useCallback(async () => {
    try {
      const [statusRes, materialsRes, recentRes] = await Promise.all([
        api.getQcStatus(date),
        api.getQcMaterials(),
        api.getQcResults({ from: daysAgo(60), to: dayString(new Date()), status: 'REJECTED' }),
      ]);
      setStatus(statusRes);
      setMaterials(materialsRes);
      setRecent(recentRes.results);
      setError('');
    } catch (err) {
      setError(messageOf(err, t('qc.loadFailed')));
      setStatus((s) => s ?? []);
    }
    // Biologists may not read the analysers list: optional
    api
      .getLabInstruments()
      .then(setInstruments)
      .catch(() => setInstruments([]));
  }, [date, t]);

  const refresh = useCallback(() => {
    if (staff.ready && staff.canUseQc) void load();
  }, [staff.ready, staff.canUseQc, load]);
  usePolling(refresh, null);

  const loadChart = useCallback(async () => {
    if (!chartMaterialId) return;
    try {
      setSeries(await api.getQcResults({ materialId: chartMaterialId, from, to }));
      setChartError('');
    } catch (err) {
      setChartError(messageOf(err, t('qc.loadFailed')));
      setSeries({ results: [] });
    }
  }, [chartMaterialId, from, to, t]);

  const refreshChart = useCallback(() => {
    if (tab === 'chart' && chartMaterialId) void loadChart();
  }, [tab, chartMaterialId, loadChart]);
  usePolling(refreshChart, null);

  const shownSeries = chartMaterialId ? series : null;
  const chartMaterial = chartMaterialId ? (materials.find((m) => m.id === chartMaterialId) ?? shownSeries?.material ?? null) : null;
  const chart = useMemo(
    () => ljChartData(shownSeries?.results ?? [], { mean: shownSeries?.mean ?? chartMaterial?.targetMean ?? null, sd: shownSeries?.sd ?? chartMaterial?.targetSd ?? null }),
    [shownSeries, chartMaterial]
  );
  const pendingActions = pendingCorrectiveActions(recent).length;
  const tLevel = (level: QcLevel) => t(`qc.level.${level}`);

  if (!staff.ready) return <p className="text-sm text-gray-500 p-6">{t('qc.loading')}</p>;
  if (!staff.canUseQc) {
    return (
      <div className={`${cardClass} p-6`}>
        <p className="text-gray-700 dark:text-gray-300">{t('qc.restricted')}</p>
      </div>
    );
  }

  const openChart = (materialId: string) => {
    setChartMaterialId(materialId);
    setTab('chart');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <Link href="/dashboard/laboratory" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">
            ← {t('labw.back')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('qc.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('qc.subtitle')}</p>
        </div>
        <button type="button" className={primaryBtn} onClick={() => setEntryFor('any')} disabled={materials.every((m) => !m.active)}>
          {t('qc.enter')}
        </button>
      </div>

      <div role="tablist" aria-label={t('qc.title')} className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === key ? 'border-brand text-brand dark:text-lime-300 dark:border-lime-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t(`qc.tab.${key}`)}
            {key === 'actions' && pendingActions > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[11px]">{pendingActions}</span>}
          </button>
        ))}
      </div>

      <ErrorBox message={error} />

      {tab === 'board' && (
        <section className={`${cardClass} p-4 space-y-4`}>
          <div className="flex items-end gap-3">
            <div>
              <label htmlFor="qc-date" className={labelClass}>
                {t('qc.date')}
              </label>
              <input id="qc-date" type="date" className={selectClass} value={date} max={dayString(new Date())} onChange={(e) => setDate(e.target.value || dayString(new Date()))} />
            </div>
          </div>
          {status === null ? <p className="text-sm text-gray-500">{t('qc.loading')}</p> : <QcStatusBoard entries={status} materials={materials} onEnter={(id) => setEntryFor(id)} onChart={openChart} />}
        </section>
      )}

      {tab === 'chart' && (
        <section className={`${cardClass} p-4 space-y-4`}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <label htmlFor="lj-material" className={labelClass}>
                {t('qc.chart.material')}
              </label>
              <select id="lj-material" className={`${selectClass} w-full`} value={chartMaterialId} onChange={(e) => setChartMaterialId(e.target.value)}>
                <option value="">{t('qc.entry.chooseMaterial')}</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {materialLabel(m, tLevel)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lj-from" className={labelClass}>
                {t('qc.chart.from')}
              </label>
              <input id="lj-from" type="date" className={selectClass} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="lj-to" className={labelClass}>
                {t('qc.chart.to')}
              </label>
              <input id="lj-to" type="date" className={selectClass} value={to} min={from} max={dayString(new Date())} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <ErrorBox message={chartError} />
          {chartMaterial && (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('qc.entry.target', {
                  mean: String(chart.mean ?? num(chartMaterial.targetMean) ?? '—').replace('.', ','),
                  sd: String(chart.sd ?? num(chartMaterial.targetSd) ?? '—').replace('.', ','),
                  unit: chartMaterial.unit ?? chartMaterial.labTest?.unit ?? '',
                })}
              </p>
              <LeveyJenningsChart chart={chart} name={chartMaterial.name} unit={chartMaterial.unit ?? chartMaterial.labTest?.unit} />
              {chart.points.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">{t('qc.chart.table')}</summary>
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                        <tr>
                          <th className="py-1.5 pr-3">{t('qc.entry.runAt')}</th>
                          <th className="py-1.5 pr-3 text-right">{t('qc.chart.value')}</th>
                          <th className="py-1.5 pr-3 text-right">{t('qc.chart.z')}</th>
                          <th className="py-1.5 pr-3">{t('instr.messages.status')}</th>
                          <th className="py-1.5 pr-3">{t('qc.chart.rules')}</th>
                          <th className="py-1.5">{t('instr.messages.transport')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {[...chart.points].reverse().map((p) => (
                          <tr key={p.id}>
                            <td className="py-1.5 pr-3 whitespace-nowrap">{formatDateTime(p.runAt)}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{String(p.value).replace('.', ',')}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{p.z === null ? '—' : p.z.toFixed(2).replace('.', ',')}</td>
                            <td className="py-1.5 pr-3">
                              <QcStatusChip status={p.status} />
                            </td>
                            <td className="py-1.5 pr-3">{p.violations.map(ruleLabel).join(', ') || '—'}</td>
                            <td className="py-1.5">{t(`qc.chart.source.${p.source === 'INSTRUMENT' ? 'INSTRUMENT' : 'MANUAL'}`)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'actions' && (
        <section className={`${cardClass} p-4`}>
          <CorrectiveActionsPanel results={recent} materials={materials} onSaved={() => void load()} />
        </section>
      )}

      {tab === 'materials' && (
        <section className={`${cardClass} p-4`}>
          <MaterialsPanel materials={materials} tests={tests} instruments={instruments} canEdit={staff.canUseQc} onChanged={() => void load()} />
        </section>
      )}

      {entryFor && (
        <QcEntryDialog
          materials={materials}
          initialMaterialId={entryFor === 'any' ? undefined : entryFor}
          onClose={() => setEntryFor(null)}
          onSaved={(result) => {
            setEntryFor(null);
            void load();
            if (tab === 'chart' && result.materialId === chartMaterialId) void loadChart();
          }}
        />
      )}
    </div>
  );
}
