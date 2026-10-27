'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { TARIFF_KINDS, payerTariffProblem, payerTariffValue, type PayerTariff, type TariffKind, type TariffSearchItem } from '@/lib/price-list';
import { DialogShell, ErrorBox, KindBadge, TariffPicker, cancelBtn, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from './ui';

interface Draft {
  scope: 'act' | 'kind';
  act: TariffSearchItem | null;
  kind: TariffKind;
  price: string;
  discountPercent: string;
  validFrom: string;
  validUntil: string;
}

const emptyDraft = (): Draft => ({ scope: 'act', act: null, kind: 'LAB_TEST', price: '', discountPercent: '', validFrom: '', validUntil: '' });

/** Prices negotiated with one payer: per act (fixed price or %) or a % for a whole kind of act */
export function PayerTariffsDialog({ payer, canEdit, onClose }: { payer: { id: string; name: string }; canEdit: boolean; onClose: () => void }) {
  const { t, formatCurrency, formatDate } = useLanguage();
  const toast = useToast();
  const [tariffs, setTariffs] = useState<PayerTariff[] | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .getPayerTariffs(payer.id)
      .then((list) => {
        setTariffs(list);
        setError('');
      })
      .catch((err) => setError(messageOf(err, t('pl.loadFailed'))));
  }, [payer.id, t]);

  useEffect(() => load(), [load]);

  const save = async () => {
    if (!draft) return;
    const tariffRef = draft.scope === 'act' ? draft.act?.ref ?? null : null;
    if (draft.scope === 'act' && !draft.act) return setFormError(t('pl.payer.err.pickAct'));
    const problem = payerTariffProblem({ tariffRef, price: draft.price, discountPercent: draft.discountPercent, validFrom: draft.validFrom, validUntil: draft.validUntil });
    if (problem) return setFormError(t(problem));
    setBusy(true);
    setFormError('');
    try {
      await api.savePayerTariff(payer.id, {
        tariffKind: draft.scope === 'act' ? draft.act!.kind : draft.kind,
        tariffRef,
        price: draft.price.trim() ? Number(draft.price) : null,
        discountPercent: draft.discountPercent.trim() ? Number(draft.discountPercent) : null,
        validFrom: draft.validFrom || null,
        validUntil: draft.validUntil || null,
      });
      toast.success(t('pl.payer.saved'));
      setDraft(null);
      load();
    } catch (err) {
      setFormError(messageOf(err, t('pl.saveFailed')));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (tariff: PayerTariff) => {
    try {
      await api.deletePayerTariff(payer.id, tariff.id);
      toast.success(t('pl.payer.deleted'));
      load();
    } catch (err) {
      setError(messageOf(err, t('pl.saveFailed')));
    }
  };

  const validity = (tariff: PayerTariff) => {
    if (!tariff.validFrom && !tariff.validUntil) return t('pl.payer.always');
    if (tariff.validFrom && tariff.validUntil) return t('pl.payer.fromTo', { from: formatDate(tariff.validFrom), to: formatDate(tariff.validUntil) });
    if (tariff.validFrom) return t('pl.payer.from', { from: formatDate(tariff.validFrom) });
    return t('pl.payer.until', { to: formatDate(tariff.validUntil!) });
  };

  return (
    <DialogShell
      wide
      title={t('pl.payer.title', { name: payer.name })}
      subtitle={t('pl.payer.subtitle')}
      onClose={onClose}
      footer={<button type="button" className={cancelBtn} onClick={onClose}>{t('pl.close')}</button>}
    >
      <ErrorBox message={error} />
      {tariffs === null && !error && <p className="text-sm text-gray-500 dark:text-gray-400">{t('pl.loading')}</p>}
      {tariffs && tariffs.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('pl.payer.empty')}</p>}
      {tariffs && tariffs.length > 0 && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {tariffs.map((tariff) => (
            <li key={tariff.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <KindBadge kind={tariff.tariffKind} />
                <span className="text-gray-900 dark:text-white">{tariff.tariffRef ? tariff.label ?? '—' : t('pl.payer.allOfKind', { kind: t(`pl.kind.${tariff.tariffKind}`) })}</span>
              </span>
              <span className="flex items-center gap-3">
                {tariff.listPrice != null && tariff.price != null && <span className="text-xs text-gray-400 line-through tabular-nums">{formatCurrency(tariff.listPrice)}</span>}
                <span className="font-medium tabular-nums text-blue-700 dark:text-blue-400">{payerTariffValue(tariff, formatCurrency)}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{validity(tariff)}</span>
                {canEdit && (
                  <button type="button" className={smallBtn} onClick={() => remove(tariff)} aria-label={t('pl.payer.deleteLabel', { label: tariff.label ?? t(`pl.kind.${tariff.tariffKind}`) })}>
                    {t('pl.payer.delete')}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canEdit && !draft && (
        <button type="button" className={primaryBtn} onClick={() => { setDraft(emptyDraft()); setFormError(''); }}>
          {t('pl.payer.add')}
        </button>
      )}

      {canEdit && draft && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <ErrorBox message={formError} />
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="sr-only">{t('pl.payer.scope')}</legend>
            <label className="flex items-center gap-2">
              <input type="radio" checked={draft.scope === 'act'} onChange={() => setDraft({ ...draft, scope: 'act' })} />
              {t('pl.payer.scopeAct')}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={draft.scope === 'kind'} onChange={() => setDraft({ ...draft, scope: 'kind', price: '' })} />
              {t('pl.payer.scopeKind')}
            </label>
          </fieldset>
          {draft.scope === 'act' ? (
            draft.act ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <KindBadge kind={draft.act.kind} />
                  <span className="text-gray-900 dark:text-white">{draft.act.label}</span>
                  <span className="text-gray-500 dark:text-gray-400 tabular-nums">{formatCurrency(draft.act.listPrice)}</span>
                </span>
                <button type="button" className={smallBtn} onClick={() => setDraft({ ...draft, act: null })}>{t('pl.payer.changeAct')}</button>
              </div>
            ) : (
              <TariffPicker onPick={(item) => setDraft({ ...draft, act: item })} autoFocus />
            )
          ) : (
            <div>
              <label htmlFor="pl-payer-kind" className={labelClass}>{t('pl.payer.kind')}</label>
              <select id="pl-payer-kind" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as TariffKind })} className={inputClass}>
                {TARIFF_KINDS.map((kind) => <option key={kind} value={kind}>{t(`pl.kind.${kind}`)}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {draft.scope === 'act' && (
              <div>
                <label htmlFor="pl-payer-price" className={labelClass}>{t('pl.payer.price')}</label>
                <input id="pl-payer-price" type="number" min={0} step={1} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value, discountPercent: e.target.value ? '' : draft.discountPercent })} className={inputClass} />
              </div>
            )}
            <div>
              <label htmlFor="pl-payer-pct" className={labelClass}>{t('pl.payer.percent')}</label>
              <input id="pl-payer-pct" type="number" min={0} max={100} step={1} value={draft.discountPercent} onChange={(e) => setDraft({ ...draft, discountPercent: e.target.value, price: e.target.value ? '' : draft.price })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="pl-payer-from" className={labelClass}>{t('pl.payer.validFrom')}</label>
              <input id="pl-payer-from" type="date" value={draft.validFrom} onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="pl-payer-until" className={labelClass}>{t('pl.payer.validUntil')}</label>
              <input id="pl-payer-until" type="date" value={draft.validUntil} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })} className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('pl.payer.hint')}</p>
          <div className="flex justify-end gap-2">
            <button type="button" className={cancelBtn} onClick={() => setDraft(null)} disabled={busy}>{t('pl.cancel')}</button>
            <button type="button" className={primaryBtn} onClick={save} disabled={busy}>{busy ? t('pl.saving') : t('pl.save')}</button>
          </div>
        </div>
      )}
    </DialogShell>
  );
}
