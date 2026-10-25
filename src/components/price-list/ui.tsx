'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { DialogShell, ErrorBox, cancelBtn, inputClass, labelClass, messageOf, primaryBtn } from '@/components/inpatient/ui';
import type { PriceChange, TariffKind, TariffSearchItem } from '@/lib/price-list';

export { DialogShell, ErrorBox, cancelBtn, inputClass, labelClass, messageOf, primaryBtn };
export { cardClass, smallBtn, dangerBtn } from '@/components/inpatient/ui';

const KIND_STYLE: Record<TariffKind, string> = {
  SERVICE: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300',
  CONSULTATION: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  LAB_TEST: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  IMAGING: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  MEDICATION: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  BED_DAY: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
};

export function KindBadge({ kind }: { kind: TariffKind }) {
  const { t } = useLanguage();
  return <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${KIND_STYLE[kind]}`}>{t(`pl.kindShort.${kind}`)}</span>;
}

/** New price with an optional reason (admin price change) */
export function PriceDialog({ label, current, onClose, onSave }: { label: string; current: number; onClose: () => void; onSave: (price: number, reason: string) => Promise<void> }) {
  const { t, formatCurrency } = useLanguage();
  const [price, setPrice] = useState(String(current));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const value = Number(price);
    if (price.trim() === '' || !(value >= 0)) return setError(t('pl.err.price'));
    if (value === current) return setError(t('pl.err.samePrice'));
    setBusy(true);
    setError('');
    try {
      await onSave(value, reason.trim());
    } catch (err) {
      setError(messageOf(err, t('pl.saveFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={t('pl.priceDialog.title')}
      subtitle={`${label} — ${t('pl.priceDialog.current', { price: formatCurrency(current) })}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose} disabled={busy}>{t('pl.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={save} disabled={busy}>{busy ? t('pl.saving') : t('pl.save')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label htmlFor="pl-price" className={labelClass}>{t('pl.priceDialog.newPrice')}</label>
        <input id="pl-price" type="number" min={0} step={1} value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} autoFocus />
      </div>
      <div>
        <label htmlFor="pl-reason" className={labelClass}>{t('pl.priceDialog.reason')}</label>
        <input id="pl-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('pl.priceDialog.reasonHint')} className={inputClass} />
      </div>
    </DialogShell>
  );
}

/** Price changes of one act (or all acts when kind/ref are omitted) */
export function PriceHistoryList({ kind, tariffRef, from, to }: { kind?: TariffKind; tariffRef?: string; from?: string; to?: string }) {
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const [changes, setChanges] = useState<PriceChange[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .getPriceChanges({ kind, ref: tariffRef, from: from || undefined, to: to || undefined, page })
      .then((res) => {
        if (cancelled) return;
        setChanges(res.items);
        setTotalPages(res.pagination.totalPages || 1);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err, t('pl.loadFailed')));
      });
    return () => {
      cancelled = true;
    };
  }, [kind, tariffRef, from, to, page, t]);

  if (error) return <ErrorBox message={error} />;
  if (changes === null) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('pl.loading')}</p>;
  if (changes.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('pl.history.empty')}</p>;
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {changes.map((c) => (
          <li key={c.id} className="py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                {!tariffRef && <KindBadge kind={c.tariffKind} />}
                {!tariffRef && <span className="font-medium text-gray-900 dark:text-white truncate">{c.label}</span>}
                <span className="tabular-nums text-gray-700 dark:text-gray-300">
                  {c.oldPrice != null ? formatCurrency(c.oldPrice) : '—'} → <strong>{formatCurrency(c.newPrice)}</strong>
                </span>
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDateTime(c.changedAt)}
                {c.changedBy?.name ? ` · ${c.changedBy.name}` : ''}
              </span>
            </div>
            {c.reason && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.reason}</p>}
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" className={cancelBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('pl.prev')}</button>
          <span className="text-gray-600 dark:text-gray-400">{t('pl.page', { page, total: totalPages })}</span>
          <button type="button" className={cancelBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('pl.next')}</button>
        </div>
      )}
    </div>
  );
}

/**
 * Search box over the whole price list (acts, consultations, lab, imaging, medications, bed days).
 * `payerId` shows the payer's negotiated price when one applies.
 */
export function TariffPicker({
  payerId,
  kind,
  onPick,
  autoFocus = false,
  placeholder,
}: {
  payerId?: string | null;
  kind?: TariffKind | '';
  onPick: (item: TariffSearchItem) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const { t, formatCurrency } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TariffSearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    // Short queries show nothing (the list is hidden below 2 characters)
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .searchTariffs({ q, kind: kind || undefined, payerId: payerId || undefined, limit: 15 })
        .then((list) => {
          if (cancelled) return;
          setResults(list);
          setActive(0);
          setOpen(true);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, kind, payerId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pick = (item: TariffSearchItem) => {
    onPick(item);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="pl-picker-list"
        aria-autocomplete="list"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? t('pl.picker.placeholder')}
        autoFocus={autoFocus}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      />
      {open && query.trim().length >= 2 && (
        <ul id="pl-picker-list" role="listbox" className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          {loading && results.length === 0 && <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t('pl.loading')}</li>}
          {!loading && results.length === 0 && <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t('pl.picker.none')}</li>}
          {results.map((item, index) => (
            <li
              key={`${item.kind}:${item.ref}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(item);
              }}
              onMouseEnter={() => setActive(index)}
              className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-3 text-sm ${index === active ? 'bg-lime-50 dark:bg-lime-900/30' : ''}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <KindBadge kind={item.kind} />
                {item.code && <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{item.code}</span>}
                <span className="truncate text-gray-900 dark:text-white">{item.label}</span>
              </span>
              <span className="text-right whitespace-nowrap tabular-nums">
                {item.payerAdjusted && <span className="line-through text-xs text-gray-400 mr-1">{formatCurrency(item.listPrice)}</span>}
                <span className={item.payerAdjusted ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-900 dark:text-white'}>{formatCurrency(item.price)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
