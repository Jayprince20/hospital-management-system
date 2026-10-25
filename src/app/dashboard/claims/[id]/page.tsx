'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ClaimAction, ClaimDetail, ClaimLine, ClaimSettlementInput } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { ConfirmModal } from '@/components/confirm-modal';
import { claimLineStatusColor, claimStatusColor } from '@/components/insurance/status-colors';
import { settlementLineError } from '@/lib/insurance';

interface LineDraft {
  include: boolean;
  approved: string;
  paid: string;
  reason: string;
}

type Confirmable = { kind: 'submit' } | { kind: 'close' } | { kind: 'delete' } | { kind: 'remove'; line: ClaimLine } | { kind: 'transfer'; line: ClaimLine };

const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm';

/** A line still waiting for (part of) the insurer's money */
const isOpenLine = (line: ClaimLine) => line.status !== 'PAID' && line.status !== 'REJECTED';
/** Amount the insurer refused on this line, which can be billed to the patient */
const refusedAmount = (line: ClaimLine) => (line.amountApproved != null ? Math.max(0, line.amountClaimed - line.amountApproved) : 0);

export default function ClaimDetailPage() {
  const params = useParams();
  const router = useRouter();
  const claimId = params.id as string;
  const { t, formatCurrency, formatDate, formatDateTime, language } = useLanguage();
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirmable | null>(null);

  const [showSettlement, setShowSettlement] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [settlement, setSettlement] = useState({ paidAt: toDay(new Date()), method: 'BANK_TRANSFER' as NonNullable<ClaimSettlementInput['method']>, referenceNumber: '', notes: '' });
  const [settlementError, setSettlementError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setClaim(await api.getClaim(claimId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ins.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [claimId, t]);

  useEffect(() => { load(); }, [load]);

  const act = async (action: ClaimAction) => {
    try {
      setBusy(true);
      setActionError('');
      setClaim(await api.updateClaim(claimId, action));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('ins.saveFailed'));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    if (confirm.kind === 'submit') return act({ action: 'submit' });
    if (confirm.kind === 'close') return act({ action: 'close' });
    if (confirm.kind === 'remove') return act({ action: 'remove-line', lineId: confirm.line.id });
    if (confirm.kind === 'transfer') return act({ action: 'transfer-rejected', lineId: confirm.line.id });
    try {
      setBusy(true);
      await api.deleteClaim(claimId);
      router.push('/dashboard/claims');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('ins.saveFailed'));
      setBusy(false);
      setConfirm(null);
    }
  };

  const download = async (format: 'csv' | 'pdf') => {
    try {
      setActionError('');
      await api.downloadClaimExport(claimId, format, language === 'en' ? 'en' : 'fr');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('ins.claim.exportFailed'));
    }
  };

  const openSettlement = () => {
    if (!claim) return;
    const next: Record<string, LineDraft> = {};
    for (const line of claim.lines.filter(isOpenLine)) {
      const approved = line.amountApproved ?? line.amountClaimed;
      next[line.id] = { include: true, approved: String(approved), paid: String(Math.max(0, approved - line.amountPaid)), reason: line.rejectionReason ?? '' };
    }
    setDrafts(next);
    setSettlement({ paidAt: toDay(new Date()), method: 'BANK_TRANSFER', referenceNumber: '', notes: '' });
    setSettlementError('');
    setShowSettlement(true);
  };

  const lineProblem = (line: ClaimLine): string | null => {
    const draft = drafts[line.id];
    if (!draft?.include) return null;
    const code = settlementLineError({
      amountClaimed: line.amountClaimed,
      amountApproved: Number(draft.approved || 0),
      amountPaid: Number(draft.paid || 0),
      alreadyPaid: line.amountPaid,
      rejectionReason: draft.reason,
    });
    return code ? t(`ins.settle.err.${code}`) : null;
  };

  const saveSettlement = async () => {
    if (!claim) return;
    const lines = claim.lines.filter((l) => drafts[l.id]?.include);
    if (lines.length === 0) { setSettlementError(t('ins.settle.noLines')); return; }
    if (lines.some((l) => lineProblem(l))) { setSettlementError(t('ins.settle.fixLines')); return; }
    try {
      setBusy(true);
      setSettlementError('');
      const updated = await api.recordClaimSettlement(claimId, {
        paidAt: settlement.paidAt,
        method: settlement.method,
        referenceNumber: settlement.referenceNumber.trim() || undefined,
        notes: settlement.notes.trim() || undefined,
        lines: lines.map((l) => ({
          lineId: l.id,
          amountApproved: Number(drafts[l.id].approved || 0),
          amountPaid: Number(drafts[l.id].paid || 0),
          rejectionReason: drafts[l.id].reason.trim() || undefined,
        })),
      });
      setClaim(updated);
      setShowSettlement(false);
    } catch (err) {
      setSettlementError(err instanceof Error ? err.message : t('ins.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const setDraft = (id: string, patch: Partial<LineDraft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  if (loading) {
    return <div className="flex justify-center items-center min-h-[400px]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600" /></div>;
  }
  if (error || !claim) {
    return (
      <div className="max-w-3xl mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-700 dark:text-red-300 mb-4">{error || t('ins.claim.notFound')}</p>
        <Link href="/dashboard/claims" className="text-lime-600 hover:underline">{t('ins.claim.back')}</Link>
      </div>
    );
  }

  const isDraft = claim.status === 'DRAFT';
  const canSettle = claim.status === 'SUBMITTED' || claim.status === 'PARTIALLY_PAID';
  const canClose = claim.status !== 'DRAFT' && claim.status !== 'CLOSED';
  const settlementTotal = claim.lines.filter((l) => drafts[l.id]?.include).reduce((sum, l) => sum + Number(drafts[l.id].paid || 0), 0);

  const confirmText: Record<Confirmable['kind'], { title: string; message: string; danger?: boolean }> = {
    submit: { title: t('ins.claim.submitTitle'), message: t('ins.claim.submitText', { payer: claim.payer.name }) },
    close: { title: t('ins.claim.closeTitle'), message: t('ins.claim.closeText'), danger: true },
    delete: { title: t('ins.claim.deleteTitle'), message: t('ins.claim.deleteText'), danger: true },
    remove: { title: t('ins.claim.removeTitle'), message: t('ins.claim.removeText', { number: confirm?.kind === 'remove' ? confirm.line.invoiceNumber : '' }) },
    transfer: {
      title: t('ins.claim.transferTitle'),
      message: t('ins.claim.transferText', {
        amount: formatCurrency(confirm?.kind === 'transfer' ? refusedAmount(confirm.line) : 0),
        number: confirm?.kind === 'transfer' ? confirm.line.invoiceNumber : '',
      }),
    },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/claims" className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" aria-label={t('ins.claim.back')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ins.claim.title', { number: claim.number })}</h1>
              <span className={`px-2 py-1 rounded text-xs font-medium ${claimStatusColor(claim.status)}`}>{t(`ins.claimStatus.${claim.status}`)}</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {claim.payer.name} · {formatDate(claim.periodStart)} – {formatDate(claim.periodEnd)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => download('pdf')} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">{t('ins.claim.exportPdf')}</button>
          <button onClick={() => download('csv')} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">{t('ins.claim.exportCsv')}</button>
          {isDraft && (
            <>
              <button onClick={() => setConfirm({ kind: 'delete' })} disabled={busy} className="px-3 py-2 text-sm border border-red-300 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">{t('ins.claim.delete')}</button>
              <button onClick={() => setConfirm({ kind: 'submit' })} disabled={busy || claim.lines.length === 0} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50">{t('ins.claim.submit')}</button>
            </>
          )}
          {canClose && (
            <button onClick={() => setConfirm({ kind: 'close' })} disabled={busy} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">{t('ins.claim.close')}</button>
          )}
          {canSettle && (
            <button onClick={openSettlement} disabled={busy} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{t('ins.claim.recordSettlement')}</button>
          )}
        </div>
      </div>

      {actionError && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{actionError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: t('ins.claims.claimed'), value: formatCurrency(claim.totalClaimed), cls: 'text-gray-900 dark:text-white' },
          { label: t('ins.claims.approved'), value: claim.totalApproved != null ? formatCurrency(claim.totalApproved) : '—', cls: 'text-blue-700 dark:text-blue-400' },
          { label: t('ins.claims.paid'), value: formatCurrency(claim.totalPaid), cls: 'text-green-600' },
          { label: t('ins.claims.outstanding'), value: formatCurrency(claim.outstanding), cls: 'text-orange-600' },
          {
            label: t('ins.claims.due'),
            value: claim.dueDate ? formatDate(claim.dueDate) : t('ins.claim.notSubmitted'),
            cls: claim.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white',
          },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className={`text-xl font-bold ${card.cls}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ins.claim.lines', { count: claim.lines.length })}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {[
              claim.submittedAt ? t('ins.claim.submittedOn', { date: formatDate(claim.submittedAt) }) : null,
              claim.closedAt ? t('ins.claim.closedOn', { date: formatDate(claim.closedAt) }) : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                <th className="px-4 py-3">{t('ins.claims.invoice')}</th>
                <th className="px-4 py-3">{t('ins.claims.patient')}</th>
                <th className="px-4 py-3">{t('ins.coverage.member')}</th>
                <th className="px-4 py-3 text-right">{t('ins.claims.claimed')}</th>
                <th className="px-4 py-3 text-right">{t('ins.claims.approved')}</th>
                <th className="px-4 py-3 text-right">{t('ins.claims.paid')}</th>
                <th className="px-4 py-3">{t('ins.status')}</th>
                <th className="px-4 py-3">{t('ins.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {claim.lines.map((line) => (
                <tr key={line.id} className="align-top">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/billing/${line.invoiceId}`} className="font-mono text-lime-600 dark:text-lime-400 hover:underline">{line.invoiceNumber}</Link>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{formatDate(line.invoiceDate)}{line.preAuthNumber ? ` · ${t('ins.preAuth.short')} ${line.preAuthNumber}` : ''}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{line.patientName}<span className="block text-xs text-gray-500 dark:text-gray-400">{line.patientHospitalId}</span></td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{line.memberNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{formatCurrency(line.amountClaimed)}</td>
                  <td className="px-4 py-3 text-right text-blue-700 dark:text-blue-400">{line.amountApproved != null ? formatCurrency(line.amountApproved) : '—'}</td>
                  <td className="px-4 py-3 text-right text-green-600">{formatCurrency(line.amountPaid)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${claimLineStatusColor(line.status)}`}>{t(`ins.lineStatus.${line.status}`)}</span>
                    {line.rejectionReason && <span className="block mt-1 text-xs text-red-600 dark:text-red-400">{line.rejectionReason}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {isDraft && (
                      <button onClick={() => setConfirm({ kind: 'remove', line })} className="text-red-600 hover:text-red-800 font-medium">{t('ins.claim.removeLine')}</button>
                    )}
                    {!isDraft && claim.status !== 'CLOSED' && refusedAmount(line) > 0 && (line.status === 'REJECTED' || line.status === 'PARTIALLY_ACCEPTED' || line.status === 'PAID') && (
                      <button onClick={() => setConfirm({ kind: 'transfer', line })} className="text-amber-700 hover:text-amber-900 dark:text-amber-400 font-medium text-left">
                        {t('ins.claim.transfer', { amount: formatCurrency(refusedAmount(line)) })}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ins.claim.payments')}</h2>
          </div>
          {claim.payments.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('ins.claim.noPayments')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                  <th className="px-4 py-3">{t('ins.claims.date')}</th>
                  <th className="px-4 py-3">{t('ins.claims.invoice')}</th>
                  <th className="px-4 py-3">{t('ins.settle.method')}</th>
                  <th className="px-4 py-3">{t('ins.settle.reference')}</th>
                  <th className="px-4 py-3 text-right">{t('ins.settle.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {claim.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{formatDateTime(p.processedAt)}</td>
                    <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-400">{claim.lines.find((l) => l.invoiceId === p.invoiceId)?.invoiceNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{t(`ins.method.${p.method}`)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.referenceNumber || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">+{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-2 text-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('ins.claim.payer')}</h2>
          <p className="font-medium text-gray-900 dark:text-white">{claim.payer.name} <span className="font-mono text-gray-500">({claim.payer.code})</span></p>
          {claim.payer.contactName && <p className="text-gray-600 dark:text-gray-400">{claim.payer.contactName}</p>}
          {claim.payer.phone && <p className="text-gray-600 dark:text-gray-400">{claim.payer.phone}</p>}
          {claim.payer.email && <p className="text-gray-600 dark:text-gray-400">{claim.payer.email}</p>}
          <p className="text-gray-600 dark:text-gray-400">{t('ins.payer.days', { days: claim.payer.paymentTermsDays })}</p>
          {claim.notes && <p className="pt-2 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{claim.notes}</p>}
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          isOpen
          title={confirmText[confirm.kind].title}
          message={confirmText[confirm.kind].message}
          variant={confirmText[confirm.kind].danger ? 'danger' : 'info'}
          isLoading={busy}
          confirmText={t('ins.confirm')}
          cancelText={t('ins.cancel')}
          onConfirm={runConfirmed}
          onClose={() => setConfirm(null)}
        />
      )}

      {showSettlement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('ins.claim.recordSettlement')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('ins.settle.hint')}</p>
            </div>
            <div className="p-6 space-y-5">
              {settlementError && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{settlementError}</div>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.settle.paidAt')}</label>
                  <input type="date" value={settlement.paidAt} onChange={(e) => setSettlement({ ...settlement, paidAt: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.settle.method')}</label>
                  <select value={settlement.method} onChange={(e) => setSettlement({ ...settlement, method: e.target.value as typeof settlement.method })} className={inputClass}>
                    {(['BANK_TRANSFER', 'CASH', 'CARD', 'MOBILE_WALLET'] as const).map((m) => <option key={m} value={m}>{t(`ins.method.${m}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.settle.reference')}</label>
                  <input value={settlement.referenceNumber} onChange={(e) => setSettlement({ ...settlement, referenceNumber: e.target.value })} placeholder={t('ins.settle.referenceHint')} className={inputClass} />
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                      <th className="px-3 py-2" />
                      <th className="px-3 py-2">{t('ins.claims.invoice')}</th>
                      <th className="px-3 py-2 text-right">{t('ins.claims.claimed')}</th>
                      <th className="px-3 py-2 text-right">{t('ins.settle.alreadyPaid')}</th>
                      <th className="px-3 py-2">{t('ins.claims.approved')}</th>
                      <th className="px-3 py-2">{t('ins.settle.paidNow')}</th>
                      <th className="px-3 py-2">{t('ins.settle.reason')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {claim.lines.filter(isOpenLine).map((line) => {
                      const draft = drafts[line.id];
                      if (!draft) return null;
                      const problem = lineProblem(line);
                      return (
                        <tr key={line.id} className="align-top">
                          <td className="px-3 py-2"><input type="checkbox" checked={draft.include} onChange={(e) => setDraft(line.id, { include: e.target.checked })} aria-label={line.invoiceNumber} /></td>
                          <td className="px-3 py-2">
                            <span className="font-mono text-gray-900 dark:text-white">{line.invoiceNumber}</span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400">{line.patientName}</span>
                            {problem && <span className="block text-xs text-red-600 dark:text-red-400">{problem}</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{formatCurrency(line.amountClaimed)}</td>
                          <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(line.amountPaid)}</td>
                          <td className="px-3 py-2 w-32">
                            <input type="number" min={0} max={line.amountClaimed} disabled={!draft.include} value={draft.approved}
                              onChange={(e) => setDraft(line.id, { approved: e.target.value, paid: String(Math.max(0, Number(e.target.value || 0) - line.amountPaid)) })}
                              className={inputClass} aria-label={t('ins.claims.approved')} />
                          </td>
                          <td className="px-3 py-2 w-32">
                            <input type="number" min={0} disabled={!draft.include} value={draft.paid} onChange={(e) => setDraft(line.id, { paid: e.target.value })} className={inputClass} aria-label={t('ins.settle.paidNow')} />
                          </td>
                          <td className="px-3 py-2 min-w-48">
                            <input disabled={!draft.include || Number(draft.approved || 0) >= line.amountClaimed} value={draft.reason} onChange={(e) => setDraft(line.id, { reason: e.target.value })} placeholder={t('ins.settle.reasonHint')} className={inputClass} aria-label={t('ins.settle.reason')} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.notes')}</label>
                <textarea rows={2} value={settlement.notes} onChange={(e) => setSettlement({ ...settlement, notes: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">{t('ins.settle.total', { amount: formatCurrency(settlementTotal) })}</p>
              <div className="flex gap-3">
                <button onClick={() => setShowSettlement(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">{t('ins.cancel')}</button>
                <button onClick={saveSettlement} disabled={busy} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{busy ? t('ins.saving') : t('ins.settle.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
