'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import {
  INVOICE_STATUSES,
  PO_STATUSES,
  addDaysIso,
  groupSuggestionsBySupplier,
  isoDay,
  invoiceBalance,
  personName,
  suggestionsToItems,
  type PayablesReport,
  type PurchaseOrderStatus,
  type PurchaseOrdersResponse,
  type ReorderSuggestion,
  type SupplierInvoice,
  type SupplierInvoiceStatus,
  type SupplierPerformance,
} from '@/lib/purchasing';
import { PaymentDialog } from './dialogs';
import {
  ErrorBox,
  InvoiceStatusBadge,
  PoStatusBadge,
  ProgressBar,
  ReasonDialog,
  cardClass,
  inputClass,
  messageOf,
  primaryBtn,
  smallBtn,
  useIsAdmin,
} from './ui';

const thClass = 'px-4 py-2 text-left';
const chip = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-sm border whitespace-nowrap ${active ? 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`;

function TableShell({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 dark:text-gray-400">{head}</thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{children}</tbody>
      </table>
    </div>
  );
}

function MessageRow({ cols, text }: { cols: number; text: string }) {
  return <tr><td colSpan={cols} className="px-4 py-6 text-center text-gray-500">{text}</td></tr>;
}

// ---- Orders ----

export function OrdersTab() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const router = useRouter();
  const [status, setStatus] = useState<PurchaseOrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PurchaseOrdersResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let live = true;
    api
      .getPurchaseOrders({ status, q: q || undefined, page, limit: 20 })
      .then((r) => { if (live) { setResult(r); setError(''); } })
      .catch((err) => live && setError(messageOf(err, t('pur.loadFailed'))));
    return () => { live = false; };
  }, [status, q, page, t]);

  const counts = result?.counts ?? {};
  const all = PO_STATUSES.reduce((s, k) => s + (counts[k] ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('pur.orders.search')} aria-label={t('pur.orders.search')} className={`${inputClass} max-w-xs`} />
        <button type="button" className={chip(status === '')} aria-pressed={status === ''} onClick={() => { setStatus(''); setPage(1); }}>
          {t('pur.orders.all')} <span className="opacity-70">({all})</span>
        </button>
        {PO_STATUSES.map((s) => (
          <button key={s} type="button" className={chip(status === s)} aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }}>
            {t(`pur.status.${s}`)} <span className="opacity-70">({counts[s] ?? 0})</span>
          </button>
        ))}
      </div>
      <ErrorBox message={error} />
      <TableShell
        head={
          <tr>
            <th className={thClass}>{t('pur.orderNumber')}</th>
            <th className={thClass}>{t('pur.supplier')}</th>
            <th className={thClass}>{t('pur.statusLabel')}</th>
            <th className="px-4 py-2 text-right">{t('pur.total')}</th>
            <th className={thClass}>{t('pur.expectedAt')}</th>
            <th className={thClass}>{t('pur.orders.receipt')}</th>
            <th className={thClass}>{t('pur.orders.createdBy')}</th>
          </tr>
        }
      >
        {result === null && <MessageRow cols={7} text={t('pur.loading')} />}
        {result && result.data.length === 0 && <MessageRow cols={7} text={t('pur.orders.empty')} />}
        {result?.data.map((po) => (
          <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer" onClick={() => router.push(`/dashboard/purchasing/${po.id}`)}>
            <td className="px-4 py-2">
              <Link href={`/dashboard/purchasing/${po.id}`} className="font-medium text-lime-700 dark:text-lime-400 hover:underline" onClick={(e) => e.stopPropagation()}>{po.orderNumber}</Link>
              <span className="block text-xs text-gray-500">{formatDate(po.createdAt)} · {t('pur.orders.lines', { count: po.itemCount })}</span>
            </td>
            <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{po.supplier.name}</td>
            <td className="px-4 py-2"><PoStatusBadge status={po.status} /></td>
            <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{formatCurrency(po.totalAmount)}</td>
            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{po.expectedAt ? formatDate(po.expectedAt.slice(0, 10)) : '—'}</td>
            <td className="px-4 py-2">{['ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(po.status) ? <ProgressBar percent={po.receivedPercent} /> : <span className="text-xs text-gray-400">—</span>}</td>
            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{personName(po.createdBy) || '—'}</td>
          </tr>
        ))}
      </TableShell>
      {result && result.pagination.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" className={smallBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('pur.prev')}</button>
          <span className="text-gray-600 dark:text-gray-400">{t('pur.pageOf', { page, total: result.pagination.totalPages })}</span>
          <button type="button" className={smallBtn} disabled={page >= result.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>{t('pur.next')}</button>
        </div>
      )}
    </div>
  );
}

// ---- Reorder suggestions ----

export function SuggestionsTab({ onOrdersCreated }: { onOrdersCreated: () => void }) {
  const { t, formatCurrency } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<ReorderSuggestion[] | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Supplier picked here for products without a usual supplier
  const [supplierFor, setSupplierFor] = useState<Record<string, string>>({});
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; leadTimeDays?: number }>>([]);
  const keyOf = (s: ReorderSuggestion) => `${s.kind}:${s.medicationId ?? s.inventoryItemId}`;

  useEffect(() => {
    api.getSuppliers({ isActive: true, limit: 100 }).then((r) => setSuppliers(r.suppliers)).catch(() => setSuppliers([]));
  }, []);

  const load = useCallback(() => {
    api
      .getReorderSuggestions()
      .then((list) => {
        setItems(list);
        setQty(Object.fromEntries(list.map((s) => [keyOf(s), String(s.suggestedQty)])));
        setSelected(Object.fromEntries(list.filter((s) => s.suggestedQty > 0).map((s) => [keyOf(s), true])));
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('pur.loadFailed'))));
  }, [t]);
  useEffect(() => load(), [load]);

  const chosen = useMemo(
    () =>
      (items ?? [])
        .filter((s) => selected[keyOf(s)])
        .map((s) => {
          const picked = !s.supplierId ? suppliers.find((x) => x.id === supplierFor[keyOf(s)]) : undefined;
          return {
            ...s,
            ...(picked ? { supplierId: picked.id, supplierName: picked.name } : {}),
            quantity: Math.max(0, Math.floor(Number(qty[keyOf(s)]) || 0)),
          };
        }),
    [items, selected, qty, supplierFor, suppliers]
  );
  const { groups, withoutSupplier } = groupSuggestionsBySupplier(chosen);

  const createOrders = async () => {
    if (!groups.length) return;
    setBusy(true);
    setError('');
    const created: Array<{ id: string; orderNumber: string }> = [];
    try {
      for (const group of groups) {
        const leadTime = suppliers.find((x) => x.id === group.supplierId)?.leadTimeDays ?? 7;
        const po = await api.createPurchaseOrder({ supplierId: group.supplierId, expectedAt: addDaysIso(isoDay(), leadTime), items: suggestionsToItems(group.lines) });
        created.push({ id: po.id, orderNumber: po.orderNumber });
      }
      toast.success(t('pur.sug.created', { count: created.length }), created.map((c) => c.orderNumber).join(', '));
      onOrdersCreated();
      if (created.length === 1) router.push(`/dashboard/purchasing/${created[0].id}`);
      else load();
    } catch (err) {
      setError(messageOf(err, t('pur.actionFailed')) + (created.length ? ` — ${t('pur.sug.partial', { numbers: created.map((c) => c.orderNumber).join(', ') })}` : ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl">{t('pur.sug.help')}</p>
        <button type="button" className={primaryBtn} disabled={busy || groups.length === 0} onClick={createOrders}>
          {busy ? t('pur.saving') : t('pur.sug.create', { count: groups.length })}
        </button>
      </div>
      {withoutSupplier.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm">
          {t('pur.sug.noSupplier', { names: withoutSupplier.map((s) => s.name).join(', ') })}
        </div>
      )}
      <ErrorBox message={error} />
      <TableShell
        head={
          <tr>
            <th className="px-4 py-2 w-8"><span className="sr-only">{t('pur.sug.select')}</span></th>
            <th className={thClass}>{t('pur.product')}</th>
            <th className="px-4 py-2 text-right">{t('pur.sug.stock')}</th>
            <th className="px-4 py-2 text-right">{t('pur.sug.onOrder')}</th>
            <th className="px-4 py-2 text-right">{t('pur.sug.avgUse')}</th>
            <th className="px-4 py-2 text-right">{t('pur.sug.daysLeft')}</th>
            <th className={thClass}>{t('pur.supplier')}</th>
            <th className="px-4 py-2 text-right">{t('pur.sug.lastCost')}</th>
            <th className="px-4 py-2 text-right w-28">{t('pur.sug.qty')}</th>
          </tr>
        }
      >
        {items === null && <MessageRow cols={9} text={t('pur.loading')} />}
        {items && items.length === 0 && <MessageRow cols={9} text={t('pur.sug.empty')} />}
        {items?.map((s) => {
          const key = keyOf(s);
          const urgent = s.daysLeft !== null && s.daysLeft <= 7;
          return (
            <tr key={key} className={selected[key] ? 'bg-lime-50/40 dark:bg-lime-900/10' : ''}>
              <td className="px-4 py-2">
                <input type="checkbox" checked={Boolean(selected[key])} onChange={(e) => setSelected((prev) => ({ ...prev, [key]: e.target.checked }))} aria-label={t('pur.sug.selectItem', { name: s.name })} className="w-4 h-4 text-lime-600 rounded" />
              </td>
              <td className="px-4 py-2">
                <span className="font-medium text-gray-900 dark:text-white">{s.name}</span>
                <span className="block text-xs text-gray-500">{t(`pur.kind.${s.kind}`)}{s.unit ? ` · ${s.unit}` : ''} · {t('pur.sug.reorderLevel', { level: s.reorderLevel })}</span>
              </td>
              <td className={`px-4 py-2 text-right tabular-nums ${s.stock <= s.reorderLevel ? 'text-red-600 font-semibold' : ''}`}>{s.stock}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.onOrder}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.avgDailyUse.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</td>
              <td className="px-4 py-2 text-right">
                {s.daysLeft === null ? <span className="text-xs text-gray-400">{t('pur.sug.noUse')}</span> : <span className={`tabular-nums ${urgent ? 'text-red-600 font-semibold' : ''}`}>{t('pur.sug.days', { count: s.daysLeft })}</span>}
              </td>
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                {s.supplierName || (
                  <select
                    value={supplierFor[key] ?? ''}
                    onChange={(e) => setSupplierFor((prev) => ({ ...prev, [key]: e.target.value }))}
                    aria-label={t('pur.sug.pickSupplier', { name: s.name })}
                    className={`w-full max-w-[12rem] px-2 py-1.5 border rounded-md bg-white dark:bg-gray-700 text-sm ${supplierFor[key] ? 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white' : 'border-amber-400 text-amber-700 dark:text-amber-400'}`}
                  >
                    <option value="">{t('pur.sug.noSupplierShort')}</option>
                    {suppliers.map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </select>
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{s.lastUnitCost != null ? formatCurrency(s.lastUnitCost) : '—'}</td>
              <td className="px-4 py-2">
                <input type="number" min={0} step={1} value={qty[key] ?? ''} onChange={(e) => setQty((prev) => ({ ...prev, [key]: e.target.value }))} aria-label={t('pur.sug.qty')} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-right" />
              </td>
            </tr>
          );
        })}
      </TableShell>
      {chosen.some((c) => c.lastUnitCost == null) && <p className="text-xs text-gray-500">{t('pur.sug.priceHint')}</p>}
    </div>
  );
}

