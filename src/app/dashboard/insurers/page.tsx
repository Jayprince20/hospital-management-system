'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, BillingCategory, Payer, PayerInput, PayerType } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { PayerTariffsDialog } from '@/components/price-list/payer-tariffs';

const PAYER_TYPES: PayerType[] = ['PRIVATE_INSURER', 'CSU', 'MUTUAL', 'EMPLOYER'];
const CATEGORIES: BillingCategory[] = ['consultation', 'medication', 'lab', 'procedure', 'other'];

interface RuleDraft {
  percent: string; // '' = payer default
  excluded: boolean;
  maxAmountPerItem: string;
}

interface PayerDraft {
  name: string;
  code: string;
  type: PayerType;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  defaultCoveragePercent: string;
  requiresPreAuth: boolean;
  preAuthThreshold: string;
  paymentTermsDays: string;
  notes: string;
  rules: Record<BillingCategory, RuleDraft>;
}

const emptyRules = (): Record<BillingCategory, RuleDraft> =>
  Object.fromEntries(CATEGORIES.map((c) => [c, { percent: '', excluded: false, maxAmountPerItem: '' }])) as Record<BillingCategory, RuleDraft>;

const emptyDraft = (): PayerDraft => ({
  name: '', code: '', type: 'PRIVATE_INSURER', contactName: '', email: '', phone: '', address: '',
  defaultCoveragePercent: '80', requiresPreAuth: false, preAuthThreshold: '', paymentTermsDays: '60', notes: '',
  rules: emptyRules(),
});

function draftFromPayer(payer: Payer): PayerDraft {
  const rules = emptyRules();
  for (const rule of payer.coverageRules) {
    rules[rule.category] = {
      percent: String(rule.coveragePercent),
      excluded: rule.excluded,
      maxAmountPerItem: rule.maxAmountPerItem != null ? String(rule.maxAmountPerItem) : '',
    };
  }
  return {
    name: payer.name, code: payer.code, type: payer.type,
    contactName: payer.contactName ?? '', email: payer.email ?? '', phone: payer.phone ?? '', address: payer.address ?? '',
    defaultCoveragePercent: String(payer.defaultCoveragePercent), requiresPreAuth: payer.requiresPreAuth,
    preAuthThreshold: payer.preAuthThreshold != null ? String(payer.preAuthThreshold) : '',
    paymentTermsDays: String(payer.paymentTermsDays), notes: payer.notes ?? '', rules,
  };
}

function toInput(draft: PayerDraft): PayerInput {
  const defaultPercent = Number(draft.defaultCoveragePercent);
  return {
    name: draft.name.trim(),
    code: draft.code.trim().toUpperCase(),
    type: draft.type,
    contactName: draft.contactName.trim() || undefined,
    email: draft.email.trim() || undefined,
    phone: draft.phone.trim() || undefined,
    address: draft.address.trim() || undefined,
    defaultCoveragePercent: defaultPercent,
    requiresPreAuth: draft.requiresPreAuth,
    preAuthThreshold: draft.requiresPreAuth && draft.preAuthThreshold !== '' ? Number(draft.preAuthThreshold) : null,
    paymentTermsDays: Number(draft.paymentTermsDays),
    notes: draft.notes.trim() || undefined,
    // Only categories that differ from the default are stored as rules
    coverageRules: CATEGORIES.filter((c) => draft.rules[c].excluded || draft.rules[c].percent !== '' || draft.rules[c].maxAmountPerItem !== '').map((c) => ({
      category: c,
      coveragePercent: draft.rules[c].excluded ? 0 : draft.rules[c].percent !== '' ? Number(draft.rules[c].percent) : defaultPercent,
      excluded: draft.rules[c].excluded,
      maxAmountPerItem: draft.rules[c].maxAmountPerItem !== '' ? Number(draft.rules[c].maxAmountPerItem) : null,
    })),
  };
}

