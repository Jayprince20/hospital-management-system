'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ClaimStatus, ClaimSummary, EligibleClaimInvoice, Payer } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { claimStatusColor } from '@/components/insurance/status-colors';

const STATUSES: ClaimStatus[] = ['DRAFT', 'SUBMITTED', 'PARTIALLY_PAID', 'PAID', 'CLOSED'];

const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Last calendar month: the usual bordereau period */
function lastMonth(): { start: string; end: string } {
  const now = new Date();
  return { start: toDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)), end: toDay(new Date(now.getFullYear(), now.getMonth(), 0)) };
}

const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm';

export default function ClaimsPage() {
  const router = useRouter();
  const { t, formatCurrency, formatDate } = useLanguage();
  const [claims, setClaims] = useState<ClaimSummary[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState<ClaimStatus | ''>('');
  const [payerId, setPayerId] = useState('');

  // New bordereau dialog
  const [showNew, setShowNew] = useState(false);
  const [newPayer, setNewPayer] = useState('');
  const [period, setPeriod] = useState(lastMonth());
  const [eligible, setEligible] = useState<EligibleClaimInvoice[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoadError('');
      setClaims(await api.getClaims({ status: status || undefined, payerId: payerId || undefined }));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('ins.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [status, payerId, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.getPayers().then(setPayers).catch(() => setPayers([])); }, []);

  const openNew = () => {
    setShowNew(true);
    setNewPayer(payerId || payers.find((p) => p.isActive)?.id || '');
    setPeriod(lastMonth());
    setEligible(null);
    setSelected(new Set());
    setNotes('');
    setError('');
  };

  const findEligible = async () => {
    if (!newPayer) { setError(t('ins.claims.choosePayer')); return; }
    if (period.start > period.end) { setError(t('ins.claims.badPeriod')); return; }
    try {
      setBusy(true);
      setError('');
      const list = await api.getEligibleClaimInvoices({ payerId: newPayer, periodStart: period.start, periodEnd: period.end });
      setEligible(list);
      setSelected(new Set(list.map((inv) => inv.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ins.loadFailed'));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!eligible || selected.size === 0) { setError(t('ins.claims.noneSelected')); return; }
    try {
      setBusy(true);
      setError('');
      const claim = await api.createClaim({ payerId: newPayer, periodStart: period.start, periodEnd: period.end, invoiceIds: [...selected], notes: notes.trim() || undefined });
      router.push(`/dashboard/claims/${claim.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ins.saveFailed'));
      setBusy(false);
    }
  };

  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectedTotal = (eligible ?? []).filter((inv) => selected.has(inv.id)).reduce((sum, inv) => sum + inv.insurerBalance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ins.claims.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('ins.claims.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/receivables" className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            {t('ins.receivables.title')}
          </Link>
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t('ins.claims.new')}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4">
          <select value={payerId} onChange={(e) => setPayerId(e.target.value)} aria-label={t('ins.claims.payer')} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">{t('ins.claims.allPayers')}</option>
            {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            {(['', ...STATUSES] as const).map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${status === s ? 'bg-lime-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
              >
                {s ? t(`ins.claimStatus.${s}`) : t('ins.claims.allStatuses')}
              </button>
            ))}
          </div>
        </div>
        {loadError && <p className="p-4 text-sm text-red-600 dark:text-red-400">{loadError}</p>}
        {loading ? (
          <div className="flex justify-center h-48 items-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lime-600" /></div>
        ) : claims.length === 0 ? (
          <p className="text-center py-12 text-gray-500 dark:text-gray-400">{t('ins.claims.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">
                  <th className="px-6 py-3">{t('ins.claims.number')}</th>
                  <th className="px-6 py-3">{t('ins.claims.payer')}</th>
                  <th className="px-6 py-3">{t('ins.claims.period')}</th>
                  <th className="px-6 py-3 text-right">{t('ins.claims.lines')}</th>
                  <th className="px-6 py-3 text-right">{t('ins.claims.claimed')}</th>
                  <th className="px-6 py-3 text-right">{t('ins.claims.paid')}</th>
                  <th className="px-6 py-3 text-right">{t('ins.claims.outstanding')}</th>
                  <th className="px-6 py-3">{t('ins.claims.due')}</th>
                  <th className="px-6 py-3">{t('ins.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => router.push(`/dashboard/claims/${claim.id}`)}>
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/claims/${claim.id}`} className="font-mono text-sm text-lime-600 dark:text-lime-400" onClick={(e) => e.stopPropagation()}>{claim.number}</Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{claim.payer.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{formatDate(claim.periodStart)} – {formatDate(claim.periodEnd)}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700 dark:text-gray-300">{claim.lineCount}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900 dark:text-white">{formatCurrency(claim.totalClaimed)}</td>
                    <td className="px-6 py-4 text-sm text-right text-green-600">{formatCurrency(claim.totalPaid)}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-orange-600">{formatCurrency(claim.outstanding)}</td>
                    <td className="px-6 py-4 text-sm">
                      {claim.dueDate ? (
                        <span className={claim.isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}>
                          {formatDate(claim.dueDate)}{claim.isOverdue ? ` · ${t('ins.claims.overdue')}` : ''}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${claimStatusColor(claim.status)}`}>{t(`ins.claimStatus.${claim.status}`)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('ins.claims.new')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('ins.claims.newHint')}</p>
            </div>
            <div className="p-6 space-y-5">
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.claims.payer')}</label>
                  <select value={newPayer} onChange={(e) => { setNewPayer(e.target.value); setEligible(null); }} className={inputClass}>
                    <option value="">{t('ins.claims.choosePayer')}</option>
                    {payers.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.claims.from')}</label>
                  <input type="date" value={period.start} onChange={(e) => { setPeriod({ ...period, start: e.target.value }); setEligible(null); }} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.claims.to')}</label>
                  <input type="date" value={period.end} onChange={(e) => { setPeriod({ ...period, end: e.target.value }); setEligible(null); }} className={inputClass} />
                </div>
              </div>
              <button onClick={findEligible} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                {t('ins.claims.findInvoices')}
              </button>

              {eligible && (eligible.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('ins.claims.noEligible')}</p>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                        <th className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={t('ins.claims.selectAll')}
                            checked={selected.size === eligible.length}
                            onChange={(e) => setSelected(e.target.checked ? new Set(eligible.map((i) => i.id)) : new Set())}
                          />
                        </th>
                        <th className="px-3 py-2">{t('ins.claims.invoice')}</th>
                        <th className="px-3 py-2">{t('ins.claims.patient')}</th>
                        <th className="px-3 py-2">{t('ins.coverage.member')}</th>
                        <th className="px-3 py-2">{t('ins.claims.date')}</th>
                        <th className="px-3 py-2 text-right">{t('ins.claims.invoiceTotal')}</th>
                        <th className="px-3 py-2 text-right">{t('ins.claims.toClaim')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {eligible.map((inv) => (
                        <tr key={inv.id}>
                          <td className="px-3 py-2"><input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggle(inv.id)} aria-label={inv.invoiceNumber} /></td>
                          <td className="px-3 py-2 font-mono text-gray-900 dark:text-white">
                            {inv.invoiceNumber}
                            {inv.preAuthNumber && <span className="block text-xs text-gray-500 dark:text-gray-400">{t('ins.preAuth.short')} {inv.preAuthNumber}</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{inv.patientName}<span className="block text-xs text-gray-500 dark:text-gray-400">{inv.patientHospitalId}</span></td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{inv.memberNumber ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{formatDate(inv.createdAt)}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{formatCurrency(inv.total)}</td>
                          <td className="px-3 py-2 text-right font-medium text-blue-700 dark:text-blue-400">{formatCurrency(inv.insurerBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 text-sm flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('ins.claims.selectedCount', { count: selected.size })}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedTotal)}</span>
                  </div>
                </div>
              ))}

              {eligible && eligible.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.notes')}</label>
                  <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">{t('ins.cancel')}</button>
              <button onClick={create} disabled={busy || !eligible || selected.size === 0} className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50">
                {t('ins.claims.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