// ---- Supplier invoices ----

export function InvoicesTab() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<SupplierInvoiceStatus | ''>('');
  const [overdue, setOverdue] = useState(false);
  const [items, setItems] = useState<SupplierInvoice[] | null>(null);
  const [error, setError] = useState('');
  const [disputing, setDisputing] = useState<SupplierInvoice | null>(null);
  const [paying, setPaying] = useState<SupplierInvoice | null>(null);

  const load = useCallback(() => {
    api
      .getSupplierInvoices({ status, overdue })
      .then((list) => { setItems(list); setError(''); })
      .catch((err) => setError(messageOf(err, t('pur.loadFailed'))));
  }, [status, overdue, t]);
  useEffect(() => load(), [load]);

  const act = async (inv: SupplierInvoice, action: 'approve' | 'resolve') => {
    try {
      await api.supplierInvoiceAction(inv.id, action);
      toast.success(t(`pur.inv.done.${action}`, { number: inv.invoiceNumber }));
      load();
    } catch (err) {
      toast.error(t('pur.actionFailed'), messageOf(err, ''));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip(status === '')} aria-pressed={status === ''} onClick={() => setStatus('')}>{t('pur.orders.all')}</button>
        {INVOICE_STATUSES.map((s) => (
          <button key={s} type="button" className={chip(status === s)} aria-pressed={status === s} onClick={() => setStatus(s)}>{t(`pur.inv.status.${s}`)}</button>
        ))}
        <label className="ml-2 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} className="w-4 h-4 text-lime-600 rounded" />
          {t('pur.inv.overdueOnly')}
        </label>
      </div>
      <ErrorBox message={error} />
      <TableShell
        head={
          <tr>
            <th className={thClass}>{t('pur.inv.number')}</th>
            <th className={thClass}>{t('pur.supplier')}</th>
            <th className={thClass}>{t('pur.orderNumber')}</th>
            <th className="px-4 py-2 text-right">{t('pur.inv.amount')}</th>
            <th className="px-4 py-2 text-right">{t('pur.inv.balance')}</th>
            <th className={thClass}>{t('pur.inv.dueDate')}</th>
            <th className={thClass}>{t('pur.statusLabel')}</th>
            <th className="px-4 py-2" />
          </tr>
        }
      >
        {items === null && <MessageRow cols={8} text={t('pur.loading')} />}
        {items && items.length === 0 && <MessageRow cols={8} text={t('pur.inv.empty')} />}
        {items?.map((inv) => {
          const orderId = inv.purchaseOrder?.id ?? inv.purchaseOrderId;
          const orderNumber = inv.purchaseOrder?.orderNumber ?? inv.orderNumber;
          return (
            <tr key={inv.id} className="align-top">
              <td className="px-4 py-2">
                <span className="font-medium text-gray-900 dark:text-white">{inv.invoiceNumber}</span>
                <span className="block text-xs text-gray-500">{formatDate(inv.invoiceDate.slice(0, 10))}</span>
                {inv.status === 'DISPUTED' && inv.matchNotes && <span className="block text-xs text-red-600 dark:text-red-400 max-w-xs whitespace-pre-line">{inv.matchNotes}</span>}
              </td>
              <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{inv.supplier?.name ?? '—'}</td>
              <td className="px-4 py-2">{orderId ? <Link href={`/dashboard/purchasing/${orderId}`} className="text-lime-700 dark:text-lime-400 hover:underline">{orderNumber ?? t('pur.inv.viewOrder')}</Link> : '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(inv.amount)}</td>
              <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCurrency(invoiceBalance(inv))}</td>
              <td className="px-4 py-2">
                {formatDate(inv.dueDate.slice(0, 10))}
                {(inv.daysOverdue ?? 0) > 0 && inv.status !== 'PAID' && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{t('pur.inv.overdueDays', { count: inv.daysOverdue ?? 0 })}</span>
                )}
              </td>
              <td className="px-4 py-2"><InvoiceStatusBadge status={inv.status} /></td>
              <td className="px-4 py-2">
                <InvoiceActions invoice={inv} isAdmin={isAdmin} onApprove={() => act(inv, 'approve')} onResolve={() => act(inv, 'resolve')} onDispute={() => setDisputing(inv)} onPay={() => setPaying(inv)} />
              </td>
            </tr>
          );
        })}
      </TableShell>
      {disputing && (
        <ReasonDialog
          title={t('pur.inv.disputeTitle', { number: disputing.invoiceNumber })}
          confirmLabel={t('pur.inv.dispute')}
          danger
          onClose={() => setDisputing(null)}
          onConfirm={async (reason) => {
            await api.supplierInvoiceAction(disputing.id, 'dispute', reason);
            toast.success(t('pur.inv.done.dispute', { number: disputing.invoiceNumber }));
            setDisputing(null);
            load();
          }}
        />
      )}
      {paying && <PaymentDialog invoice={paying} onClose={() => setPaying(null)} onDone={() => { toast.success(t('pur.pay.done')); setPaying(null); load(); }} />}
    </div>
  );
}

