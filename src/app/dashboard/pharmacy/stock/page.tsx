'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api,
  type ExpiringBatch,
  type StockAdjustmentType,
  type StockBatch,
  type StockMedication,
  type StockMovementType,
  type StockMovementsResponse,
} from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import {
  DialogShell,
  ErrorBox,
  ExpiryBadge,
  RxBadge,
  cancelBtn,
  cardClass,
  inputClass,
  labelClass,
  messageOf,
  primaryBtn,
  smallBtn,
} from '@/components/pharmacy';
import { localDateString } from '@/lib/pharmacy-pos';

type Tab = 'stock' | 'receipt' | 'movements' | 'expiring';
const TABS: Tab[] = ['stock', 'receipt', 'movements', 'expiring'];
const MOVEMENT_TYPES: StockMovementType[] = ['RECEIPT', 'SALE', 'RETURN', 'DISPENSE', 'ADJUSTMENT', 'BREAKAGE', 'EXPIRED'];

export default function PharmacyStockPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('stock');
  const [medications, setMedications] = useState<StockMedication[] | null>(null);
  const [error, setError] = useState('');

  // The full catalogue with batches: small enough to load at once, reused by the receipt form
  const loadAll = useCallback(() => {
    api
      .getPharmacyStock()
      .then((list) => {
        setMedications(list);
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('pos.loadFailed'))));
  }, [t]);
  useEffect(() => loadAll(), [loadAll]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pos.stock.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('pos.stock.subtitle')}</p>
        </div>
        <Link href="/dashboard/pharmacy" className={cancelBtn}>{t('pos.stock.catalogue')}</Link>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === key ? 'border-lime-600 text-lime-700 dark:text-lime-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
          >
            {t(`pos.stock.tab.${key}`)}
          </button>
        ))}
      </div>

      <ErrorBox message={error} />
      {tab === 'stock' && <StockTab medications={medications} onChanged={loadAll} />}
      {tab === 'receipt' && <ReceiptTab medications={medications ?? []} onReceived={() => { loadAll(); setTab('stock'); }} />}
      {tab === 'movements' && <MovementsTab medications={medications ?? []} />}
      {tab === 'expiring' && <ExpiringTab onChanged={loadAll} />}
    </div>
  );
}