function validate(draft: PayerDraft): string | null {
  if (!draft.name.trim() || !draft.code.trim()) return 'ins.payer.err.required';
  const pct = (v: string) => v !== '' && (!Number.isInteger(Number(v)) || Number(v) < 0 || Number(v) > 100);
  if (draft.defaultCoveragePercent === '' || pct(draft.defaultCoveragePercent)) return 'ins.payer.err.percent';
  if (CATEGORIES.some((c) => pct(draft.rules[c].percent))) return 'ins.payer.err.percent';
  if (!Number.isInteger(Number(draft.paymentTermsDays)) || Number(draft.paymentTermsDays) < 0) return 'ins.payer.err.terms';
  return null;
}

const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm';

export default function InsurersPage() {
  const { user } = useAuth();
  const { t, formatCurrency } = useLanguage();
  const canEdit = user?.role === 'ADMIN';
  const [payers, setPayers] = useState<Payer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Payer | 'new' | null>(null);
  const [draft, setDraft] = useState<PayerDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Negotiated prices of one payer (price list)
  const [tariffsFor, setTariffsFor] = useState<Payer | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError('');
      setPayers(await api.getPayers({ search: search || undefined, active: showInactive ? undefined : true }));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('ins.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [search, showInactive, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const open = (payer: Payer | 'new') => {
    setEditing(payer);
    setDraft(payer === 'new' ? emptyDraft() : draftFromPayer(payer));
    setError('');
  };

  const save = async () => {
    const problem = validate(draft);
    if (problem) { setError(t(problem)); return; }
    try {
      setSaving(true);
      setError('');
      if (editing === 'new') await api.createPayer(toInput(draft));
      else if (editing) await api.updatePayer(editing.id, toInput(draft));
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ins.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (payer: Payer) => {
    try {
      await api.updatePayer(payer.id, { isActive: !payer.isActive });
      load();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('ins.saveFailed'));
    }
  };

  const setRule = (category: BillingCategory, patch: Partial<RuleDraft>) =>
    setDraft((d) => ({ ...d, rules: { ...d.rules, [category]: { ...d.rules[category], ...patch } } }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ins.payers.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('ins.payers.subtitle')}</p>
        </div>
        {canEdit && (
          <button onClick={() => open('new')} className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t('ins.payers.new')}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4 sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('ins.payers.search')}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            {t('ins.payers.showInactive')}
          </label>
        </div>
        {loadError && <p className="p-4 text-sm text-red-600 dark:text-red-400">{loadError}</p>}
        {loading ? (
          <div className="flex justify-center h-48 items-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lime-600" /></div>
        ) : payers.length === 0 ? (
          <p className="text-center py-12 text-gray-500 dark:text-gray-400">{t('ins.payers.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">
                  <th className="px-6 py-3">{t('ins.payer.name')}</th>
                  <th className="px-6 py-3">{t('ins.payer.type')}</th>
                  <th className="px-6 py-3">{t('ins.payer.coverage')}</th>
                  <th className="px-6 py-3">{t('ins.payer.preAuth')}</th>
                  <th className="px-6 py-3">{t('ins.payer.terms')}</th>
                  <th className="px-6 py-3">{t('ins.payer.insured')}</th>
                  <th className="px-6 py-3">{t('ins.payer.status')}</th>
                  <th className="px-6 py-3">{t('ins.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {payers.map((payer) => (
                  <tr key={payer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 align-top">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">{payer.name}</p>
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{payer.code}</p>
                      {(payer.phone || payer.email) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{[payer.phone, payer.email].filter(Boolean).join(' · ')}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{t(`ins.payerType.${payer.type}`)}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <p className="font-medium">{payer.defaultCoveragePercent} %</p>
                      {payer.coverageRules.map((rule) => (
                        <p key={rule.category} className="text-xs text-gray-500 dark:text-gray-400">
                          {t(`admin.billing.cat.${rule.category}`)} : {rule.excluded ? t('ins.payer.excluded') : `${rule.coveragePercent} %`}
                          {rule.maxAmountPerItem != null ? ` · ${t('ins.payer.max', { amount: formatCurrency(rule.maxAmountPerItem) })}` : ''}
                        </p>
                      ))}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {payer.requiresPreAuth
                        ? payer.preAuthThreshold != null
                          ? t('ins.payer.preAuthAbove', { amount: formatCurrency(payer.preAuthThreshold) })
                          : t('ins.payer.preAuthAlways')
                        : t('ins.payer.preAuthNo')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{t('ins.payer.days', { days: payer.paymentTermsDays })}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{payer.counts?.coverages ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${payer.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {payer.isActive ? t('ins.active') : t('ins.inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-3">
                        {canEdit && <button onClick={() => open(payer)} className="text-lime-600 hover:text-lime-800 font-medium">{t('ins.edit')}</button>}
                        <button onClick={() => setTariffsFor(payer)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium">{t('pl.payer.open')}</button>
                        {canEdit && (
                          <button onClick={() => toggleActive(payer)} className="text-gray-600 hover:text-gray-800 dark:text-gray-400 font-medium">
                            {payer.isActive ? t('ins.deactivate') : t('ins.activate')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tariffsFor && <PayerTariffsDialog payer={tariffsFor} canEdit={canEdit} onClose={() => setTariffsFor(null)} />}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editing === 'new' ? t('ins.payers.new') : t('ins.payers.edit', { name: editing.name })}
              </h2>
            </div>
            <div className="p-6 space-y-5">
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.payer.name')} *</label>
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.payer.code')} *</label>
                  <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} className={`${inputClass} font-mono`} maxLength={20} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.payer.type')}</label>
                  <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as PayerType })} className={inputClass}>
                    {PAYER_TYPES.map((type) => <option key={type} value={type}>{t(`ins.payerType.${type}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.payer.defaultPercent')} *</label>
                  <input type="number" min={0} max={100} value={draft.defaultCoveragePercent} onChange={(e) => setDraft({ ...draft, defaultCoveragePercent: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.payer.termsDays')}</label>
                  <input type="number" min={0} value={draft.paymentTermsDays} onChange={(e) => setDraft({ ...draft, paymentTermsDays: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.payer.contact')}</label>
                  <input value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.payer.phone')}</label>
                  <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.payer.email')}</label>
                  <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={inputClass} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.payer.address')}</label>
                  <input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} className={inputClass} />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={draft.requiresPreAuth} onChange={(e) => setDraft({ ...draft, requiresPreAuth: e.target.checked })} />
                  {t('ins.payer.requiresPreAuth')}
                </label>
                {draft.requiresPreAuth && (
                  <div className="max-w-xs">
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t('ins.payer.threshold')}</label>
                    <input type="number" min={0} value={draft.preAuthThreshold} onChange={(e) => setDraft({ ...draft, preAuthThreshold: e.target.value })} placeholder={t('ins.payer.thresholdHint')} className={inputClass} />
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{t('ins.payer.rules')}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('ins.payer.rulesHint')}</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                      <th className="py-1">{t('ins.payer.category')}</th>
                      <th className="py-1">{t('ins.payer.percent')}</th>
                      <th className="py-1">{t('ins.payer.maxPerItem')}</th>
                      <th className="py-1">{t('ins.payer.excluded')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORIES.map((category) => (
                      <tr key={category} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-2 text-gray-900 dark:text-white">{t(`admin.billing.cat.${category}`)}</td>
                        <td className="py-2 pr-2">
                          <input type="number" min={0} max={100} disabled={draft.rules[category].excluded} value={draft.rules[category].percent} placeholder={draft.defaultCoveragePercent} onChange={(e) => setRule(category, { percent: e.target.value })} className={`${inputClass} w-24`} />
                        </td>
                        <td className="py-2 pr-2">
                          <input type="number" min={0} disabled={draft.rules[category].excluded} value={draft.rules[category].maxAmountPerItem} placeholder="—" onChange={(e) => setRule(category, { maxAmountPerItem: e.target.value })} className={`${inputClass} w-32`} />
                        </td>
                        <td className="py-2">
                          <input type="checkbox" checked={draft.rules[category].excluded} onChange={(e) => setRule(category, { excluded: e.target.checked })} aria-label={t('ins.payer.excluded')} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ins.notes')}</label>
                <textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">{t('ins.cancel')}</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50">
                {saving ? t('ins.saving') : t('ins.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