export function InvoiceActions({
  invoice,
  isAdmin,
  onApprove,
  onResolve,
  onDispute,
  onPay,
}: {
  invoice: SupplierInvoice;
  isAdmin: boolean;
  onApprove: () => void;
  onResolve: () => void;
  onDispute: () => void;
  onPay: () => void;
}) {
  const { t } = useLanguage();
  const s = invoice.status;
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {isAdmin && (s === 'RECEIVED' || s === 'DISPUTED') && <button type="button" className={smallBtn} onClick={onApprove}>{t('pur.inv.approve')}</button>}
      {(s === 'RECEIVED' || s === 'APPROVED') && <button type="button" className={smallBtn} onClick={onDispute}>{t('pur.inv.dispute')}</button>}
      {s === 'DISPUTED' && <button type="button" className={smallBtn} onClick={onResolve}>{t('pur.inv.resolve')}</button>}
      {isAdmin && (s === 'APPROVED' || s === 'PARTIALLY_PAID') && <button type="button" className={smallBtn} onClick={onPay}>{t('pur.inv.pay')}</button>}
    </div>
  );
}

// ---- Payables ----

export function PayablesTab() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const [report, setReport] = useState<PayablesReport | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.getPayables().then(setReport).catch((err) => setError(messageOf(err, t('pur.loadFailed'))));
  }, [t]);

  const buckets: Array<[keyof PayablesReport['ageing'], string]> = [
    ['current', 'text-gray-900 dark:text-white'],
    ['d1_30', 'text-amber-700 dark:text-amber-400'],
    ['d31_60', 'text-orange-700 dark:text-orange-400'],
    ['d61_90', 'text-red-600 dark:text-red-400'],
    ['d90plus', 'text-red-800 dark:text-red-300'],
  ];

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      {!report && !error && <p className="text-sm text-gray-500">{t('pur.loading')}</p>}
      {report && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`${cardClass} p-4`}>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('pur.pay.outstanding')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(report.totals.outstanding)}</p>
            </div>
            <div className={`${cardClass} p-4`}>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('pur.pay.overdue')}</p>
              <p className="text-2xl font-bold text-red-600 tabular-nums">{formatCurrency(report.totals.overdue)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {buckets.map(([key, color]) => (
              <div key={key} className={`${cardClass} p-3`}>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t(`pur.ageing.${key}`)}</p>
                <p className={`text-lg font-semibold tabular-nums ${color}`}>{formatCurrency(report.ageing[key])}</p>
              </div>
            ))}
          </div>
          <TableShell
            head={
              <tr>
                <th className={thClass}>{t('pur.supplier')}</th>
                <th className="px-4 py-2 text-right">{t('pur.pay.outstanding')}</th>
                <th className="px-4 py-2 text-right">{t('pur.pay.overdue')}</th>
                <th className={thClass}>{t('pur.pay.oldestDue')}</th>
              </tr>
            }
          >
            {report.bySupplier.length === 0 && <MessageRow cols={4} text={t('pur.pay.nothingDue')} />}
            {report.bySupplier.map((s) => (
              <tr key={s.supplierId}>
                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{s.name}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(s.outstanding)}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${s.overdue > 0 ? 'text-red-600 font-semibold' : ''}`}>{formatCurrency(s.overdue)}</td>
                <td className="px-4 py-2">{s.oldestDueDate ? formatDate(s.oldestDueDate.slice(0, 10)) : '—'}</td>
              </tr>
            ))}
          </TableShell>
        </>
      )}
    </div>
  );
}

// ---- Supplier performance ----

export function PerformanceTab() {
  const { t, formatCurrency } = useLanguage();
  const [months, setMonths] = useState(6);
  const [rows, setRows] = useState<SupplierPerformance[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api
      .getSupplierPerformance(months)
      .then((r) => { if (live) { setRows(r); setError(''); } })
      .catch((err) => live && setError(messageOf(err, t('pur.loadFailed'))));
    return () => { live = false; };
  }, [months, t]);

  const pct = (v: number | null) => (v === null || v === undefined ? '—' : `${Math.round(v)} %`);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label htmlFor="perf-months" className="text-sm text-gray-700 dark:text-gray-300">{t('pur.perf.period')}</label>
        <select id="perf-months" value={months} onChange={(e) => { setRows(null); setMonths(Number(e.target.value)); }} className={`${inputClass} w-auto`}>
          {[3, 6, 12].map((m) => <option key={m} value={m}>{t('pur.perf.months', { count: m })}</option>)}
        </select>
      </div>
      <ErrorBox message={error} />
      <TableShell
        head={
          <tr>
            <th className={thClass}>{t('pur.supplier')}</th>
            <th className="px-4 py-2 text-right">{t('pur.perf.orders')}</th>
            <th className="px-4 py-2 text-right">{t('pur.perf.ordered')}</th>
            <th className="px-4 py-2 text-right">{t('pur.perf.received')}</th>
            <th className="px-4 py-2 text-right">{t('pur.perf.onTime')}</th>
            <th className="px-4 py-2 text-right">{t('pur.perf.leadDays')}</th>
            <th className="px-4 py-2 text-right">{t('pur.perf.fillRate')}</th>
            <th className="px-4 py-2 text-right">{t('pur.perf.rejection')}</th>
            <th className={thClass}>{t('pur.perf.priceChanges')}</th>
          </tr>
        }
      >
        {rows === null && !error && <MessageRow cols={9} text={t('pur.loading')} />}
        {rows && rows.length === 0 && <MessageRow cols={9} text={t('pur.perf.empty')} />}
        {rows?.map((r) => (
          <tr key={r.supplierId} className="align-top">
            <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{r.name}</td>
            <td className="px-4 py-2 text-right tabular-nums">{r.ordersCount}</td>
            <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.orderedValue)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.receivedValue)}</td>
            <td className={`px-4 py-2 text-right tabular-nums ${r.onTimeRate !== null && r.onTimeRate < 80 ? 'text-red-600' : ''}`}>{pct(r.onTimeRate)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{r.avgLeadDays === null ? '—' : t('pur.sug.days', { count: Math.round(r.avgLeadDays * 10) / 10 })}</td>
            <td className={`px-4 py-2 text-right tabular-nums ${r.fillRate !== null && r.fillRate < 90 ? 'text-amber-700' : ''}`}>{pct(r.fillRate)}</td>
            <td className={`px-4 py-2 text-right tabular-nums ${r.rejectionRate !== null && r.rejectionRate > 2 ? 'text-red-600' : ''}`}>{pct(r.rejectionRate)}</td>
            <td className="px-4 py-2 text-xs">
              {r.priceChanges.length === 0 ? <span className="text-gray-400">—</span> : (
                <ul className="space-y-0.5">
                  {r.priceChanges.map((p) => (
                    <li key={p.name}>
                      {p.name} : {formatCurrency(p.previous)} → {formatCurrency(p.latest)}{' '}
                      <span className={p.changePct > 0 ? 'text-red-600' : 'text-green-600'}>({p.changePct > 0 ? '+' : ''}{Math.round(p.changePct)} %)</span>
                    </li>
                  ))}
                </ul>
              )}
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}
