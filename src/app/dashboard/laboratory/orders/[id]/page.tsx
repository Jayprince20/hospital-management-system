'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, LabHistoryEntry, LabOrderDetail, LabOrderDetailItem } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';
import { ageInYears, flagSymbol, formatRange, isCriticalFlag, parseNumeric, resultFlag, selectRange } from '@/lib/lab';
import {
  ContainerBadge,
  CriticalMarker,
  DialogShell,
  ErrorBox,
  FlaggedValue,
  LabPriorityBadge,
  ResultStatusChip,
  SampleStatusChip,
  cancelBtn,
  cardClass,
  inputClass,
  labelClass,
  messageOf,
  primaryBtn,
  smallBtn,
  useIsBiologist,
  useLabPdf,
} from '@/components/lab/ui';
import { RejectDialog } from '@/components/lab/scan-panel';
import { OnCallSuggestion } from '@/components/rosters/on-call';
import { InstrumentBadge, QcWarningBanner } from '@/components/lab-qc';
import { isQcBlock, qcWarningLines, type QcWarning } from '@/lib/lab-qc';

type Draft = { value: string; notes: string };

const ORDER_STATUS_STYLE: Record<string, string> = {
  ORDERED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  SAMPLE_COLLECTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  PROCESSING: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

export default function LabOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { user, checkPermission } = useAuth();
  const { t, tEnum, formatDate, formatDateTime } = useLanguage();
  const toast = useToast();
  const pdf = useLabPdf();
  const isBiologist = useIsBiologist();

  const role = user?.role;
  const isTech = role === 'LAB_TECH' || role === 'ADMIN';
  const canEnter = isTech || isBiologist;
  const canCollect = role === 'ADMIN' || role === 'DOCTOR' || role === 'NURSE' || role === 'LAB_TECH';
  const canBill = role === 'ADMIN' || role === 'RECEPTIONIST';
  const canCancel = checkPermission('laboratory:enter_results') || checkPermission('laboratory:create_orders');

  const [order, setOrder] = useState<LabOrderDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [history, setHistory] = useState<Record<string, LabHistoryEntry[]>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [criticalDialog, setCriticalDialog] = useState<string[] | null>(null);
  const [rerunItem, setRerunItem] = useState<LabOrderDetailItem | null>(null);
  const [rejectBarcode, setRejectBarcode] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [qcWarning, setQcWarning] = useState<QcWarning>(null);
  // Validation refused by the server because QC is not in control: ids and calledTo to retry with a reason
  const [qcBlocked, setQcBlocked] = useState<{ ids: string[]; message: string; lines: string[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getLabOrderDetail(orderId);
      setOrder(data);
      setLoadError('');
      setDrafts((prev) => {
        const next: Record<string, Draft> = {};
        for (const item of data.items) next[item.id] = prev[item.id] ?? { value: item.status === 'ENTERED' ? item.result ?? '' : '', notes: item.notes ?? '' };
        return next;
      });
    } catch (err) {
      setLoadError(messageOf(err, t('labw.detail.notFound')));
    }
  }, [orderId, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Previous results of the same tests (delta check), loaded once per item
  const itemIds = useMemo(() => order?.items.map((i) => i.id).join(',') ?? '', [order]);
  useEffect(() => {
    if (!itemIds) return;
    let live = true;
    for (const id of itemIds.split(',')) {
      api
        .getLabItemHistory(orderId, id)
        .then((h) => live && setHistory((prev) => ({ ...prev, [id]: h })))
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [itemIds, orderId]);

  const sex = order?.patient.gender ?? null;
  const age = ageInYears(order?.patient.dateOfBirth);
  const samplesById = useMemo(() => new Map((order?.samples ?? []).map((s) => [s.id, s])), [order]);

  if (loadError && !order) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 dark:text-red-400 mb-4">{loadError}</p>
        <Link href="/dashboard/laboratory" className="text-lime-700 dark:text-lime-400 hover:underline">{t('labw.back')}</Link>
      </div>
    );
  }
  if (!order) return <p className="text-center py-16 text-gray-500 dark:text-gray-400">{t('labw.loading')}</p>;

  const closed = order.status === 'CANCELLED';
  const sampleOf = (item: LabOrderDetailItem) => (item.sampleId ? samplesById.get(item.sampleId) : undefined);
  const toCollect = order.items.filter((i) => (i.status ?? 'PENDING') === 'PENDING' && (!i.sampleId || sampleOf(i)?.status === 'REJECTED'));
  const editable = (i: LabOrderDetailItem) => canEnter && !closed && (i.status === 'PENDING' || i.status === 'ENTERED' || !i.status) && sampleOf(i)?.status === 'RECEIVED';
  const entered = order.items.filter((i) => i.status === 'ENTERED');
  const anyReleased = order.items.some((i) => i.status === 'RELEASED');

  const appliedRange = (i: LabOrderDetailItem) => {
    const r = selectRange(i.labTest, sex as 'MALE' | 'FEMALE' | null, age);
    // The server stores the range it applied: prefer it once the result exists
    if (i.refLow != null || i.refHigh != null) return { ...r, low: parseNumeric(String(i.refLow ?? '')), high: parseNumeric(String(i.refHigh ?? '')) };
    return r;
  };

  const collect = async () => {
    setBusy('collect');
    setError('');
    try {
      const samples = await api.collectLabSamples(order.id);
      toast.success(t('labw.samples.collected', { n: samples.length }));
      await load();
      await pdf.labels(order.id, samples.map((s) => s.id));
    } catch (err) {
      setError(messageOf(err, t('labw.actionFailed')));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const results: Array<{ itemId: string; value: string; notes?: string }> = [];
    for (const item of order.items) {
      if (!editable(item)) continue;
      const d = drafts[item.id];
      if (!d || !d.value.trim()) continue;
      if ((item.labTest.resultType ?? 'NUMERIC') === 'NUMERIC' && parseNumeric(d.value) == null) {
        return setError(t('labw.results.invalidNumber', { test: item.labTest.name }));
      }
      if (d.value === (item.result ?? '') && d.notes === (item.notes ?? '') && item.status === 'ENTERED') continue;
      results.push({ itemId: item.id, value: d.value.trim(), ...(d.notes.trim() ? { notes: d.notes.trim() } : {}) });
    }
    if (results.length === 0) return setError(t('labw.results.nothing'));
    setBusy('save');
    setError('');
    try {
      await api.saveLabResults(order.id, results);
      toast.success(t('labw.results.saved', { n: results.length }));
      await load();
    } catch (err) {
      setError(messageOf(err, t('labw.actionFailed')));
    } finally {
      setBusy(null);
    }
  };

  const validate = async (ids: string[], calledTo?: string, qcOverrideReason?: string) => {
    setBusy('validate');
    setError('');
    try {
      if (calledTo) {
        for (const item of order.items.filter((i) => ids.includes(i.id) && i.isCritical && !i.criticalCalledAt)) {
          await api.documentLabCriticalCall(order.id, item.id, calledTo);
        }
      }
      const res = await api.validateLabResults(order.id, { itemIds: ids, ...(qcOverrideReason ? { qcOverrideReason } : {}) });
      toast.success(qcOverrideReason ? t('qc.validate.done', { n: ids.length }) : t('labw.validate.done', { n: ids.length }));
      setQcWarning(qcWarningLines(res.qcWarning).length > 0 ? res.qcWarning : null);
      setQcBlocked(null);
      setSelected([]);
      setCriticalDialog(null);
      await load();
    } catch (err) {
      const message = messageOf(err, t('labw.actionFailed'));
      if (isQcBlock(err)) {
        // QC enforcement 'block': a biologist may retry with a reason
        setCriticalDialog(null);
        setQcBlocked({ ids, message, lines: qcWarningLines((err as { data?: unknown }).data as QcWarning) });
      } else {
        setError(message);
        toast.error(t('labw.validate.failed'), message);
      }
    } finally {
      setBusy(null);
    }
  };

  const startValidate = (ids: string[]) => {
    if (ids.length === 0) return;
    const uncalled = order.items.filter((i) => ids.includes(i.id) && (i.isCritical || isCriticalFlag(i.flag)) && !i.criticalCalledAt);
    if (uncalled.length > 0) setCriticalDialog(ids);
    else validate(ids);
  };

  const bill = async () => {
    setBusy('bill');
    try {
      const { invoice } = await api.billLabOrder(order.id);
      toast.success(t('labw.billing.done', { number: invoice.invoiceNumber }));
      await load();
    } catch (err) {
      toast.error(t('labw.billing.failed'), messageOf(err, ''));
    } finally {
      setBusy(null);
    }
  };

  const cancelOrder = async () => {
    try {
      await api.cancelLabOrder(order.id);
      toast.success(t('labw.detail.cancelled'));
      router.push('/dashboard/laboratory');
    } catch (err) {
      toast.error(t('labw.actionFailed'), messageOf(err, ''));
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/laboratory" className="text-sm text-lime-700 dark:text-lime-400 hover:underline">← {t('labw.back')}</Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{order.number ?? t('labw.detail.title')}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_STYLE[order.status] ?? ''}`}>{tEnum(order.status)}</span>
            <LabPriorityBadge priority={order.priority} />
            {order.items.some((i) => i.isCritical) && <CriticalMarker />}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('labw.detail.orderedOn', { date: formatDateTime(order.createdAt) })}
            {order.releasedAt ? ` · ${t('labw.detail.releasedOn', { date: formatDateTime(order.releasedAt) })}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {anyReleased && (
            <button type="button" onClick={() => pdf.report(order.id)} disabled={pdf.busy !== null} className={primaryBtn}>{t('labw.detail.report')}</button>
          )}
          {canCancel && !closed && order.status !== 'COMPLETED' && (
            <button type="button" onClick={() => setShowCancel(true)} className={cancelBtn}>{t('labw.detail.cancel')}</button>
          )}
        </div>
      </div>

      {/* Patient / prescriber / clinical information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${cardClass} p-4`}>
          <h2 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">{t('labw.detail.patient')}</h2>
          <Link href={`/dashboard/patients/${order.patient.id}`} className="font-medium text-gray-900 dark:text-white hover:underline">
            {order.patient.firstName} {order.patient.lastName}
          </Link>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {order.patient.patientId}
            {sex ? ` · ${t(`labw.sex.${sex}`)}` : ''}
            {age != null ? ` · ${t('labw.years', { n: age })}` : ''}
          </p>
          {order.patient.dateOfBirth && <p className="text-xs text-gray-500 dark:text-gray-400">{t('labw.detail.born', { date: formatDate(order.patient.dateOfBirth) })}</p>}
        </div>
        <div className={`${cardClass} p-4`}>
          <h2 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">{t('labw.detail.prescriber')}</h2>
          <p className="font-medium text-gray-900 dark:text-white">Dr {order.doctor.firstName} {order.doctor.lastName}</p>
          {order.doctor.department && <p className="text-sm text-gray-600 dark:text-gray-400">{order.doctor.department}</p>}
          {order.admissionId && (
            <Link href={`/dashboard/admissions/${order.admissionId}`} className="text-sm text-lime-700 dark:text-lime-400 hover:underline">{t('labw.detail.stay')}</Link>
          )}
        </div>
        <div className={`${cardClass} p-4`}>
          <h2 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">{t('labw.detail.clinical')}</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{order.clinicalInfo || order.notes || t('labw.detail.noClinical')}</p>
        </div>
      </div>

      {/* Samples */}
      <section className={`${cardClass} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('labw.samples.title')}</h2>
          <div className="flex flex-wrap gap-2">
            {canCollect && !closed && toCollect.length > 0 && (
              <button type="button" onClick={collect} disabled={busy !== null} className={primaryBtn}>{t('labw.samples.collect', { n: toCollect.length })}</button>
            )}
            {(order.samples ?? []).length > 0 && (
              <button type="button" onClick={() => pdf.labels(order.id)} disabled={pdf.busy !== null} className={smallBtn}>{t('labw.samples.printAll')}</button>
            )}
          </div>
        </div>
        {(order.samples ?? []).length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('labw.samples.none')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {(order.samples ?? []).map((s) => (
              <li key={s.id} className="py-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-mono text-gray-900 dark:text-white">{s.barcode}</span>
                <ContainerBadge container={s.container} />
                <span className="text-gray-600 dark:text-gray-400">{s.sampleType}</span>
                <SampleStatusChip status={s.status} />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('labw.samples.collectedAt', { date: formatDateTime(s.collectedAt) })}
                  {s.receivedAt ? ` · ${t('labw.samples.receivedAt', { date: formatDateTime(s.receivedAt) })}` : ''}
                </span>
                {s.status === 'REJECTED' && (
                  <span className="text-xs text-red-700 dark:text-red-400">
                    {t(`labw.reject.${s.rejectionReason ?? 'OTHER'}`)}{s.rejectionNote ? ` — ${s.rejectionNote}` : ''}
                  </span>
                )}
                <span className="ml-auto flex gap-2">
                  {isTech && s.status === 'COLLECTED' && (
                    <>
                      <button
                        type="button"
                        className={smallBtn}
                        disabled={busy !== null}
                        onClick={async () => {
                          setBusy('receive');
                          try {
                            await api.receiveLabSample(s.barcode);
                            toast.success(t('labw.scan.received', { code: s.barcode }));
                            await load();
                          } catch (err) {
                            setError(messageOf(err, t('labw.actionFailed')));
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        {t('labw.scan.receive')}
                      </button>
                      <button type="button" className={smallBtn} onClick={() => setRejectBarcode(s.barcode)}>{t('labw.scan.reject')}</button>
                    </>
                  )}
                  {s.status !== 'REJECTED' && (
                    <button type="button" className={smallBtn} onClick={() => pdf.labels(order.id, [s.id])}>{t('labw.samples.reprint')}</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Results */}
      <section className={`${cardClass} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('labw.results.title')}</h2>
          {isBiologist && entered.length > 0 && <p className="text-sm text-amber-700 dark:text-amber-400">{t('labw.toValidateN', { n: entered.length })}</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                {isBiologist && <th className="py-2 pr-2" />}
                <th className="py-2 pr-3">{t('labw.col.test')}</th>
                <th className="py-2 pr-3">{t('labw.col.result')}</th>
                <th className="py-2 pr-3">{t('labw.col.reference')}</th>
                <th className="py-2 pr-3">{t('labw.col.previous')}</th>
                <th className="py-2 pr-3">{t('labw.col.status')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {order.items.map((item) => {
                const test = item.labTest;
                const type = test.resultType ?? 'NUMERIC';
                const range = appliedRange(item);
                const draft = drafts[item.id] ?? { value: '', notes: '' };
                const canEdit = editable(item);
                const preview = canEdit ? resultFlag(type, draft.value, range, test.options ?? []) : (item.flag ?? null);
                const critical = item.isCritical || isCriticalFlag(preview);
                const prev = (history[item.id] ?? [])[0];
                const sample = sampleOf(item);
                return (
                  <tr key={item.id} className={critical ? 'bg-red-50/70 dark:bg-red-900/10' : ''}>
                    {isBiologist && (
                      <td className="py-2.5 pr-2 align-top">
                        {item.status === 'ENTERED' && (
                          <input
                            type="checkbox"
                            aria-label={t('labw.validate.select', { test: test.name })}
                            checked={selected.includes(item.id)}
                            onChange={(e) => setSelected((s) => (e.target.checked ? [...s, item.id] : s.filter((x) => x !== item.id)))}
                          />
                        )}
                      </td>
                    )}
                    <td className="py-2.5 pr-3 align-top">
                      <p className="font-medium text-gray-900 dark:text-white">{test.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span>{test.code}</span>
                        <ContainerBadge container={test.container ?? sample?.container} />
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 align-top min-w-[14rem]">
                      {canEdit ? (
                        <div className="space-y-1">
                          {item.source === 'INSTRUMENT' && item.status === 'ENTERED' && <InstrumentBadge code={item.instrument?.code} />}
                          {type === 'OPTION' ? (
                            <select
                              aria-label={t('labw.results.valueFor', { test: test.name })}
                              value={draft.value}
                              onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...draft, value: e.target.value } }))}
                              className={inputClass}
                            >
                              <option value="">—</option>
                              {(test.options ?? []).map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          ) : type === 'TEXT' ? (
                            <textarea
                              aria-label={t('labw.results.valueFor', { test: test.name })}
                              rows={2}
                              value={draft.value}
                              onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...draft, value: e.target.value } }))}
                              className={inputClass}
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                aria-label={t('labw.results.valueFor', { test: test.name })}
                                inputMode="decimal"
                                value={draft.value}
                                onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...draft, value: e.target.value } }))}
                                className={`${inputClass} w-28`}
                              />
                              <span className="text-gray-500 dark:text-gray-400">{test.unit}</span>
                              {preview && preview !== 'N' && <span className={isCriticalFlag(preview) ? 'text-red-700 dark:text-red-400 font-bold' : 'text-orange-600 dark:text-orange-400 font-semibold'}>{flagSymbol(preview)}</span>}
                            </div>
                          )}
                          {isCriticalFlag(preview) && <p className="text-xs font-semibold text-red-700 dark:text-red-400">{t('labw.results.criticalPreview')}</p>}
                          <input
                            aria-label={t('labw.results.notesFor', { test: test.name })}
                            placeholder={t('labw.results.notes')}
                            value={draft.notes}
                            onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...draft, notes: e.target.value } }))}
                            className={`${inputClass} text-xs`}
                          />
                        </div>
                      ) : item.result ? (
                        <div>
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <FlaggedValue value={item.result} unit={item.unit ?? test.unit} flag={item.flag} />
                            {item.source === 'INSTRUMENT' && <InstrumentBadge code={item.instrument?.code} />}
                          </span>
                          {item.status === 'ENTERED' && <p className="text-xs text-amber-700 dark:text-amber-400">{t('labw.results.notValidated')}</p>}
                          {item.qcOverrideReason && <p className="text-xs text-amber-800 dark:text-amber-300">{t('qc.validate.overridden', { reason: item.qcOverrideReason })}</p>}
                          {item.notes && <p className="text-xs text-gray-500 dark:text-gray-400">{item.notes}</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {!sample ? t('labw.results.waitingCollection') : sample.status === 'COLLECTED' ? t('labw.results.waitingReception') : sample.status === 'REJECTED' ? t('labw.results.recollect') : t('labw.results.waitingEntry')}
                        </span>
                      )}
                      {item.criticalCalledAt && (
                        <p className="text-xs text-red-700 dark:text-red-400 mt-1">{t('labw.critical.called', { who: item.criticalCalledTo ?? '—', date: formatDateTime(item.criticalCalledAt) })}</p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 align-top text-gray-700 dark:text-gray-300">
                      {formatRange(range) || item.normalRange || test.normalRange || '—'}
                      {range.label && <p className="text-xs text-gray-500 dark:text-gray-400">{range.label}</p>}
                    </td>
                    <td className="py-2.5 pr-3 align-top">
                      {prev ? (
                        <div>
                          <FlaggedValue value={prev.value} unit={test.unit} flag={prev.flag} />
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(prev.date)}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 align-top">
                      <ResultStatusChip status={item.status} />
                      {item.validatedByName && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('labw.results.validatedBy', { name: item.validatedByName })}</p>}
                      {(item.rerunCount ?? 0) > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{t('labw.results.reruns', { n: item.rerunCount ?? 0 })}</p>}
                    </td>
                    <td className="py-2.5 align-top text-right whitespace-nowrap">
                      {((canEnter && item.status === 'ENTERED') || (isBiologist && item.status === 'RELEASED')) && !closed && (
                        <button type="button" className={smallBtn} onClick={() => setRerunItem(item)}>{t('labw.rerun.action')}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {error && <div className="mt-3"><ErrorBox message={error} /></div>}
        {qcWarning && <div className="mt-3"><QcWarningBanner warning={qcWarning} onDismiss={() => setQcWarning(null)} /></div>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {canEnter && order.items.some(editable) && (
            <button type="button" onClick={save} disabled={busy !== null} className={primaryBtn}>{t('labw.results.save')}</button>
          )}
          {isBiologist && entered.length > 0 && (
            <>
              <button type="button" onClick={() => startValidate(selected)} disabled={busy !== null || selected.length === 0} className={cancelBtn}>
                {t('labw.validate.selected', { n: selected.length })}
              </button>
              <button type="button" onClick={() => startValidate(entered.map((i) => i.id))} disabled={busy !== null} className={primaryBtn}>
                {t('labw.validate.all')}
              </button>
            </>
          )}
        </div>
      </section>

      {/* Billing */}
      <section className={`${cardClass} p-4 flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('labw.billing.title')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {order.invoice ? (
              <Link href={`/dashboard/billing/${order.invoice.id}`} className="text-lime-700 dark:text-lime-400 hover:underline">
                {t('labw.billing.invoice', { number: order.invoice.invoiceNumber })}
              </Link>
            ) : order.chargedToStay ? (
              t('labw.billing.stay')
            ) : (
              t('labw.billing.notBilled')
            )}
          </p>
        </div>
        {canBill && !order.invoice && !order.invoiceId && !order.chargedToStay && !closed && (
          <button type="button" onClick={bill} disabled={busy !== null} className={primaryBtn}>{t('labw.billing.bill')}</button>
        )}
      </section>

      {criticalDialog && (
        <CriticalCallDialog
          items={order.items.filter((i) => criticalDialog.includes(i.id) && (i.isCritical || isCriticalFlag(i.flag)) && !i.criticalCalledAt)}
          doctorName={`Dr ${order.doctor.firstName} ${order.doctor.lastName}`}
          doctorId={order.doctor.id}
          busy={busy === 'validate'}
          onClose={() => setCriticalDialog(null)}
          onConfirm={(calledTo) => validate(criticalDialog, calledTo)}
        />
      )}
      {qcBlocked && (
        <QcOverrideDialog
          message={qcBlocked.message}
          lines={qcBlocked.lines}
          canOverride={isBiologist}
          busy={busy === 'validate'}
          onClose={() => setQcBlocked(null)}
          onConfirm={(reason) => validate(qcBlocked.ids, undefined, reason)}
        />
      )}
      {rerunItem && (
        <RerunDialog
          item={rerunItem}
          onClose={() => setRerunItem(null)}
          onConfirm={async (reason) => {
            try {
              await api.rerunLabItem(order.id, rerunItem.id, reason);
              toast.success(t('labw.rerun.done', { test: rerunItem.labTest.name }));
              setRerunItem(null);
              setDrafts((d) => ({ ...d, [rerunItem.id]: { value: '', notes: '' } }));
              await load();
            } catch (err) {
              toast.error(t('labw.actionFailed'), messageOf(err, ''));
            }
          }}
        />
      )}
      {rejectBarcode && (
        <RejectDialog
          barcode={rejectBarcode}
          onClose={() => setRejectBarcode(null)}
          onDone={() => {
            setRejectBarcode(null);
            load();
          }}
        />
      )}
      <ConfirmModal
        isOpen={showCancel}
        title={t('labw.detail.cancelTitle')}
        message={t('labw.detail.cancelMessage')}
        confirmText={t('labw.detail.cancel')}
        variant="danger"
        onConfirm={cancelOrder}
        cancelText={t('labw.cancel')}
        onClose={() => setShowCancel(false)}
      />
    </div>
  );
}

function CriticalCallDialog({
  items,
  doctorName,
  doctorId,
  busy,
  onClose,
  onConfirm,
}: {
  items: LabOrderDetailItem[];
  doctorName: string;
  doctorId?: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (calledTo: string) => void;
}) {
  const { t } = useLanguage();
  const [calledTo, setCalledTo] = useState(doctorName);
  return (
    <DialogShell
      title={t('labw.critical.title')}
      subtitle={t('labw.critical.subtitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('labw.cancel')}</button>
          <button type="button" onClick={() => calledTo.trim() && onConfirm(calledTo.trim())} disabled={busy || !calledTo.trim()} className={primaryBtn}>
            {t('labw.critical.confirm')}
          </button>
        </>
      }
    >
      <ul className="text-sm space-y-1">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span className="text-gray-800 dark:text-gray-200">{i.labTest.name}</span>
            <FlaggedValue value={i.result ?? ''} unit={i.unit ?? i.labTest.unit} flag={i.flag} />
          </li>
        ))}
      </ul>
      <div>
        <label htmlFor="critical-called" className={labelClass}>{t('labw.critical.calledTo')}</label>
        <input id="critical-called" value={calledTo} onChange={(e) => setCalledTo(e.target.value)} className={inputClass} />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('labw.critical.hint')}</p>
      </div>
      {/* If the prescriber can't be reached: who is on call in their department */}
      <OnCallSuggestion doctorId={doctorId} onPick={setCalledTo} />
    </DialogShell>
  );
}

/**
 * The server refused validation because today's QC is not in control ('block' mode). A biologist
 * may validate anyway with a reason, recorded on each result; others can only close.
 */
function QcOverrideDialog({
  message,
  lines,
  canOverride,
  busy,
  onClose,
  onConfirm,
}: {
  message: string;
  lines: string[];
  canOverride: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const confirm = () => {
    if (reason.trim().length < 10) return setError(t('qc.validate.reasonRequired'));
    onConfirm(reason.trim());
  };
  return (
    <DialogShell
      title={t('qc.validate.blockedTitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('common.close')}</button>
          {canOverride && (
            <button type="button" onClick={confirm} disabled={busy} className={primaryBtn}>{t('qc.validate.override')}</button>
          )}
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <div role="alert" className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          <p className="font-semibold">{message}</p>
          <p className="mt-1">{t('qc.validate.blockedBody')}</p>
          {lines.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {lines.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          )}
        </div>
        {canOverride ? (
          <div>
            <label htmlFor="qc-override-reason" className={labelClass}>{t('qc.validate.reason')}</label>
            <textarea
              id="qc-override-reason"
              rows={3}
              className={inputClass}
              placeholder={t('qc.validate.reasonPlaceholder')}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
            />
            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
          </div>
        ) : (
          <p className="text-gray-700 dark:text-gray-300">{t('qc.validate.notBiologist')}</p>
        )}
      </div>
    </DialogShell>
  );
}

function RerunDialog({ item, onClose, onConfirm }: { item: LabOrderDetailItem; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <DialogShell
      title={t('labw.rerun.title', { test: item.labTest.name })}
      subtitle={t('labw.rerun.subtitle')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('labw.cancel')}</button>
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true);
              await onConfirm(reason.trim());
              setBusy(false);
            }}
            className={primaryBtn}
          >
            {t('labw.rerun.confirm')}
          </button>
        </>
      }
    >
      <label htmlFor="rerun-reason" className={labelClass}>{t('labw.rerun.reason')}</label>
      <textarea id="rerun-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
    </DialogShell>
  );
}
