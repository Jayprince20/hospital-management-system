'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import {
  num,
  pendingCorrectiveActions,
  previewQcStatus,
  qcZ,
  ruleLabel,
  sortQcStatus,
  testStatusMeta,
  QC_LEVELS,
  type LabInstrument,
  type LabTestRef,
  type QcLevel,
  type QcMaterial,
  type QcMaterialInput,
  type QcResult,
  type QcStatusEntry,
} from '@/lib/lab-qc';
import { DialogShell, ErrorBox, QcStatusChip, TestStatusLabel, cancelBtn, cardClass, inputClass, labelClass, messageOf, primaryBtn, selectClass, smallBtn } from './ui';

const fmt = (n: number | null) => (n === null ? '—' : String(Math.round(n * 1000) / 1000).replace('.', ','));
const today = () => new Date().toISOString().slice(0, 10);

/** "2026-10-26T09:40" in local time, for <input type="datetime-local"> */
function localDateTime(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function materialLabel(m: QcMaterial, tLevel: (level: QcLevel) => string): string {
  return `${m.name} · ${tLevel(m.level)} · lot ${m.lotNumber}`;
}

// ---------- today's board ----------

export function QcStatusBoard({
  entries,
  materials,
  onEnter,
  onChart,
}: {
  entries: QcStatusEntry[];
  materials: QcMaterial[];
  onEnter: (materialId: string) => void;
  onChart: (materialId: string) => void;
}) {
  const { t, formatTime } = useLanguage();
  const sorted = useMemo(() => sortQcStatus(entries), [entries]);
  const counts = useMemo(
    () => ({
      out: entries.filter((e) => e.status === 'OUT_OF_CONTROL').length,
      notRun: entries.filter((e) => e.status === 'NOT_RUN').length,
      ok: entries.filter((e) => e.status === 'IN_CONTROL').length,
    }),
    [entries]
  );
  if (entries.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('qc.board.empty')}</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('qc.board.summary', counts)}</p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((entry) => {
          const meta = testStatusMeta(entry.status);
          return (
            <li key={`${entry.labTest.id}:${entry.instrument?.id ?? ''}`} className={`rounded-2xl border p-4 ${meta.className}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{entry.labTest.name}</p>
                  <p className="text-xs opacity-80">
                    <span className="font-mono">{entry.labTest.code}</span>
                    {entry.instrument ? ` · ${t('qc.board.instrument', { code: entry.instrument.code })}` : ''}
                  </p>
                </div>
                <TestStatusLabel status={entry.status} />
              </div>
              <ul className="mt-3 space-y-1.5">
                {entry.levels.map((level) => {
                  const material = materials.find((m) => m.id === level.materialId);
                  return (
                    <li key={level.materialId} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-white/70 dark:bg-gray-900/30 rounded-lg px-2.5 py-1.5">
                      <span className="font-medium">{t(`qc.level.${level.level}`)}</span>
                      <span className="flex items-center gap-1.5">
                        {level.lastStatus ? <QcStatusChip status={level.lastStatus} /> : <QcStatusChip status={null} />}
                        <span className="text-xs opacity-80">{level.lastRunAt ? t('qc.board.lastRun', { time: formatTime(level.lastRunAt) }) : t('qc.board.neverRun')}</span>
                      </span>
                      {(level.violations ?? []).length > 0 && (
                        <span className="w-full text-xs text-red-800 dark:text-red-300">{t('qc.entry.violations', { rules: (level.violations ?? []).map(ruleLabel).join(', ') })}</span>
                      )}
                      <span className="w-full flex gap-1.5 justify-end">
                        {material?.active !== false && (
                          <button type="button" className={smallBtn} onClick={() => onEnter(level.materialId)}>
                            {t('qc.enter')}
                          </button>
                        )}
                        <button type="button" className={smallBtn} onClick={() => onChart(level.materialId)}>
                          {t('qc.board.chart')}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <span className="sr-only">{t(meta.labelKey)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- entering a run ----------

export function QcEntryDialog({
  materials,
  initialMaterialId,
  onClose,
  onSaved,
}: {
  materials: QcMaterial[];
  initialMaterialId?: string;
  onClose: () => void;
  onSaved: (result: QcResult) => void;
}) {
  const { t, formatDate } = useLanguage();
  const toast = useToast();
  const active = materials.filter((m) => m.active);
  const [materialId, setMaterialId] = useState(initialMaterialId ?? (active.length === 1 ? active[0].id : ''));
  const [value, setValue] = useState('');
  const [runAt, setRunAt] = useState(localDateTime());
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const material = materials.find((m) => m.id === materialId) ?? null;
  const z = material ? qcZ(value, material.targetMean, material.targetSd) : null;
  const preview = previewQcStatus(z);
  const expired = material ? material.expiryDate.slice(0, 10) < today() : false;
  const tLevel = (level: QcLevel) => t(`qc.level.${level}`);

  const save = async () => {
    const v = num(value);
    if (!material) return setError(t('qc.entry.chooseMaterial'));
    if (v === null) return setError(t('qc.entry.valueRequired'));
    setBusy(true);
    setError('');
    try {
      const result = await api.addQcResult({
        materialId: material.id,
        value: v,
        runAt: new Date(runAt).toISOString(),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(material.instrumentId ? { instrumentId: material.instrumentId } : {}),
      });
      const label = t(`qc.status.${result.status}`);
      if (result.status === 'REJECTED') toast.error(t('qc.entry.saved', { status: label }), (result.violations ?? []).map(ruleLabel).join(', '));
      else if (result.status === 'WARNING') toast.warning(t('qc.entry.saved', { status: label }), (result.violations ?? []).map(ruleLabel).join(', '));
      else toast.success(t('qc.entry.saved', { status: label }));
      onSaved(result);
    } catch (err) {
      setError(messageOf(err, t('qc.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={t('qc.entry.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={primaryBtn} onClick={save} disabled={busy || !material || value.trim() === ''}>
            {t('qc.entry.save')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBox message={error} />
        <div>
          <label htmlFor="qc-material" className={labelClass}>
            {t('qc.entry.material')}
          </label>
          <select id="qc-material" className={`${selectClass} w-full`} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">{t('qc.entry.chooseMaterial')}</option>
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {materialLabel(m, tLevel)}
              </option>
            ))}
          </select>
          {material && (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {t('qc.entry.target', { mean: fmt(num(material.targetMean)), sd: fmt(num(material.targetSd)), unit: material.unit ?? material.labTest?.unit ?? '' })}
            </p>
          )}
          {expired && material && <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">{t('qc.entry.expired', { date: formatDate(material.expiryDate.slice(0, 10)) })}</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="qc-value" className={labelClass}>
              {t('qc.entry.value')}
            </label>
            <input id="qc-value" inputMode="decimal" autoFocus className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div>
            <label htmlFor="qc-run-at" className={labelClass}>
              {t('qc.entry.runAt')}
            </label>
            <input id="qc-run-at" type="datetime-local" className={inputClass} value={runAt} max={localDateTime()} onChange={(e) => setRunAt(e.target.value)} />
          </div>
        </div>
        {preview && (
          <div aria-live="polite" className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono">{t('qc.entry.z', { z: z === null ? '—' : z.toFixed(2).replace('.', ',') })}</span>
            <QcStatusChip status={preview.status} />
            {preview.violations.length > 0 && <span className="text-gray-700 dark:text-gray-300">{t('qc.entry.violations', { rules: preview.violations.map(ruleLabel).join(', ') })}</span>}
            <p className="w-full text-xs text-gray-500 dark:text-gray-400">{t('qc.serverAuthoritative')}</p>
          </div>
        )}
        <div>
          <label htmlFor="qc-comment" className={labelClass}>
            {t('qc.entry.comment')}
          </label>
          <input id="qc-comment" className={inputClass} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      </div>
    </DialogShell>
  );
}

// ---------- corrective actions ----------

export function CorrectiveActionsPanel({ results, materials, onSaved }: { results: QcResult[]; materials: QcMaterial[]; onSaved: () => void }) {
  const { t, formatDateTime } = useLanguage();
  const toast = useToast();
  const pending = useMemo(() => pendingCorrectiveActions(results), [results]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const tLevel = (level: QcLevel) => t(`qc.level.${level}`);

  const save = async (r: QcResult) => {
    const action = (drafts[r.id] ?? '').trim();
    if (!action) return toast.error(t('qc.actions.required'));
    setBusy(r.id);
    try {
      await api.reviewQcResult(r.id, { correctiveAction: action });
      toast.success(t('qc.actions.saved'));
      setDrafts((d) => ({ ...d, [r.id]: '' }));
      onSaved();
    } catch (err) {
      toast.error(t('qc.actionFailed'), messageOf(err, ''));
    } finally {
      setBusy(null);
    }
  };

  if (pending.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('qc.actions.empty')}</p>;
  return (
    <ul className="space-y-3">
      {pending.map((r) => {
        const material = r.material ?? materials.find((m) => m.id === r.materialId);
        return (
          <li key={r.id} className={`${cardClass} p-4 border-l-4 border-l-red-500`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-gray-900 dark:text-white">{material ? materialLabel(material, tLevel) : r.materialId}</p>
              <QcStatusChip status={r.status} />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
              {formatDateTime(r.runAt)} · {fmt(num(r.value))} {material?.unit ?? ''} · z = {typeof r.z === 'number' ? r.z.toFixed(2).replace('.', ',') : '—'}
            </p>
            {(r.violations ?? []).length > 0 && <p className="text-sm text-red-700 dark:text-red-400">{t('qc.entry.violations', { rules: r.violations.map(ruleLabel).join(', ') })}</p>}
            {r.comment && <p className="text-xs text-gray-500 dark:text-gray-400 italic">{r.comment}</p>}
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <label className="sr-only" htmlFor={`ca-${r.id}`}>
                {t('qc.actions.label')}
              </label>
              <input
                id={`ca-${r.id}`}
                className={inputClass}
                placeholder={t('qc.actions.placeholder')}
                value={drafts[r.id] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
              />
              <button type="button" className={`${primaryBtn} whitespace-nowrap`} disabled={busy !== null} onClick={() => save(r)}>
                {t('qc.actions.record')}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- control materials ----------

export function MaterialsPanel({
  materials,
  tests,
  instruments,
  canEdit,
  onChanged,
}: {
  materials: QcMaterial[];
  tests: LabTestRef[];
  instruments: LabInstrument[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { t, formatDate } = useLanguage();
  const [editing, setEditing] = useState<QcMaterial | 'new' | null>(null);
  const testName = (m: QcMaterial) => m.labTest?.name ?? tests.find((x) => x.id === m.labTestId)?.name ?? '—';
  const sorted = [...materials].sort((a, b) => Number(b.active) - Number(a.active) || testName(a).localeCompare(testName(b), 'fr') || QC_LEVELS.indexOf(a.level) - QC_LEVELS.indexOf(b.level));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('qc.materials.hint')}</p>
        {canEdit && (
          <button type="button" className={primaryBtn} onClick={() => setEditing('new')}>
            {t('qc.materials.add')}
          </button>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('qc.materials.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="py-2 pr-3">{t('qc.materials.name')}</th>
                <th className="py-2 pr-3">{t('qc.materials.test')}</th>
                <th className="py-2 pr-3">{t('qc.materials.level')}</th>
                <th className="py-2 pr-3">{t('qc.materials.lot')}</th>
                <th className="py-2 pr-3">{t('qc.materials.expiry')}</th>
                <th className="py-2 pr-3 text-right">{t('qc.materials.mean')}</th>
                <th className="py-2 pr-3 text-right">{t('qc.materials.sd')}</th>
                <th className="py-2 pr-3">{t('instr.messages.instrument')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sorted.map((m) => {
                const expired = m.expiryDate.slice(0, 10) < today();
                return (
                  <tr key={m.id} className={m.active ? '' : 'opacity-60'}>
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">
                      {m.name}
                      {!m.active && <span className="ml-2 text-xs text-gray-500">{t('qc.materials.inactive')}</span>}
                    </td>
                    <td className="py-2 pr-3">{testName(m)}</td>
                    <td className="py-2 pr-3">{t(`qc.level.${m.level}`)}</td>
                    <td className="py-2 pr-3 font-mono">{m.lotNumber}</td>
                    <td className={`py-2 pr-3 ${expired ? 'text-red-700 dark:text-red-400 font-medium' : ''}`}>
                      {formatDate(m.expiryDate.slice(0, 10))}
                      {expired && ` · ${t('qc.materials.expired')}`}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {fmt(num(m.targetMean))} {m.unit ?? ''}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmt(num(m.targetSd))}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{m.instrument?.code ?? instruments.find((i) => i.id === m.instrumentId)?.code ?? '—'}</td>
                    <td className="py-2 text-right">
                      {canEdit && (
                        <button type="button" className={smallBtn} onClick={() => setEditing(m)}>
                          {t('common.edit')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <MaterialDialog
          material={editing === 'new' ? null : editing}
          tests={tests}
          instruments={instruments}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function MaterialDialog({ material, tests, instruments, onClose, onSaved }: { material: QcMaterial | null; tests: LabTestRef[]; instruments: LabInstrument[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [f, setF] = useState({
    name: material?.name ?? '',
    labTestId: material?.labTestId ?? '',
    level: (material?.level ?? 'NORMAL') as QcLevel,
    lotNumber: material?.lotNumber ?? '',
    expiryDate: material?.expiryDate?.slice(0, 10) ?? '',
    targetMean: material ? String(material.targetMean) : '',
    targetSd: material ? String(material.targetSd) : '',
    unit: material?.unit ?? '',
    instrumentId: material?.instrumentId ?? '',
    active: material?.active ?? true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) => setF((prev) => ({ ...prev, [key]: e.target.value }));

  const save = async () => {
    const mean = num(f.targetMean);
    const sd = num(f.targetSd);
    if (!f.name.trim() || !f.labTestId || !f.lotNumber.trim() || !f.expiryDate || mean === null || sd === null || sd <= 0) return setError(t('qc.materials.required'));
    const input: QcMaterialInput = {
      name: f.name.trim(),
      labTestId: f.labTestId,
      level: f.level,
      lotNumber: f.lotNumber.trim(),
      expiryDate: f.expiryDate,
      targetMean: mean,
      targetSd: sd,
      unit: f.unit.trim() || null,
      instrumentId: f.instrumentId || null,
      active: f.active,
    };
    setBusy(true);
    setError('');
    try {
      if (material) await api.updateQcMaterial(material.id, input);
      else await api.createQcMaterial(input);
      toast.success(t('qc.materials.saved'));
      onSaved();
    } catch (err) {
      setError(messageOf(err, t('qc.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={material ? t('qc.materials.edit') : t('qc.materials.add')}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={primaryBtn} onClick={save} disabled={busy}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBox message={error} />
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="qcm-name" className={labelClass}>
              {t('qc.materials.name')}
            </label>
            <input id="qcm-name" className={inputClass} value={f.name} onChange={set('name')} placeholder="Contrôle Glucose N1" />
          </div>
          <div>
            <label htmlFor="qcm-test" className={labelClass}>
              {t('qc.materials.test')}
            </label>
            <select
              id="qcm-test"
              className={`${selectClass} w-full`}
              value={f.labTestId}
              onChange={(e) => {
                const test = tests.find((x) => x.id === e.target.value);
                setF((prev) => ({ ...prev, labTestId: e.target.value, unit: prev.unit || test?.unit || '' }));
              }}
            >
              <option value="">{t('qc.materials.chooseTest')}</option>
              {tests.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="qcm-level" className={labelClass}>
              {t('qc.materials.level')}
            </label>
            <select id="qcm-level" className={`${selectClass} w-full`} value={f.level} onChange={(e) => setF((prev) => ({ ...prev, level: e.target.value as QcLevel }))}>
              {QC_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {t(`qc.level.${level}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="qcm-lot" className={labelClass}>
              {t('qc.materials.lot')}
            </label>
            <input id="qcm-lot" className={inputClass} value={f.lotNumber} onChange={set('lotNumber')} />
          </div>
          <div>
            <label htmlFor="qcm-expiry" className={labelClass}>
              {t('qc.materials.expiry')}
            </label>
            <input id="qcm-expiry" type="date" className={inputClass} value={f.expiryDate} onChange={set('expiryDate')} />
          </div>
          <div>
            <label htmlFor="qcm-mean" className={labelClass}>
              {t('qc.materials.mean')}
            </label>
            <input id="qcm-mean" inputMode="decimal" className={inputClass} value={f.targetMean} onChange={set('targetMean')} />
          </div>
          <div>
            <label htmlFor="qcm-sd" className={labelClass}>
              {t('qc.materials.sd')}
            </label>
            <input id="qcm-sd" inputMode="decimal" className={inputClass} value={f.targetSd} onChange={set('targetSd')} />
          </div>
          <div>
            <label htmlFor="qcm-unit" className={labelClass}>
              {t('qc.materials.unit')}
            </label>
            <input id="qcm-unit" className={inputClass} value={f.unit} onChange={set('unit')} />
          </div>
          <div>
            <label htmlFor="qcm-instrument" className={labelClass}>
              {t('qc.materials.instrument')}
            </label>
            <select id="qcm-instrument" className={`${selectClass} w-full`} value={f.instrumentId} onChange={set('instrumentId')}>
              <option value="">{t('qc.materials.noInstrument')}</option>
              {instruments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} — {i.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
            <input type="checkbox" checked={f.active} onChange={(e) => setF((prev) => ({ ...prev, active: e.target.checked }))} />
            {t('qc.materials.active')}
          </label>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('qc.materials.hint')}</p>
      </div>
    </DialogShell>
  );
}