function StockTab({ medications, onChanged }: { medications: StockMedication[] | null; onChanged: () => void }) {
  const { t, formatCurrency } = useLanguage();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'expiring'>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [adjusting, setAdjusting] = useState<{ med: StockMedication; batch: StockBatch } | null>(null);

  const q = search.trim().toLowerCase();
  const visible = (medications ?? []).filter((m) => {
    if (q && !`${m.name} ${m.genericName} ${m.category}`.toLowerCase().includes(q)) return false;
    if (filter === 'low') return m.isLow || m.sellableQuantity <= m.reorderLevel;
    if (filter === 'expiring') return Boolean(m.hasExpiredStock) || m.batches.some((b) => b.quantity > 0 && (b.isExpired || b.daysToExpiry <= 90));
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('pos.stock.search')} className={`${inputClass} max-w-sm`} aria-label={t('pos.stock.search')} />
        {(['all', 'low', 'expiring'] as const).map((key) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-full text-sm border ${filter === key ? 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
            {t(`pos.stock.filter.${key}`)}
          </button>
        ))}
      </div>
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 text-left">{t('pos.stock.medication')}</th>
              <th className="px-4 py-2 text-right">{t('pos.stock.price')}</th>
              <th className="px-4 py-2 text-right">{t('pos.stock.sellable')}</th>
              <th className="px-4 py-2 text-right">{t('pos.stock.total')}</th>
              <th className="px-4 py-2 text-left">{t('pos.stock.nearestExpiry')}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {medications === null && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">{t('pos.loading')}</td></tr>}
            {medications && visible.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">{t('pos.noResult')}</td></tr>}
            {visible.map((med) => (
              <Fragment key={med.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2">
                    <span className="font-medium text-gray-900 dark:text-white">{med.name} {med.strength}</span> {med.requiresRx && <RxBadge />}
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{med.genericName} · {med.dosageForm} · {med.category}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-200">{formatCurrency(med.unitPrice)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${med.sellableQuantity <= med.reorderLevel ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                    {med.sellableQuantity}
                    {med.sellableQuantity <= med.reorderLevel && <span className="block text-xs font-normal">{t('pos.stock.low', { level: med.reorderLevel })}</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-300">{med.stockQuantity}</td>
                  <td className="px-4 py-2"><ExpiryBadge date={med.nearestExpiry} /></td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" className={smallBtn} onClick={() => setOpen((prev) => ({ ...prev, [med.id]: !prev[med.id] }))} aria-expanded={Boolean(open[med.id])}>
                      {t('pos.stock.batches', { count: med.batches.length })}
                    </button>
                  </td>
                </tr>
                {open[med.id] && (
                  <tr className="bg-gray-50/60 dark:bg-gray-900/20">
                    <td colSpan={6} className="px-4 py-2">
                      {med.batches.length === 0 ? (
                        <p className="text-xs text-gray-500">{t('pos.stock.noBatch')}</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead className="text-gray-500 dark:text-gray-400">
                            <tr>
                              <th className="py-1 text-left">{t('pos.batch.number')}</th>
                              <th className="py-1 text-left">{t('pos.batch.expiry')}</th>
                              <th className="py-1 text-right">{t('pos.batch.quantity')}</th>
                              <th className="py-1 text-right">{t('pos.batch.cost')}</th>
                              <th className="py-1" />
                            </tr>
                          </thead>
                          <tbody>
                            {med.batches.map((batch) => (
                              <tr key={batch.id} className={batch.isExpired ? 'text-red-700 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}>
                                <td className="py-1 font-medium">{batch.batchNumber}</td>
                                <td className="py-1"><ExpiryBadge date={batch.expiryDate} /></td>
                                <td className="py-1 text-right">{batch.quantity}</td>
                                <td className="py-1 text-right">{batch.costPrice !== null ? formatCurrency(batch.costPrice) : '—'}</td>
                                <td className="py-1 text-right">
                                  <button type="button" className={smallBtn} onClick={() => setAdjusting({ med, batch })}>{t('pos.adjust.cta')}</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {adjusting && (
        <AdjustDialog
          medicationName={`${adjusting.med.name} ${adjusting.med.strength}`}
          batch={adjusting.batch}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function AdjustDialog({
  medicationName,
  batch,
  defaultType = 'ADJUSTMENT',
  onClose,
  onDone,
}: {
  medicationName: string;
  batch: { id: string; batchNumber: string; quantity: number };
  defaultType?: StockAdjustmentType;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const [type, setType] = useState<StockAdjustmentType>(defaultType);
  const [quantity, setQuantity] = useState(defaultType === 'EXPIRED' ? String(batch.quantity) : '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const n = Math.trunc(Number(quantity));
    if (!quantity.trim() || !Number.isFinite(n) || n === 0) return setError(t('pos.adjust.qtyInvalid'));
    if (type !== 'ADJUSTMENT' && n < 0) return setError(t('pos.adjust.qtyPositive'));
    if (!reason.trim()) return setError(t('pos.reasonRequired'));
    setSaving(true);
    setError('');
    try {
      await api.adjustPharmacyStock({ batchId: batch.id, type, quantity: n, reason: reason.trim() });
      toast.success(t('pos.adjust.toast', { lot: batch.batchNumber }));
      onDone();
    } catch (err) {
      setError(messageOf(err, t('pos.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={t('pos.adjust.title', { lot: batch.batchNumber })}
      subtitle={t('pos.adjust.subtitle', { name: medicationName, count: batch.quantity })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('pos.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={saving}>{t('pos.save')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="adjust-type">{t('pos.adjust.type')}</label>
        <select id="adjust-type" value={type} onChange={(e) => setType(e.target.value as StockAdjustmentType)} className={inputClass}>
          {(['ADJUSTMENT', 'BREAKAGE', 'EXPIRED'] as const).map((k) => <option key={k} value={k}>{t(`pos.movement.${k}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="adjust-qty">{type === 'ADJUSTMENT' ? t('pos.adjust.qtySigned') : t('pos.adjust.qtyRemoved')}</label>
        <input id="adjust-qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} autoFocus />
        {type === 'ADJUSTMENT' && <p className="text-xs text-gray-500 mt-1">{t('pos.adjust.signedHint')}</p>}
      </div>
      <div>
        <label className={labelClass} htmlFor="adjust-reason">{t('pos.reason')}</label>
        <textarea id="adjust-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}

interface ReceiptRow {
  key: number;
  medicationId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  costPrice: string;
}

let rowSeq = 0;
const emptyRow = (): ReceiptRow => ({ key: ++rowSeq, medicationId: '', batchNumber: '', expiryDate: '', quantity: '', costPrice: '' });

function ReceiptTab({ medications, onReceived }: { medications: StockMedication[]; onReceived: () => void }) {
  const { t, formatCurrency } = useLanguage();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference] = useState('');
  const [rows, setRows] = useState<ReceiptRow[]>(() => [emptyRow()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getSuppliers({ isActive: true, limit: 100 })
      .then((res) => setSuppliers(res.suppliers.map((s) => ({ id: s.id, name: s.name }))))
      .catch(() => setSuppliers([]));
  }, []);

  const update = (key: number, patch: Partial<ReceiptRow>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.medicationId || r.batchNumber || r.quantity);
  const total = filled.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.costPrice) || 0), 0);
  const today = localDateString();

  const submit = async () => {
    if (filled.length === 0) return setError(t('pos.receipt.noRows'));
    for (const r of filled) {
      if (!r.medicationId || !r.batchNumber.trim() || !r.expiryDate || !(Number(r.quantity) > 0)) return setError(t('pos.receipt.rowIncomplete'));
      if (r.expiryDate <= today) return setError(t('pos.receipt.expiryPast'));
    }
    setSaving(true);
    setError('');
    try {
      await api.receivePharmacyStock({
        ...(supplierId ? { supplierId } : {}),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        items: filled.map((r) => ({
          medicationId: r.medicationId,
          batchNumber: r.batchNumber.trim(),
          expiryDate: r.expiryDate,
          quantity: Math.trunc(Number(r.quantity)),
          ...(r.costPrice.trim() ? { costPrice: Number(r.costPrice) } : {}),
        })),
      });
      toast.success(t('pos.receipt.toast', { count: filled.length }));
      setRows([emptyRow()]);
      setReference('');
      onReceived();
    } catch (err) {
      setError(messageOf(err, t('pos.actionFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${cardClass} p-4 space-y-4`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="receipt-supplier">{t('pos.receipt.supplier')}</label>
          <select id="receipt-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
            <option value="">{t('pos.receipt.noSupplier')}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="receipt-ref">{t('pos.receipt.reference')}</label>
          <input id="receipt-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('pos.receipt.referencePlaceholder')} className={inputClass} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="py-1 text-left">{t('pos.stock.medication')}</th>
              <th className="py-1 text-left">{t('pos.batch.number')}</th>
              <th className="py-1 text-left">{t('pos.batch.expiry')}</th>
              <th className="py-1 text-left">{t('pos.batch.quantity')}</th>
              <th className="py-1 text-left">{t('pos.batch.cost')}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="py-1 pr-2 min-w-[14rem]">
                  <select value={row.medicationId} onChange={(e) => update(row.key, { medicationId: e.target.value })} className={inputClass} aria-label={t('pos.stock.medication')}>
                    <option value="">{t('pos.receipt.pickMedication')}</option>
                    {medications.map((m) => <option key={m.id} value={m.id}>{m.name} {m.strength}</option>)}
                  </select>
                </td>
                <td className="py-1 pr-2"><input value={row.batchNumber} onChange={(e) => update(row.key, { batchNumber: e.target.value })} className={inputClass} aria-label={t('pos.batch.number')} /></td>
                <td className="py-1 pr-2"><input type="date" min={today} value={row.expiryDate} onChange={(e) => update(row.key, { expiryDate: e.target.value })} className={inputClass} aria-label={t('pos.batch.expiry')} /></td>
                <td className="py-1 pr-2 w-24"><input type="number" min={1} value={row.quantity} onChange={(e) => update(row.key, { quantity: e.target.value })} className={inputClass} aria-label={t('pos.batch.quantity')} /></td>
                <td className="py-1 pr-2 w-28"><input type="number" min={0} value={row.costPrice} onChange={(e) => update(row.key, { costPrice: e.target.value })} className={inputClass} aria-label={t('pos.batch.cost')} /></td>
                <td className="py-1 text-right">
                  {rows.length > 1 && <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))} aria-label={t('pos.cart.remove')}>✕</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={smallBtn} onClick={() => setRows((prev) => [...prev, emptyRow()])}>{t('pos.receipt.addRow')}</button>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('pos.receipt.value', { amount: formatCurrency(total) })}</p>
      </div>
      <ErrorBox message={error} />
      <div className="flex justify-end">
        <button type="button" className={primaryBtn} onClick={submit} disabled={saving}>{t('pos.receipt.save')}</button>
      </div>
    </div>
  );
}

function MovementsTab({ medications }: { medications: StockMedication[] }) {
  const { t, formatDateTime } = useLanguage();
  const [medicationId, setMedicationId] = useState('');
  const [type, setType] = useState<StockMovementType | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<StockMovementsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api
      .getStockMovements({ medicationId: medicationId || undefined, type: type || undefined, from: from || undefined, to: to || undefined, page })
      .then((res) => live && (setData(res), setError('')))
      .catch((err) => live && setError(messageOf(err, t('pos.loadFailed'))));
    return () => {
      live = false;
    };
  }, [medicationId, type, from, to, page, t]);

  return (
    <div className="space-y-3">
      <div className={`${cardClass} p-4 flex flex-wrap items-end gap-3`}>
        <div className="min-w-[14rem]">
          <label className={labelClass} htmlFor="mv-med">{t('pos.stock.medication')}</label>
          <select id="mv-med" value={medicationId} onChange={(e) => { setMedicationId(e.target.value); setPage(1); }} className={inputClass}>
            <option value="">{t('pos.all')}</option>
            {medications.map((m) => <option key={m.id} value={m.id}>{m.name} {m.strength}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="mv-type">{t('pos.movement.type')}</label>
          <select id="mv-type" value={type} onChange={(e) => { setType(e.target.value as StockMovementType | ''); setPage(1); }} className={inputClass}>
            <option value="">{t('pos.all')}</option>
            {MOVEMENT_TYPES.map((k) => <option key={k} value={k}>{t(`pos.movement.${k}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="mv-from">{t('pos.from')}</label>
          <input id="mv-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="mv-to">{t('pos.to')}</label>
          <input id="mv-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={inputClass} />
        </div>
      </div>
      <ErrorBox message={error} />
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 text-left">{t('pos.sales.date')}</th>
              <th className="px-4 py-2 text-left">{t('pos.movement.type')}</th>
              <th className="px-4 py-2 text-left">{t('pos.stock.medication')}</th>
              <th className="px-4 py-2 text-left">{t('pos.batch.number')}</th>
              <th className="px-4 py-2 text-right">{t('pos.movement.quantity')}</th>
              <th className="px-4 py-2 text-right">{t('pos.movement.balance')}</th>
              <th className="px-4 py-2 text-left">{t('pos.movement.detail')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {data === null && !error && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">{t('pos.loading')}</td></tr>}
            {data && data.movements.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">{t('pos.movement.empty')}</td></tr>}
            {data?.movements.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{t(`pos.movement.${m.type}`)}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{m.medicationName}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{m.batchNumber}</td>
                <td className={`px-4 py-2 text-right font-semibold ${m.quantity < 0 ? 'text-red-600' : 'text-green-700 dark:text-green-400'}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-200">{m.balanceAfter}</td>
                <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                  {m.reference?.number && <span className="font-medium text-gray-700 dark:text-gray-200">{m.reference.number} </span>}
                  {m.reason}
                  {m.userName && <span className="block">{m.userName}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm">
            <button type="button" className={smallBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('pos.prev')}</button>
            <span className="text-gray-600 dark:text-gray-300">{t('pos.pageOf', { page, total: data.pagination.totalPages })}</span>
            <button type="button" className={smallBtn} disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>{t('pos.next')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpiringTab({ onChanged }: { onChanged: () => void }) {
  const { t, formatCurrency } = useLanguage();
  const [days, setDays] = useState(90);
  const [batches, setBatches] = useState<ExpiringBatch[] | null>(null);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<ExpiringBatch | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .getExpiringBatches(days)
      .then((list) => live && (setBatches(list), setError('')))
      .catch((err) => live && setError(messageOf(err, t('pos.loadFailed'))));
    return () => {
      live = false;
    };
  }, [days, refresh, t]);

  const value = (batches ?? []).reduce((sum, b) => sum + (b.value || 0), 0);
  const expiredValue = (batches ?? []).filter((b) => b.isExpired).reduce((sum, b) => sum + (b.value || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {[30, 60, 90].map((d) => (
          <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded-full text-sm border ${days === d ? 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
            {t('pos.expiring.within', { days: d })}
          </button>
        ))}
        {batches && (
          <p className="ml-auto text-sm text-gray-600 dark:text-gray-300">
            {t('pos.expiring.value', { amount: formatCurrency(value) })}
            {expiredValue > 0 && <span className="ml-2 text-red-600 font-medium">{t('pos.expiring.expiredValue', { amount: formatCurrency(expiredValue) })}</span>}
          </p>
        )}
      </div>
      <ErrorBox message={error} />
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 text-left">{t('pos.stock.medication')}</th>
              <th className="px-4 py-2 text-left">{t('pos.batch.number')}</th>
              <th className="px-4 py-2 text-left">{t('pos.batch.expiry')}</th>
              <th className="px-4 py-2 text-right">{t('pos.batch.quantity')}</th>
              <th className="px-4 py-2 text-right">{t('pos.expiring.valueCol')}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {batches === null && !error && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">{t('pos.loading')}</td></tr>}
            {batches && batches.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">{t('pos.expiring.none')}</td></tr>}
            {batches?.map((b) => (
              <tr key={b.id} className={b.isExpired ? 'bg-red-50/60 dark:bg-red-900/10' : ''}>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{b.medication.name} {b.medication.strength}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{b.batchNumber}</td>
                <td className="px-4 py-2">
                  <ExpiryBadge date={b.expiryDate} />
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {b.isExpired ? t('pos.expiring.expiredSince', { days: Math.abs(b.daysToExpiry) }) : t('pos.expiring.inDays', { days: b.daysToExpiry })}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{b.quantity}</td>
                <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-200">{formatCurrency(b.value)}</td>
                <td className="px-4 py-2 text-right">
                  {b.quantity > 0 && (
                    <button type="button" className={smallBtn} onClick={() => setRemoving(b)}>
                      {b.isExpired ? t('pos.expiring.remove') : t('pos.adjust.cta')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {removing && (
        <AdjustDialog
          medicationName={`${removing.medication.name} ${removing.medication.strength}`}
          batch={removing}
          defaultType={removing.isExpired ? 'EXPIRED' : 'ADJUSTMENT'}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            setRefresh((n) => n + 1);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
