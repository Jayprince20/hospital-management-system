'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { usePolling } from '@/components/inpatient/ui';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { DiagnosisPicker } from '@/components/clinical-safety/diagnosis-picker';
import type { DiagnosisEntry } from '@/lib/clinical-safety';
import { diagnosesNotOnProblemList, sortProblems, type Problem, type ProblemStatus } from '@/lib/clinical-docs';
import { DialogShell, ErrorBox, ProblemStatusChip, cancelBtn, cardClass, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from './ui';

function AddProblemDialog({ patientId, consultationId, onClose, onAdded }: { patientId: string; consultationId?: string; onClose: () => void; onAdded: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [entry, setEntry] = useState<DiagnosisEntry | null>(null);
  const [status, setStatus] = useState<ProblemStatus>('active');
  const [onsetDate, setOnsetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!entry) {
      setError(t('cdoc.prob.pickOne'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.addProblem(patientId, {
        condition: entry.label,
        icd10Code: entry.code,
        status,
        onsetDate: onsetDate || undefined,
        notes: notes.trim() || undefined,
        sourceConsultationId: consultationId,
      });
      toast.success(t('cdoc.prob.added'), entry.label);
      onAdded();
    } catch (err) {
      setError(messageOf(err, t('cdoc.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={t('cdoc.prob.addTitle')}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('cdoc.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={save} disabled={busy || !entry}>{t('cdoc.save')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      {/* The ICD-10 picker keeps a list: here only the last pick counts */}
      <DiagnosisPicker value={entry ? [entry] : []} onChange={(list) => setEntry(list.length ? list[list.length - 1] : null)} />
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>{t('cdoc.prob.status')}</span>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ProblemStatus)}>
            <option value="active">{t('cdoc.prob.status.active')}</option>
            <option value="chronic">{t('cdoc.prob.status.chronic')}</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>{t('cdoc.prob.onset')}</span>
          <input type="date" className={inputClass} value={onsetDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setOnsetDate(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>{t('cdoc.prob.notes')}</span>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
    </DialogShell>
  );
}

/**
 * The patient's problem list (active and chronic first). On a consultation, `diagnoses` lists the
 * coded diagnoses being written so each can be added to the list in one click.
 */
export function ProblemListPanel({
  patientId,
  canEdit,
  diagnoses,
  consultationId,
  compact = false,
}: {
  patientId: string;
  canEdit: boolean;
  diagnoses?: DiagnosisEntry[];
  consultationId?: string;
  compact?: boolean;
}) {
  const { t, formatDate } = useLanguage();
  const toast = useToast();
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProblems(sortProblems(await api.getProblems(patientId)));
      setError('');
    } catch (err) {
      setError(messageOf(err, t('cdoc.prob.loadFailed')));
      setProblems((p) => p ?? []);
    }
  }, [patientId, t]);

  usePolling(load, null);

  const day = (value: string) => formatDate(`${value.slice(0, 10)}T12:00:00`);

  const setStatus = async (p: Problem, status: ProblemStatus) => {
    setBusyId(p.id);
    try {
      await api.updateProblem(p.id, { status, resolvedAt: status === 'resolved' ? new Date().toISOString().slice(0, 10) : null });
      toast.success(t('cdoc.prob.updated'), p.condition);
      await load();
    } catch (err) {
      toast.error(t('cdoc.actionFailed'), messageOf(err, ''));
    } finally {
      setBusyId(null);
    }
  };

  const addDiagnosis = async (d: DiagnosisEntry) => {
    setBusyId(d.code);
    try {
      await api.addProblem(patientId, { condition: d.label, icd10Code: d.code, status: 'active', sourceConsultationId: consultationId });
      toast.success(t('cdoc.prob.added'), d.label);
      await load();
    } catch (err) {
      toast.error(t('cdoc.actionFailed'), messageOf(err, ''));
    } finally {
      setBusyId(null);
    }
  };

  const open = (problems ?? []).filter((p) => p.status !== 'resolved');
  const resolved = (problems ?? []).filter((p) => p.status === 'resolved');
  const toAdd = canEdit && diagnoses && problems ? diagnosesNotOnProblemList(diagnoses, problems) : [];

  const row = (p: Problem) => (
    <li key={p.id} className="flex items-start gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${p.status === 'resolved' ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900 dark:text-white'}`}>
          {p.condition}
          {p.icd10Code && <span className="ml-1.5 font-mono text-xs text-gray-500 dark:text-gray-400">{p.icd10Code}</span>}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-1.5 mt-0.5">
          <ProblemStatusChip status={p.status} />
          {p.onsetDate && <span>{t('cdoc.prob.since', { date: day(p.onsetDate) })}</span>}
          {p.status === 'resolved' && p.resolvedAt && <span>{t('cdoc.prob.resolvedOn', { date: day(p.resolvedAt) })}</span>}
        </p>
        {p.notes && !compact && <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{p.notes}</p>}
      </div>
      {canEdit && (
        <div className="flex gap-1 shrink-0">
          {p.status === 'resolved' ? (
            <button type="button" className={smallBtn} disabled={busyId === p.id} onClick={() => setStatus(p, 'active')}>{t('cdoc.prob.reactivate')}</button>
          ) : (
            <button type="button" className={smallBtn} disabled={busyId === p.id} onClick={() => setStatus(p, 'resolved')}>{t('cdoc.prob.resolve')}</button>
          )}
        </div>
      )}
    </li>
  );

  return (
    <section className={`${cardClass} ${compact ? 'p-4' : 'p-5'}`} aria-label={t('cdoc.prob.title')}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-white`}>{t('cdoc.prob.title')}</h2>
        {canEdit && <button type="button" className={smallBtn} onClick={() => setAdding(true)}>+ {t('cdoc.prob.add')}</button>}
      </div>
      <ErrorBox message={error} />
      {problems === null && !error && <p className="text-sm text-gray-500">{t('cdoc.loading')}</p>}
      {problems && open.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('cdoc.prob.none')}</p>}
      {open.length > 0 && <ul className="divide-y divide-gray-100 dark:divide-gray-700">{open.map(row)}</ul>}

      {toAdd.length > 0 && (
        <div className="mt-3 rounded-xl bg-canvas dark:bg-gray-900/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400 mb-2">{t('cdoc.prob.fromDiagnoses')}</p>
          <div className="flex flex-wrap gap-1.5">
            {toAdd.map((d) => (
              <button
                key={d.code}
                type="button"
                className={smallBtn}
                disabled={busyId === d.code}
                onClick={() => addDiagnosis(d)}
                title={t('cdoc.prob.addDiagnosis', { label: d.label })}
              >
                + {d.code} · {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div className="mt-2">
          <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => setShowResolved((v) => !v)} aria-expanded={showResolved}>
            {showResolved ? t('cdoc.prob.hideResolved') : t('cdoc.prob.showResolved', { count: resolved.length })}
          </button>
          {showResolved && <ul className="divide-y divide-gray-100 dark:divide-gray-700">{resolved.map(row)}</ul>}
        </div>
      )}

      {adding && (
        <AddProblemDialog
          patientId={patientId}
          consultationId={consultationId}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void load();
          }}
        />
      )}
    </section>
  );
}
