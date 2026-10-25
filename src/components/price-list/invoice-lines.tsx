'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import {
  SERVICE_CATEGORIES,
  canSetPrice,
  categoryLabel,
  emptyLine,
  isPriceChanged,
  lineFromTariff,
  repriceLines,
  type InvoiceLineDraft,
  type TariffSearchItem,
} from '@/lib/price-list';
import { KindBadge, TariffPicker } from './ui';

const fieldClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm';

/**
 * Invoice lines picked from the price list. The price is locked to the list (or the payer's negotiated
 * price); "Modifier le prix" lets a receptionist lower it and an admin set any price, with a reason.
 * Admins may also add a free line that is not on the price list.
 */
export function InvoiceLinesEditor({
  lines,
  onChange,
  payerId,
  role,
}: {
  lines: InvoiceLineDraft[];
  onChange: (lines: InvoiceLineDraft[]) => void;
  payerId: string | null;
  role: string | undefined;
}) {
  const { t, formatCurrency } = useLanguage();
  const isAdmin = role === 'ADMIN';
  const [editingPrice, setEditingPrice] = useState<Record<string, boolean>>({});
  const linesRef = useRef(lines);
  linesRef.current = lines;

  // The payer changed (coverage chosen or found): move untouched lines to that payer's prices
  useEffect(() => {
    const current = linesRef.current;
    const picked = current.filter((l) => l.tariff);
    if (picked.length === 0) return;
    let cancelled = false;
    Promise.all(
      picked.map((line) =>
        api
          .searchTariffs({ q: line.code || line.description, kind: line.tariff!.kind, payerId, limit: 20 })
          .then((items) => items.find((i) => i.ref === line.tariff!.ref) ?? null)
          .catch(() => null)
      )
    ).then((found) => {
      if (cancelled) return;
      const prices = new Map<string, TariffSearchItem>();
      for (const item of found) if (item) prices.set(`${item.kind}:${item.ref}`, item);
      if (prices.size > 0) onChange(repriceLines(linesRef.current, prices));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payerId]);

  const update = (index: number, patch: Partial<InvoiceLineDraft>) => onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const remove = (index: number) => {
    const next = lines.filter((_, i) => i !== index);
    onChange(next.length ? next : [emptyLine()]);
  };
  const pick = (index: number, item: TariffSearchItem) => {
    const { uid, quantity } = lines[index];
    update(index, { ...lineFromTariff(item, quantity || 1), uid });
  };
  const resetPrice = (index: number) => {
    const line = lines[index];
    update(index, { unitPrice: line.listPrice ?? line.unitPrice, overrideReason: '' });
    setEditingPrice((prev) => ({ ...prev, [line.uid]: false }));
  };

  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const changed = isPriceChanged(line);
        const editing = editingPrice[line.uid] || changed;
        const tooHigh = line.tariff && line.listPrice != null && !canSetPrice(role, line.listPrice, line.unitPrice);
        return (
          <div key={line.uid} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            {!line.tariff && (
              <FreeOrPick
                line={line}
                isAdmin={isAdmin}
                payerId={payerId}
                onPick={(item) => pick(index, item)}
                onUpdate={(patch) => update(index, patch)}
                onRemove={() => remove(index)}
                canRemove={lines.length > 1}
                autoFocus={lines.length > 1 && index === lines.length - 1}
              />
            )}

            {line.tariff && (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <KindBadge kind={line.tariff.kind} />
                    {line.code && <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{line.code}</span>}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{line.description}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{categoryLabel(t, line.category)}</span>
                    {line.payerAdjusted && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">{t('pl.lines.payerPrice')}</span>}
                  </div>
                  <button type="button" onClick={() => remove(index)} aria-label={t('pl.lines.remove', { n: index + 1 })} title={t('pl.lines.remove', { n: index + 1 })} className="p-1 text-red-600 hover:text-red-800">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1" htmlFor={`pl-qty-${index}`}>{t('pl.lines.qty')}</label>
                    <input id={`pl-qty-${index}`} type="number" min={1} value={line.quantity} onChange={(e) => update(index, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} className={fieldClass} />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1" htmlFor={`pl-price-${index}`}>{t('pl.lines.unitPrice')}</label>
                    {editing ? (
                      <input
                        id={`pl-price-${index}`}
                        type="number"
                        min={0}
                        step={1}
                        max={isAdmin ? undefined : line.listPrice ?? undefined}
                        value={line.unitPrice}
                        onChange={(e) => update(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                        className={`${fieldClass} ${tooHigh ? 'border-red-500' : ''}`}
                      />
                    ) : (
                      <div className="flex items-center gap-2 py-2">
                        <span className="text-sm font-medium tabular-nums text-gray-900 dark:text-white">{formatCurrency(line.unitPrice)}</span>
                        {(role === 'ADMIN' || role === 'RECEPTIONIST') && (
                          <button type="button" onClick={() => setEditingPrice((prev) => ({ ...prev, [line.uid]: true }))} className="text-xs text-lime-700 hover:text-lime-900 dark:text-lime-400 font-medium">
                            {t('pl.lines.changePrice')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-4 text-sm text-gray-600 dark:text-gray-400 pb-2">
                    {changed && line.listPrice != null && (
                      <span>
                        {t('pl.lines.listPrice', { price: formatCurrency(line.listPrice) })}{' '}
                        <button type="button" onClick={() => resetPrice(index)} className="text-xs text-lime-700 hover:text-lime-900 dark:text-lime-400 font-medium">{t('pl.lines.reset')}</button>
                      </span>
                    )}
                    {editing && !changed && (
                      <button type="button" onClick={() => resetPrice(index)} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">{t('pl.cancel')}</button>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-2 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-white pb-2">
                    {formatCurrency(line.quantity * line.unitPrice)}
                  </div>
                </div>
                {tooHigh && <p className="text-xs text-red-600 dark:text-red-400">{t('pl.err.increase')}</p>}
                {changed && (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1" htmlFor={`pl-reason-${index}`}>{t('pl.lines.reason')} *</label>
                    <input id={`pl-reason-${index}`} value={line.overrideReason} onChange={(e) => update(index, { overrideReason: e.target.value })} placeholder={t('pl.lines.reasonHint')} className={fieldClass} />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => onChange([...lines, emptyLine()])} className="text-sm text-lime-600 hover:text-lime-800 font-medium">
          {t('pl.lines.add')}
        </button>
      </div>
    </div>
  );
}

/** A line not yet chosen: the price-list search, or (admin) a free line typed by hand */
function FreeOrPick({
  line,
  isAdmin,
  payerId,
  onPick,
  onUpdate,
  onRemove,
  canRemove,
  autoFocus = false,
}: {
  line: InvoiceLineDraft;
  isAdmin: boolean;
  payerId: string | null;
  onPick: (item: TariffSearchItem) => void;
  onUpdate: (patch: Partial<InvoiceLineDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
  /** A line just added with "+ Ajouter une ligne": put the cursor in its search */
  autoFocus?: boolean;
}) {
  const { t, formatCurrency } = useLanguage();
  const [free, setFree] = useState(line.description !== '' || line.unitPrice > 0);

  if (!free) {
    return (
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <TariffPicker payerId={payerId} onPick={onPick} autoFocus={autoFocus} />
        </div>
        {isAdmin && (
          <button type="button" onClick={() => setFree(true)} className="px-2 py-2 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 whitespace-nowrap">
            {t('pl.lines.freeLine')}
          </button>
        )}
        {canRemove && (
          <button type="button" onClick={onRemove} aria-label={t('pl.lines.removeEmpty')} title={t('pl.lines.removeEmpty')} className="p-2 text-red-600 hover:text-red-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-amber-700 dark:text-amber-400">{t('pl.lines.freeHint')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
        <div className="col-span-2 sm:col-span-5">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('pl.lines.description')}</label>
          <input value={line.description} onChange={(e) => onUpdate({ description: e.target.value })} className={fieldClass} />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('pl.lines.category')}</label>
          <select value={line.category} onChange={(e) => onUpdate({ category: e.target.value })} className={fieldClass}>
            {SERVICE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{categoryLabel(t, cat)}</option>)}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('pl.lines.qty')}</label>
          <input type="number" min={1} value={line.quantity} onChange={(e) => onUpdate({ quantity: Math.max(1, parseInt(e.target.value) || 1) })} className={fieldClass} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('pl.lines.unitPrice')}</label>
          <input type="number" min={0} step={1} value={line.unitPrice} onChange={(e) => onUpdate({ unitPrice: parseFloat(e.target.value) || 0 })} className={fieldClass} />
        </div>
        <div className="sm:col-span-1 flex justify-end gap-1 pb-1">
          <button
            type="button"
            onClick={() => {
              onUpdate({ description: '', unitPrice: 0, category: 'other' });
              setFree(false);
            }}
            className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400"
          >
            {t('pl.lines.backToList')}
          </button>
        </div>
      </div>
      <div className="flex justify-between text-sm">
        {canRemove ? (
          <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:text-red-800">{t('pl.lines.removeEmpty')}</button>
        ) : <span />}
        <span className="font-medium tabular-nums text-gray-900 dark:text-white">{formatCurrency(line.quantity * line.unitPrice)}</span>
      </div>
    </div>
  );
}
