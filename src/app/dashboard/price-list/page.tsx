'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { hasPermission } from '@/lib/rbac';
import { SERVICE_CATEGORIES, TARIFF_KINDS, categoryLabel, tariffsToCsv, type TariffItem, type TariffKind } from '@/lib/price-list';
import {
  DialogShell,
  ErrorBox,
  KindBadge,
  PriceDialog,
  PriceHistoryList,
  cancelBtn,
  cardClass,
  inputClass,
  labelClass,
  messageOf,
  primaryBtn,
  smallBtn,
} from '@/components/price-list/ui';

type Tab = TariffKind | 'HISTORY';
const PAGE_SIZE = 50;

export default function PriceListPage() {
  const { user } = useAuth();
  const { t, formatCurrency, formatDate } = useLanguage();
  const toast = useToast();
  const canManage = user ? hasPermission(user.role, 'pricing:manage') : false;
  const [tab, setTab] = useState<Tab>('SERVICE');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TariffItem[] | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [pricing, setPricing] = useState<TariffItem | null>(null);
  const [historyOf, setHistoryOf] = useState<TariffItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(() => {
    if (tab === 'HISTORY') return;
    api
      .getTariffs({ kind: tab, q: query.trim() || undefined, page, limit: PAGE_SIZE })
      .then((res) => {
        setItems(res.items);
        setTotalPages(res.pagination.totalPages || 1);
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('pl.loadFailed'))));
  }, [tab, query, page, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setPage(1);
    setItems(null);
  };

  const toggleActive = async (item: TariffItem) => {
    try {
      await api.updateServiceTariff(item.ref, { active: !item.active });
      toast.success(item.active ? t('pl.deactivated') : t('pl.activated'));
      load();
    } catch (err) {
      toast.error(t('pl.saveFailed'), messageOf(err, ''));
    }
  };

  // CSV of the whole current tab (all pages), built in the browser
  const exportCsv = async () => {
    if (tab === 'HISTORY') return;
    setExporting(true);
    try {
      const all: TariffItem[] = [];
      let p = 1;
      let pages = 1;
      do {
        const res = await api.getTariffs({ kind: tab, page: p, limit: 200 });
        all.push(...res.items);
        pages = res.pagination.totalPages || 1;
        p += 1;
      } while (p <= pages);
      const csv = tariffsToCsv(all, (kind) => t(`pl.kind.${kind}`), [t('pl.col.kind'), t('pl.col.code'), t('pl.col.label'), t('pl.col.category'), t('pl.col.price'), t('pl.col.active')]);
      const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `grille-tarifaire-${tab.toLowerCase()}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast.error(t('pl.exportFailed'), messageOf(err, ''));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pl.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{canManage ? t('pl.subtitleManage') : t('pl.subtitleView')}</p>
        </div>
        {tab !== 'HISTORY' && (
          <div className="flex gap-2">
            <button type="button" className={cancelBtn} onClick={exportCsv} disabled={exporting}>{exporting ? t('pl.exporting') : t('pl.export')}</button>
            {canManage && tab === 'SERVICE' && <button type="button" className={primaryBtn} onClick={() => setCreating(true)}>{t('pl.newAct')}</button>}
          </div>
        )}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max" role="tablist">
          {[...TARIFF_KINDS, 'HISTORY' as const].map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => switchTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === key ? 'border-lime-600 text-lime-700 dark:text-lime-400' : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
            >
              {key === 'HISTORY' ? t('pl.tab.history') : t(`pl.kind.${key}`)}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'HISTORY' ? (
        <div className={`${cardClass} p-4 space-y-4`}>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label htmlFor="pl-from" className={labelClass}>{t('pl.history.from')}</label>
              <input id="pl-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="pl-to" className={labelClass}>{t('pl.history.to')}</label>
              <input id="pl-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </div>
          </div>
          <PriceHistoryList from={from} to={to} />
        </div>
      ) : (
        <div className={cardClass}>
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t('pl.search')}
              aria-label={t('pl.search')}
              className={`${inputClass} max-w-md`}
            />
          </div>
          <ErrorBox message={error} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-3">{t('pl.col.code')}</th>
                  <th className="px-4 py-3">{t('pl.col.label')}</th>
                  <th className="px-4 py-3">{t('pl.col.category')}</th>
                  <th className="px-4 py-3 text-right">{t('pl.col.price')}</th>
                  <th className="px-4 py-3">{t('pl.col.updated')}</th>
                  <th className="px-4 py-3">{t('pl.col.active')}</th>
                  <th className="px-4 py-3"><span className="sr-only">{t('pl.col.actions')}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items === null && !error && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">{t('pl.loading')}</td></tr>
                )}
                {items && items.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">{t('pl.empty')}</td></tr>
                )}
                {items?.map((item) => (
                  <tr key={`${item.kind}:${item.ref}`} className={item.active ? '' : 'opacity-60'}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{item.code ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      <span className="inline-flex items-center gap-2"><KindBadge kind={item.kind} />{item.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{categoryLabel(t, item.category)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-white">{formatCurrency(item.listPrice)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(item.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.active ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {item.active ? t('pl.active') : t('pl.inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canManage && <button type="button" className={smallBtn} onClick={() => setPricing(item)}>{t('pl.changePrice')}</button>}
                        <button type="button" className={smallBtn} onClick={() => setHistoryOf(item)}>{t('pl.history.open')}</button>
                        {canManage && item.kind === 'SERVICE' && (
                          <button type="button" className={smallBtn} onClick={() => toggleActive(item)}>{item.active ? t('pl.deactivate') : t('pl.activate')}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-4 flex items-center justify-end gap-2 text-sm">
              <button type="button" className={cancelBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('pl.prev')}</button>
              <span className="text-gray-600 dark:text-gray-400">{t('pl.page', { page, total: totalPages })}</span>
              <button type="button" className={cancelBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('pl.next')}</button>
            </div>
          )}
        </div>
      )}

      {pricing && (
        <PriceDialog
          label={pricing.label}
          current={pricing.listPrice}
          onClose={() => setPricing(null)}
          onSave={async (price, reason) => {
            await api.setTariffPrice(pricing.kind, pricing.ref, { price, ...(reason ? { reason } : {}) });
            toast.success(t('pl.priceSaved'));
            setPricing(null);
            load();
          }}
        />
      )}

      {historyOf && (
        <DialogShell
          wide
          title={t('pl.history.title')}
          subtitle={historyOf.label}
          onClose={() => setHistoryOf(null)}
          footer={<button type="button" className={cancelBtn} onClick={() => setHistoryOf(null)}>{t('pl.close')}</button>}
        >
          <PriceHistoryList kind={historyOf.kind} tariffRef={historyOf.ref} />
        </DialogShell>
      )}

      {creating && <NewActDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function NewActDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<string>('procedure');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!/^[A-Z0-9-]{2,30}$/.test(code)) return setError(t('pl.err.code'));
    if (!label.trim()) return setError(t('pl.err.label'));
    if (price.trim() === '' || !(Number(price) >= 0)) return setError(t('pl.err.price'));
    setBusy(true);
    setError('');
    try {
      await api.createServiceTariff({ code, label: label.trim(), category, price: Number(price), ...(notes.trim() ? { notes: notes.trim() } : {}) });
      toast.success(t('pl.actCreated'));
      onCreated();
    } catch (err) {
      setError(messageOf(err, t('pl.saveFailed')));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={t('pl.newAct')}
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
        <label htmlFor="pl-code" className={labelClass}>{t('pl.col.code')} *</label>
        <input id="pl-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} placeholder="ACT-PANS-S" className={`${inputClass} font-mono`} maxLength={30} />
      </div>
      <div>
        <label htmlFor="pl-label" className={labelClass}>{t('pl.col.label')} *</label>
        <input id="pl-label" value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pl-category" className={labelClass}>{t('pl.col.category')}</label>
          <select id="pl-category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            {SERVICE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{categoryLabel(t, cat)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pl-new-price" className={labelClass}>{t('pl.col.price')} *</label>
          <input id="pl-new-price" type="number" min={0} step={1} value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="pl-notes" className={labelClass}>{t('pl.notes')}</label>
        <input id="pl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}
