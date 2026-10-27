'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, CoverageRelationship, PatientCoverage, Payer, PreAuthorization } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { preAuthStatusColor } from './status-colors';

const RELATIONSHIPS: CoverageRelationship[] = ['SELF', 'SPOUSE', 'CHILD', 'OTHER'];
const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm';
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayOf = (value: string | null | undefined) => (value ? value.slice(0, 10) : '');

interface CoverageDraft {
  payerId: string;
  memberNumber: string;
  policyNumber: string;
  holderName: string;
  relationship: CoverageRelationship;
  coveragePercent: string;
  validFrom: string;
  validUntil: string;
  isPrimary: boolean;
  notes: string;
}

const emptyCoverage = (): CoverageDraft => ({
  payerId: '', memberNumber: '', policyNumber: '', holderName: '', relationship: 'SELF',
  coveragePercent: '', validFrom: today(), validUntil: '', isPrimary: true, notes: '',
});

type PreAuthDialog =
  | { kind: 'request' }
  | { kind: 'approve'; preAuth: PreAuthorization }
  | { kind: 'reject'; preAuth: PreAuthorization };

interface Props {
  patientId: string;
  canManage: boolean;
}

/** Patient file: insurance policies (tiers payant) and prises en charge */
export function PatientCoveragePanel({ patientId, canManage }: Props) {
  const { t, formatCurrency, formatDate } = useLanguage();
  const [coverages, setCoverages] = useState<PatientCoverage[] | null>(null);
  const [preAuths, setPreAuths] = useState<PreAuthorization[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<PatientCoverage | 'new' | null>(null);
  const [draft, setDraft] = useState<CoverageDraft>(emptyCoverage());
  const [dialog, setDialog] = useState<PreAuthDialog | null>(null);
  const [preAuthForm, setPreAuthForm] = useState({ coverageId: '', services: '', requestedAmount: '', notes: '', approvedAmount: '', payerReference: '', validUntil: '', rejectionReason: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoadError('');
      const [c, p] = await Promise.all([api.getPatientCoverages(patientId), api.getPreAuthorizations({ patientId })]);
      setCoverages(c);
      setPreAuths(p);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('ins.loadFailed'));
      setCoverages([]);
    }
  }, [patientId, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (canManage) api.getPayers({ active: true }).then(setPayers).catch(() => setPayers([]));
  }, [canManage]);

  const openCoverage = (coverage: PatientCoverage | 'new') => {
    setEditing(coverage);
    setError('');
    setDraft(coverage === 'new' ? { ...emptyCoverage(), payerId: payers[0]?.id ?? '', isPrimary: !(coverages ?? []).some((c) => c.isActive && c.isPrimary) } : {
      payerId: coverage.payerId, memberNumber: coverage.memberNumber, policyNumber: coverage.policyNumber ?? '', holderName: coverage.holderName ?? '',
      relationship: coverage.relationship, coveragePercent: coverage.coveragePercent != null ? String(coverage.coveragePercent) : '',
      validFrom: dayOf(coverage.validFrom), validUntil: dayOf(coverage.validUntil), isPrimary: coverage.isPrimary, notes: coverage.notes ?? '',
    });
  };

  const saveCoverage = async () => {
    if (!draft.payerId || !draft.memberNumber.trim() || !draft.validFrom) { setError(t('ins.coverage.err.required')); return; }
    if (draft.validUntil && draft.validUntil < draft.validFrom) { setError(t('ins.coverage.err.dates')); return; }
    const pct = draft.coveragePercent === '' ? null : Number(draft.coveragePercent);
    if (pct != null && (!Number.isInteger(pct) || pct < 0 || pct > 100)) { setError(t('ins.payer.err.percent')); return; }
    const body = {
      payerId: draft.payerId,
      memberNumber: draft.memberNumber.trim(),
      policyNumber: draft.policyNumber.trim() || undefined,
      holderName: draft.holderName.trim() || undefined,
      relationship: draft.relationship,
      coveragePercent: pct,
      validFrom: draft.validFrom,
      validUntil: draft.validUntil || null,
      isPrimary: draft.isPrimary,
      notes: draft.notes.trim() || undefined,
    };
    try {
      setBusy(true);
      setError('');
      if (editing === 'new') await api.createPatientCoverage(patientId, body);
      else if (editing) await api.updatePatientCoverage(patientId, editing.id, body);
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ins.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const toggleCoverage = async (coverage: PatientCoverage) => {
    try {
      await api.updatePatientCoverage(patientId, coverage.id, { isActive: !coverage.isActive });
      load();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('ins.saveFailed'));
    }
  };

  const makePrimary = async (coverage: PatientCoverage) => {
    try {
      await api.updatePatientCoverage(patientId, coverage.id, { isPrimary: true });
      load();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('ins.saveFailed'));
    }
  };

  const openPreAuth = (next: PreAuthDialog) => {
    setError('');
    const firstValid = (coverages ?? []).find((c) => c.isActive && c.isValidToday) ?? (coverages ?? []).find((c) => c.isActive);
    setPreAuthForm({
      coverageId: firstValid?.id ?? '', services: '', requestedAmount: '', notes: '',
      approvedAmount: next.kind === 'approve' ? String(next.preAuth.requestedAmount) : '',
      payerReference: '', validUntil: '', rejectionReason: '',
    });
    setDialog(next);
  };

  const submitPreAuth = async () => {
    if (!dialog) return;
    try {
      setBusy(true);
      setError('');
      if (dialog.kind === 'request') {
        const amount = Number(preAuthForm.requestedAmount);
        if (!preAuthForm.coverageId || !preAuthForm.services.trim() || !(amount > 0)) { setError(t('ins.preAuth.err.required')); setBusy(false); return; }
        await api.createPreAuthorization({ patientId, coverageId: preAuthForm.coverageId, services: preAuthForm.services.trim(), requestedAmount: amount, notes: preAuthForm.notes.trim() || undefined });
      } else if (dialog.kind === 'approve') {
        const amount = Number(preAuthForm.approvedAmount);
        if (!(amount > 0)) { setError(t('ins.preAuth.err.amount')); setBusy(false); return; }
        await api.updatePreAuthorization(dialog.preAuth.id, {
          action: 'approve', approvedAmount: amount,
          payerReference: preAuthForm.payerReference.trim() || undefined,
          validUntil: preAuthForm.validUntil || undefined,
        });
      } else {
        if (!preAuthForm.rejectionReason.trim()) { setError(t('ins.preAuth.err.reason')); setBusy(false); return; }
        await api.updatePreAuthorization(dialog.preAuth.id, { action: 'reject', rejectionReason: preAuthForm.rejectionReason.trim() });
      }
      setDialog(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ins.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const cancelPreAuth = async (preAuth: PreAuthorization) => {
    try {
      await api.updatePreAuthorization(preAuth.id, { action: 'cancel' });
      load();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('ins.saveFailed'));
    }
  };

  if (!coverages) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-600" /></div>;
  }

  const hasActiveCoverage = coverages.some((c) => c.isActive);

  return (
    <div className="space-y-6">
      {loadError && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{loadError}</div>}

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('ins.coverage.title')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.coverage.subtitle')}</p>
          </div>
          {canManage && (
            <button onClick={() => openCoverage('new')} disabled={payers.length === 0} title={payers.length === 0 ? t('ins.coverage.noPayers') : undefined} className="px-3 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50">
              {t('ins.coverage.add')}
            </button>
          )}
        </div>
        {coverages.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('ins.coverage.empty')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {coverages.map((c) => (
              <li key={c.id} className={`p-4 flex flex-wrap items-start justify-between gap-3 ${c.isActive ? '' : 'opacity-60'}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white">{c.payer.name}</p>
                    {c.isPrimary && c.isActive && <span className="px-2 py-0.5 rounded text-xs font-medium bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-300">{t('ins.coverage.primary')}</span>}
                    {!c.isActive ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">{t('ins.inactive')}</span>
                    ) : !c.isValidToday && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">{t('ins.coverage.notValid')}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('ins.coverage.member')} {c.memberNumber}{c.policyNumber ? ` · ${t('ins.coverage.policy')} ${c.policyNumber}` : ''} · {c.effectivePercent} %
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {c.validUntil ? t('ins.coverage.validRange', { from: formatDate(c.validFrom), to: formatDate(c.validUntil) }) : t('ins.coverage.validFrom', { from: formatDate(c.validFrom) })}
                    {c.relationship !== 'SELF' ? ` · ${t(`ins.relationship.${c.relationship}`)}${c.holderName ? ` (${c.holderName})` : ''}` : ''}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-3 text-sm">
                    {c.isActive && !c.isPrimary && <button onClick={() => makePrimary(c)} className="text-blue-600 hover:text-blue-800 font-medium">{t('ins.coverage.makePrimary')}</button>}
                    <button onClick={() => openCoverage(c)} className="text-lime-600 hover:text-lime-800 font-medium">{t('ins.edit')}</button>
                    <button onClick={() => toggleCoverage(c)} className="text-gray-600 hover:text-gray-800 dark:text-gray-400 font-medium">{c.isActive ? t('ins.deactivate') : t('ins.activate')}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('ins.preAuth.title')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.preAuth.subtitle')}</p>
          </div>
          {canManage && hasActiveCoverage && (
            <button onClick={() => openPreAuth({ kind: 'request' })} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('ins.preAuth.request')}</button>
          )}
        </div>
        {preAuths.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('ins.preAuth.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                  <th className="px-4 py-3">{t('ins.preAuth.number')}</th>
                  <th className="px-4 py-3">{t('ins.preAuth.services')}</th>
                  <th className="px-4 py-3 text-right">{t('ins.preAuth.requested')}</th>
                  <th className="px-4 py-3 text-right">{t('ins.preAuth.approved')}</th>
                  <th className="px-4 py-3">{t('ins.status')}</th>
                  {canManage && <th className="px-4 py-3">{t('ins.actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {preAuths.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-mono text-gray-900 dark:text-white">{p.number}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{p.payer.name} · {formatDate(p.requestedAt)}</p>
                      {p.payerReference && <p className="text-xs text-gray-500 dark:text-gray-400">{t('ins.preAuth.payerRef', { ref: p.payerReference })}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-xs">
                      {p.services}
                      {p.invoices.length > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{p.invoices.map((i) => i.invoiceNumber).join(', ')}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{formatCurrency(p.requestedAmount)}</td>
                    <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">{p.approvedAmount != null ? formatCurrency(p.approvedAmount) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${preAuthStatusColor(p.status)}`}>{t(`ins.preAuthStatus.${p.status}`)}</span>
                      {p.validUntil && p.status === 'APPROVED' && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('ins.preAuth.until', { date: formatDate(p.validUntil) })}</p>}
                      {p.rejectionReason && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{p.rejectionReason}</p>}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-3">
                          {p.status === 'REQUESTED' && (
                            <>
                              <button onClick={() => openPreAuth({ kind: 'approve', preAuth: p })} className="text-green-600 hover:text-green-800 font-medium">{t('ins.preAuth.approve')}</button>
                              <button onClick={() => openPreAuth({ kind: 'reject', preAuth: p })} className="text-red-600 hover:text-red-800 font-medium">{t('ins.preAuth.reject')}</button>
                            </>
                          )}
                          {(p.status === 'REQUESTED' || p.status === 'APPROVED') && (
                            <button onClick={() => cancelPreAuth(p)} className="text-gray-600 hover:text-gray-800 dark:text-gray-400 font-medium">{t('ins.preAuth.cancel')}</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{editing === 'new' ? t('ins.coverage.add') : t('ins.coverage.edit')}</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {error && <div className="md:col-span-2 p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.coverage.payer')} *</label>
                <select value={draft.payerId} onChange={(e) => setDraft({ ...draft, payerId: e.target.value })} className={inputClass}>
                  <option value="">{t('ins.claims.choosePayer')}</option>
                  {payers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.defaultCoveragePercent} %)</option>)}
                  {editing !== 'new' && !payers.some((p) => p.id === draft.payerId) && <option value={draft.payerId}>{editing.payer.name}</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.coverage.member')} *</label>
                <input value={draft.memberNumber} onChange={(e) => setDraft({ ...draft, memberNumber: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.coverage.policy')}</label>
                <input value={draft.policyNumber} onChange={(e) => setDraft({ ...draft, policyNumber: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.coverage.relationship')}</label>
                <select value={draft.relationship} onChange={(e) => setDraft({ ...draft, relationship: e.target.value as CoverageRelationship })} className={inputClass}>
                  {RELATIONSHIPS.map((r) => <option key={r} value={r}>{t(`ins.relationship.${r}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.coverage.holder')}</label>
                <input value={draft.holderName} disabled={draft.relationship === 'SELF'} onChange={(e) => setDraft({ ...draft, holderName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.coverage.validFromLabel')} *</label>
                <input type="date" value={draft.validFrom} onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.coverage.validUntilLabel')}</label>
                <input type="date" value={draft.validUntil} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.coverage.percentOverride')}</label>
                <input type="number" min={0} max={100} value={draft.coveragePercent} placeholder={String(payers.find((p) => p.id === draft.payerId)?.defaultCoveragePercent ?? '')} onChange={(e) => setDraft({ ...draft, coveragePercent: e.target.value })} className={inputClass} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 self-end pb-2">
                <input type="checkbox" checked={draft.isPrimary} onChange={(e) => setDraft({ ...draft, isPrimary: e.target.checked })} />
                {t('ins.coverage.primaryLabel')}
              </label>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.notes')}</label>
                <textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">{t('ins.cancel')}</button>
              <button onClick={saveCoverage} disabled={busy} className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50">{busy ? t('ins.saving') : t('ins.save')}</button>
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {dialog.kind === 'request' ? t('ins.preAuth.request') : dialog.kind === 'approve' ? t('ins.preAuth.approveTitle', { number: dialog.preAuth.number }) : t('ins.preAuth.rejectTitle', { number: dialog.preAuth.number })}
              </h2>
              {dialog.kind !== 'request' && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{dialog.preAuth.services} · {formatCurrency(dialog.preAuth.requestedAmount)}</p>
              )}
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}
              {dialog.kind === 'request' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.coverage.title')}</label>
                    <select value={preAuthForm.coverageId} onChange={(e) => setPreAuthForm({ ...preAuthForm, coverageId: e.target.value })} className={inputClass}>
                      {coverages.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.payer.name} · {c.memberNumber}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.preAuth.services')} *</label>
                    <textarea rows={2} value={preAuthForm.services} onChange={(e) => setPreAuthForm({ ...preAuthForm, services: e.target.value })} placeholder={t('ins.preAuth.servicesHint')} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.preAuth.requestedAmount')} *</label>
                    <input type="number" min={1} value={preAuthForm.requestedAmount} onChange={(e) => setPreAuthForm({ ...preAuthForm, requestedAmount: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.notes')}</label>
                    <textarea rows={2} value={preAuthForm.notes} onChange={(e) => setPreAuthForm({ ...preAuthForm, notes: e.target.value })} className={inputClass} />
                  </div>
                </>
              )}
              {dialog.kind === 'approve' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.preAuth.approvedAmount')} *</label>
                    <input type="number" min={1} value={preAuthForm.approvedAmount} onChange={(e) => setPreAuthForm({ ...preAuthForm, approvedAmount: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.preAuth.payerReference')}</label>
                    <input value={preAuthForm.payerReference} onChange={(e) => setPreAuthForm({ ...preAuthForm, payerReference: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.preAuth.validUntil')}</label>
                    <input type="date" value={preAuthForm.validUntil} onChange={(e) => setPreAuthForm({ ...preAuthForm, validUntil: e.target.value })} className={inputClass} />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('ins.preAuth.validUntilHint')}</p>
                  </div>
                </>
              )}
              {dialog.kind === 'reject' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.preAuth.rejectionReason')} *</label>
                  <textarea rows={3} value={preAuthForm.rejectionReason} onChange={(e) => setPreAuthForm({ ...preAuthForm, rejectionReason: e.target.value })} className={inputClass} />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setDialog(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">{t('ins.cancel')}</button>
              <button onClick={submitPreAuth} disabled={busy} className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${dialog.kind === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-brand-hover'}`}>
                {busy ? t('ins.saving') : dialog.kind === 'request' ? t('ins.preAuth.send') : dialog.kind === 'approve' ? t('ins.preAuth.approve') : t('ins.preAuth.reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
