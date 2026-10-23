'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, type PharmacySale, type PharmacySalesResponse, type SalePaymentMethod } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import {
  DialogShell,
  ErrorBox,
  SaleStatusBadge,
  cancelBtn,
  cardClass,
  dangerBtn,
  inputClass,
  labelClass,
  messageOf,
  primaryBtn,
  smallBtn,
  useMethodLabel,
  usePharmacyPdf,
} from '@/components/pharmacy';
import { PAYMENT_METHODS, localDateString, refundAmount, returnableQty } from '@/lib/pharmacy-pos';

// useSearchParams needs a Suspense boundary for static rendering
export default function PharmacySalesPage() {
  return (
    <Suspense fallback={null}>
      <PharmacySales />
    </Suspense>
  );
}

function PharmacySales() {
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const methodLabel = useMethodLabel();
  const today = localDateString();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PharmacySalesResponse | null>(null);
  const [error, setError] = useState('');
  const selectedId = searchParams.get('sale');

  const load = useCallback(() => {
    api
      .getPharmacySales({ from, to, search: search.trim() || undefined, page })
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('pos.loadFailed'))));
  }, [from, to, search, page, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const select = (id: string | null) => router.replace(id ? `/dashboard/pharmacy/sales?sale=${id}` : '/dashboard/pharmacy/sales');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pos.sales.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('pos.sales.subtitle')}</p>
        </div>
        <Link href="/dashboard/pharmacy/pos" className={primaryBtn}>{t('nav.pharmacyPos')}</Link>
      </div>

      <div className={`${cardClass} p-4 flex flex-wrap items-end gap-3`}>
        <div>
          <label className={labelClass} htmlFor="sales-from">{t('pos.from')}</label>
          <input id="sales-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="sales-to">{t('pos.to')}</label>
          <input id="sales-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={inputClass} />
        </div>
        <div className="flex-1 min-w-[14rem]">
          <label className={labelClass} htmlFor="sales-search">{t('pos.search.short')}</label>
          <input id="sales-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('pos.sales.searchPlaceholder')} className={inputClass} />
        </div>
        {data && (
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('pos.sales.count', { count: data.totals.count })}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(data.totals.total)}</p>
          </div>
        )}
      </div>

      <ErrorBox message={error} />

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 text-left">{t('pos.sales.number')}</th>
              <th className="px-4 py-2 text-left">{t('pos.sales.date')}</th>
              <th className="px-4 py-2 text-left">{t('pos.sales.customer')}</th>
              <th className="px-4 py-2 text-left">{t('pos.pay.method')}</th>
              <th className="px-4 py-2 text-right">{t('pos.total')}</th>
              <th className="px-4 py-2 text-left">{t('pos.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {data === null && !error && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">{t('pos.loading')}</td></tr>
            )}
            {data && data.sales.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">{t('pos.sales.empty')}</td></tr>
            )}
            {data?.sales.map((sale) => (
              <tr key={sale.id} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 ${selectedId === sale.id ? 'bg-lime-50/60 dark:bg-lime-900/10' : ''}`} onClick={() => select(sale.id)}>
                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{sale.number}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{formatDateTime(sale.createdAt)}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-200">{sale.patient?.name ?? sale.customerName ?? sale.customerLabel ?? t('pos.customer.anonymous')}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{methodLabel(sale.paymentMethod)}</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(sale.total)}
                  {sale.refundedAmount ? <span className="block text-xs font-normal text-red-600">− {formatCurrency(sale.refundedAmount)}</span> : null}
                </td>
                <td className="px-4 py-2"><SaleStatusBadge status={sale.status} /></td>
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

      {selectedId && <SaleDrawer id={selectedId} onClose={() => select(null)} onChanged={load} />}
    </div>
  );
}

function SaleDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { t, formatCurrency, formatDate, formatDateTime } = useLanguage();
  const toast = useToast();
  const openPdf = usePharmacyPdf();
  const methodLabel = useMethodLabel();
  const [sale, setSale] = useState<PharmacySale | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'void' | 'return' | null>(null);

  const load = useCallback(() => {
    api
      .getPharmacySale(id)
      .then((s) => {
        setSale(s);
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('pos.loadFailed'))));
  }, [id, t]);
  useEffect(() => load(), [load]);

  const returnable = sale ? sale.items.some((i) => returnableQty(i) > 0) && sale.status !== 'VOIDED' : false;
  const canVoid = sale ? sale.status === 'COMPLETED' && sale.returns.length === 0 && new Date(sale.createdAt).toDateString() === new Date().toDateString() : false;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="w-full max-w-xl h-full overflow-y-auto bg-white dark:bg-gray-800 shadow-xl" onClick={(e) => e.stopPropagation()} aria-label={t('pos.sales.detail')}>
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{sale ? t('pos.sales.saleTitle', { number: sale.number }) : t('pos.loading')}</h2>
            {sale && <p className="text-sm text-gray-500 dark:text-gray-400">{formatDateTime(sale.createdAt)} · {sale.soldByName ?? '—'} · {t('pos.sales.till', { number: sale.session.number })}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label={t('pos.close')}>✕</button>
        </div>
        <div className="p-5 space-y-4">
          <ErrorBox message={error} />
          {sale && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <SaleStatusBadge status={sale.status} />
                <button type="button" className={smallBtn} onClick={() => openPdf('receipt', sale.id)}>{t('pos.done.print')}</button>
                {returnable && <button type="button" className={smallBtn} onClick={() => setDialog('return')}>{t('pos.return.cta')}</button>}
                {canVoid && <button type="button" className={`${smallBtn} text-red-600 border-red-200`} onClick={() => setDialog('void')}>{t('pos.void.cta')}</button>}
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-gray-500 dark:text-gray-400">{t('pos.sales.customer')}</dt>
                <dd className="text-gray-900 dark:text-white">
                  {sale.patient ? `${sale.patient.name} (${sale.patient.patientId})` : sale.customerName ?? t('pos.customer.anonymous')}
                  {sale.customerPhone && <span className="block text-xs text-gray-500">{sale.customerPhone}</span>}
                </dd>
                {sale.prescription && (
                  <>
                    <dt className="text-gray-500 dark:text-gray-400">{t('pos.rx.hospital')}</dt>
                    <dd className="text-gray-900 dark:text-white">{t('pos.rx.byDoctor', { name: sale.prescription.doctorName })} · {formatDate(sale.prescription.createdAt)}</dd>
                  </>
                )}
                {sale.external && (
                  <>
                    <dt className="text-gray-500 dark:text-gray-400">{t('pos.rx.external')}</dt>
                    <dd className="text-gray-900 dark:text-white">{sale.external.prescriber} · {formatDate(sale.external.date)}{sale.external.ref ? ` · ${sale.external.ref}` : ''}</dd>
                  </>
                )}
              </dl>

              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-1 text-left">{t('pos.sales.item')}</th>
                    <th className="py-1 text-right">{t('pos.cart.quantity')}</th>
                    <th className="py-1 text-right">{t('pos.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sale.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-1.5 text-gray-900 dark:text-white">
                        {item.description}
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{t('pos.batch.lotExpiry', { lot: item.batchNumber, date: formatDate(item.expiryDate) })}</span>
                      </td>
                      <td className="py-1.5 text-right text-gray-700 dark:text-gray-200">
                        {item.quantity}
                        {item.returnedQty > 0 && <span className="block text-xs text-red-600">{t('pos.return.returnedQty', { count: item.returnedQty })}</span>}
                      </td>
                      <td className="py-1.5 text-right text-gray-900 dark:text-white">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <dl className="space-y-1 text-sm border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="flex justify-between"><dt className="text-gray-500">{t('pos.subtotal')}</dt><dd>{formatCurrency(sale.subtotal)}</dd></div>
                {sale.discount > 0 && <div className="flex justify-between"><dt className="text-gray-500">{t('pos.discount.label')}</dt><dd>− {formatCurrency(sale.discount)}</dd></div>}
                <div className="flex justify-between font-semibold text-gray-900 dark:text-white"><dt>{t('pos.total')}</dt><dd>{formatCurrency(sale.total)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">{methodLabel(sale.paymentMethod)}</dt><dd>{sale.paymentReference ?? (sale.amountTendered !== null ? formatCurrency(sale.amountTendered) : '')}</dd></div>
                {sale.changeGiven !== null && sale.paymentMethod === 'CASH' && <div className="flex justify-between"><dt className="text-gray-500">{t('pos.pay.change')}</dt><dd>{formatCurrency(sale.changeGiven)}</dd></div>}
                {sale.refundedAmount > 0 && <div className="flex justify-between text-red-600"><dt>{t('pos.return.refunded')}</dt><dd>− {formatCurrency(sale.refundedAmount)}</dd></div>}
              </dl>

              {sale.returns.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{t('pos.return.history')}</h3>
                  <ul className="space-y-1 text-sm">
                    {sale.returns.map((r) => (
                      <li key={r.id} className="flex justify-between gap-3 text-gray-700 dark:text-gray-200">
                        <span>
                          {r.number} · {formatDateTime(r.createdAt)} · {r.reason}
                          {!r.restock && <span className="ml-1 text-xs text-orange-600">({t('pos.return.notRestocked')})</span>}
                        </span>
                        <span className="whitespace-nowrap">− {formatCurrency(r.refundAmount)} · {methodLabel(r.refundMethod)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sale.voided && (
                <p className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-sm text-red-700 dark:text-red-300">
                  {t('pos.void.done', { date: formatDateTime(sale.voided.at), name: sale.voided.byName ?? '—', reason: sale.voided.reason })}
                </p>
              )}
            </>
          )}
        </div>
      </aside>

      {dialog === 'void' && sale && (
        <VoidDialog
          sale={sale}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            toast.success(t('pos.void.toast', { number: sale.number }));
            load();
            onChanged();
          }}
        />
      )}
      {dialog === 'return' && sale && (
        <ReturnDialog
          sale={sale}
          onClose={() => setDialog(null)}
          onDone={(amount) => {
            setDialog(null);
            toast.success(t('pos.return.toast', { amount: formatCurrency(amount) }));
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function VoidDialog({ sale, onClose, onDone }: { sale: PharmacySale; onClose: () => void; onDone: () => void }) {
  const { t, formatCurrency } = useLanguage();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!reason.trim()) return setError(t('pos.reasonRequired'));
    setSaving(true);
    try {
      await api.voidPharmacySale(sale.id, reason.trim());
      onDone();
    } catch (err) {
      setError(messageOf(err, t('pos.actionFailed')));
      setSaving(false);
    }
  };
  return (
    <DialogShell
      title={t('pos.void.title', { number: sale.number })}
      subtitle={t('pos.void.hint', { amount: formatCurrency(sale.total) })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('pos.cancel')}</button>
          <button type="button" className={dangerBtn} onClick={submit} disabled={saving}>{t('pos.void.confirm')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="void-reason">{t('pos.reason')}</label>
        <textarea id="void-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} autoFocus />
      </div>
    </DialogShell>
  );
}

function ReturnDialog({ sale, onClose, onDone }: { sale: PharmacySale; onClose: () => void; onDone: (amount: number) => void }) {
  const { t, formatCurrency } = useLanguage();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<SalePaymentMethod>(sale.paymentMethod);
  const [restock, setRestock] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const chosen = sale.items.filter((i) => (quantities[i.id] ?? 0) > 0);
  const refund = refundAmount(chosen.map((i) => ({ quantity: quantities[i.id], unitPrice: i.unitPrice })), sale);

  const submit = async () => {
    if (chosen.length === 0) return setError(t('pos.return.pickLines'));
    if (!reason.trim()) return setError(t('pos.reasonRequired'));
    setSaving(true);
    setError('');
    try {
      const result = await api.returnPharmacySale(sale.id, {
        items: chosen.map((i) => ({ saleItemId: i.id, quantity: quantities[i.id] })),
        reason: reason.trim(),
        refundMethod: method,
        restock,
      });
      onDone(typeof result?.refundAmount === 'number' ? result.refundAmount : refund);
    } catch (err) {
      setError(messageOf(err, t('pos.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      wide
      title={t('pos.return.title', { number: sale.number })}
      subtitle={t('pos.return.hint')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('pos.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={submit} disabled={saving}>{t('pos.return.confirm', { amount: formatCurrency(refund) })}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {sale.items.map((item) => {
          const max = returnableQty(item);
          return (
            <li key={item.id} className="py-2 flex items-center justify-between gap-3">
              <span className="text-sm text-gray-900 dark:text-white">
                {item.description}
                <span className="block text-xs text-gray-500 dark:text-gray-400">{t('pos.return.canReturn', { count: max, price: formatCurrency(item.unitPrice) })}</span>
              </span>
              <input
                type="number"
                min={0}
                max={max}
                disabled={max === 0}
                value={quantities[item.id] ?? 0}
                onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: Math.min(max, Math.max(0, Math.floor(Number(e.target.value)) || 0)) }))}
                className="w-20 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-40"
                aria-label={t('pos.return.qtyFor', { name: item.description })}
              />
            </li>
          );
        })}
      </ul>
      <div>
        <label className={labelClass} htmlFor="return-reason">{t('pos.reason')}</label>
        <textarea id="return-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder={t('pos.return.reasonPlaceholder')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="return-method">{t('pos.return.method')}</label>
          <select id="return-method" value={method} onChange={(e) => setMethod(e.target.value as SalePaymentMethod)} className={inputClass}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`pos.method.${m}`)}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mt-6">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          {t('pos.return.restock')}
        </label>
      </div>
      {!restock && <p className="text-xs text-orange-600">{t('pos.return.noRestockHint')}</p>}
    </DialogShell>
  );
}
