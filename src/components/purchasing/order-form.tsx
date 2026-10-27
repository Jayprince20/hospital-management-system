'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type InventoryItem, type StockMedication, type Supplier } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import {
  DEFAULT_APPROVAL_THRESHOLD,
  addDaysIso,
  isoDay,
  lineTotal,
  needsApproval,
  orderTotal,
  type PurchaseOrderDetail,
  type PurchaseOrderInput,
} from '@/lib/purchasing';
import { ErrorBox, cancelBtn, cardClass, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from './ui';

interface Product {
  key: string;
  kind: 'MEDICATION' | 'INVENTORY';
  id: string;
  name: string;
  detail: string;
  lastCost: number | null;
}

interface Line {
  product: Product;
  quantity: string;
  unitPrice: string;
}

/** Last known purchase cost of a medication: the newest batch with a cost price */
function lastCostOf(med: StockMedication): number | null {
  const withCost = med.batches.filter((b) => b.costPrice != null);
  if (!withCost.length) return null;
  return withCost.sort((a, b) => b.expiryDate.localeCompare(a.expiryDate))[0].costPrice;
}

/** Lines of the draft being edited, matched to the catalogue */
function draftLines(order: PurchaseOrderDetail, products: Product[]): Line[] {
  return order.items.map((item) => {
    const key = item.medicationId ? `M:${item.medicationId}` : `I:${item.inventoryItemId}`;
    const product = products.find((p) => p.key === key) ?? {
      key,
      kind: item.medicationId ? ('MEDICATION' as const) : ('INVENTORY' as const),
      id: (item.medicationId ?? item.inventoryItemId) as string,
      name: item.itemName,
      detail: '',
      lastCost: null,
    };
    return { product, quantity: String(item.quantity), unitPrice: String(item.unitPrice) };
  });
}

export function OrderForm({ order }: { order?: PurchaseOrderDetail }) {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [supplierId, setSupplierId] = useState(order?.supplierId ?? '');
  const [expectedAt, setExpectedAt] = useState(order?.expectedAt ? order.expectedAt.slice(0, 10) : '');
  const [expectedTouched, setExpectedTouched] = useState(Boolean(order?.expectedAt));
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const threshold = order?.threshold ?? DEFAULT_APPROVAL_THRESHOLD;

  useEffect(() => {
    api.getSuppliers({ isActive: true, limit: 100 }).then((r) => setSuppliers(r.suppliers)).catch((err) => setError(messageOf(err, t('pur.loadFailed'))));
    Promise.all([api.getPharmacyStock(), api.getInventory({ limit: 200 })])
      .then(([meds, inv]) => {
        const list: Product[] = [
          ...meds.map((m) => ({ key: `M:${m.id}`, kind: 'MEDICATION' as const, id: m.id, name: `${m.name} ${m.strength}`.trim(), detail: `${m.genericName} · ${m.dosageForm}`, lastCost: lastCostOf(m) })),
          ...inv.items.map((i: InventoryItem) => ({ key: `I:${i.id}`, kind: 'INVENTORY' as const, id: i.id, name: i.name, detail: `${i.sku} · ${i.unit}`, lastCost: Number(i.unitPrice) || null })),
        ];
        setProducts(list);
        if (order) setLines(draftLines(order, list));
      })
      .catch((err) => setError(messageOf(err, t('pur.loadFailed'))));
  }, [t, order]);

  const chooseSupplier = (id: string) => {
    setSupplierId(id);
    // Expected delivery: today + the supplier's usual delay, until the user picks a date
    if (!expectedTouched && id) setExpectedAt(addDaysIso(isoDay(), suppliers.find((s) => s.id === id)?.leadTimeDays ?? 7));
  };

  const q = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q || !products) return [];
    const taken = new Set(lines.map((l) => l.product.key));
    return products.filter((p) => !taken.has(p.key) && `${p.name} ${p.detail}`.toLowerCase().includes(q)).slice(0, 10);
  }, [q, products, lines]);

  const numericLines = lines.map((l) => ({ quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 }));
  const total = orderTotal(numericLines);
  const approval = needsApproval(total, threshold, user?.role);

  const addProduct = (product: Product) => {
    setLines((prev) => [...prev, { product, quantity: '1', unitPrice: product.lastCost != null ? String(product.lastCost) : '' }]);
    setSearch('');
  };
  const update = (index: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const save = async () => {
    setError('');
    if (!supplierId) return setError(t('pur.form.err.supplier'));
    if (!lines.length) return setError(t('pur.form.err.noLines'));
    if (lines.some((l) => !Number.isInteger(Number(l.quantity)) || Number(l.quantity) < 1)) return setError(t('pur.form.err.quantity'));
    if (lines.some((l) => l.unitPrice === '' || Number(l.unitPrice) < 0 || Number.isNaN(Number(l.unitPrice)))) return setError(t('pur.form.err.price'));
    const input: PurchaseOrderInput = {
      supplierId,
      ...(expectedAt ? { expectedAt } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      items: lines.map((l) => ({
        ...(l.product.kind === 'MEDICATION' ? { medicationId: l.product.id } : { inventoryItemId: l.product.id }),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      })),
    };
    setSaving(true);
    try {
      const saved = order ? await api.updatePurchaseOrder(order.id, input) : await api.createPurchaseOrder(input);
      toast.success(order ? t('pur.form.updated') : t('pur.form.created', { number: saved.orderNumber }));
      router.push(`/dashboard/purchasing/${saved.id ?? order?.id}`);
    } catch (err) {
      setError(messageOf(err, t('pur.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      <div className={`${cardClass} p-4 grid grid-cols-1 md:grid-cols-3 gap-4`}>
        <div>
          <label className={labelClass} htmlFor="po-supplier">{t('pur.supplier')} *</label>
          <select id="po-supplier" value={supplierId} onChange={(e) => chooseSupplier(e.target.value)} className={inputClass}>
            <option value="">{t('pur.form.chooseSupplier')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="po-expected">{t('pur.expectedAt')}</label>
          <input id="po-expected" type="date" min={isoDay()} value={expectedAt} onChange={(e) => { setExpectedAt(e.target.value); setExpectedTouched(true); }} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="po-notes">{t('pur.notes')}</label>
          <input id="po-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className={`${cardClass} p-4 space-y-3`}>
        <div className="relative max-w-xl">
          <label className={labelClass} htmlFor="po-search">{t('pur.form.addProduct')}</label>
          <input
            id="po-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={products === null ? t('pur.loading') : t('pur.form.searchProduct')}
            disabled={products === null}
            className={inputClass}
            autoComplete="off"
          />
          {matches.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-72 overflow-y-auto" role="listbox">
              {matches.map((p) => (
                <li key={p.key}>
                  <button type="button" onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{t(`pur.kind.${p.kind}`)}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{p.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q && products && matches.length === 0 && <p className="mt-1 text-xs text-gray-500">{t('pur.noResult')}</p>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">{t('pur.product')}</th>
                <th className="px-3 py-2 text-right w-28">{t('pur.qty')}</th>
                <th className="px-3 py-2 text-right w-36">{t('pur.unitPrice')}</th>
                <th className="px-3 py-2 text-right w-36">{t('pur.amount')}</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {lines.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">{t('pur.form.noLines')}</td></tr>
              )}
              {lines.map((l, i) => (
                <tr key={l.product.key}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-900 dark:text-white">{l.product.name}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{t(`pur.kind.${l.product.kind}`)}{l.product.detail ? ` · ${l.product.detail}` : ''}</span>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={1} step={1} value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} className={`${inputClass} text-right`} aria-label={t('pur.qty')} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} step={1} value={l.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value })} className={`${inputClass} text-right`} aria-label={t('pur.unitPrice')} />
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white tabular-nums">{formatCurrency(lineTotal(numericLines[i].quantity, numericLines[i].unitPrice))}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className={smallBtn} onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))} aria-label={t('pur.form.removeLine')}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-gray-700">
                <td colSpan={3} className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">{t('pur.total')}</td>
                <td className="px-3 py-3 text-right text-lg font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {approval && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm">
            {t('pur.form.approvalRequired', { threshold: formatCurrency(threshold) })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Link href={order ? `/dashboard/purchasing/${order.id}` : '/dashboard/purchasing'} className={cancelBtn}>{t('pur.cancel')}</Link>
        <button type="button" className={primaryBtn} onClick={save} disabled={saving}>{saving ? t('pur.saving') : t('pur.form.saveDraft')}</button>
      </div>
    </div>
  );
}
