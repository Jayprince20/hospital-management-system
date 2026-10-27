'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { TemplateFormDialog } from '@/components/clinical-docs';
import { ErrorBox, cardClass, inputClass, messageOf, primaryBtn, smallBtn } from '@/components/clinical-docs/ui';
import { filterTemplates, sortTemplates, type ConsultationTemplate, type TemplateScope, type TemplateSummary } from '@/lib/clinical-docs';

type Filter = 'ALL' | TemplateScope;

export default function TemplatesPage() {
  const { t, formatDate } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ConsultationTemplate | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const canEdit = (tpl: TemplateSummary) => tpl.owner.id === user?.id || (tpl.scope === 'SHARED' && isAdmin);

  const load = useCallback(async () => {
    try {
      setList(sortTemplates(await api.getConsultationTemplates({ scope: 'ALL' }), user?.id));
      setError('');
    } catch (err) {
      setError(messageOf(err, t('cdoc.tpl.loadFailed')));
      setList((l) => l ?? []);
    }
  }, [user?.id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const scoped = (list ?? []).filter((tpl) => (filter === 'ALL' ? true : filter === 'PERSONAL' ? tpl.owner.id === user?.id : tpl.scope === 'SHARED'));
    return filterTemplates(scoped, query);
  }, [list, filter, query, user?.id]);

  const edit = async (tpl: TemplateSummary) => {
    setBusyId(tpl.id);
    try {
      setEditing(await api.getConsultationTemplate(tpl.id));
    } catch (err) {
      toast.error(t('cdoc.actionFailed'), messageOf(err, ''));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (tpl: TemplateSummary) => {
    if (!window.confirm(t('cdoc.tpl.confirmDelete', { name: tpl.name }))) return;
    setBusyId(tpl.id);
    try {
      await api.deleteConsultationTemplate(tpl.id);
      toast.success(t('cdoc.tpl.deleted'), tpl.name);
      await load();
    } catch (err) {
      toast.error(t('cdoc.actionFailed'), messageOf(err, ''));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('cdoc.tpl.pageTitle')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('cdoc.tpl.pageSubtitle')}</p>
        </div>
        <button type="button" className={primaryBtn} onClick={() => setEditing('new')}>+ {t('cdoc.tpl.new')}</button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1" role="group" aria-label={t('cdoc.tpl.field.scope')}>
          {(['ALL', 'PERSONAL', 'SHARED'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f ? 'bg-brand text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              {t(`cdoc.tpl.filter.${f}`)}
            </button>
          ))}
        </div>
        <input className={`${inputClass} sm:max-w-sm`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('cdoc.tpl.search')} aria-label={t('cdoc.tpl.search')} />
        <span className="text-sm text-gray-500 dark:text-gray-400 sm:ml-auto">{shown.length}</span>
      </div>

      <ErrorBox message={error} />
      {list === null && !error && <p className="text-sm text-gray-500">{t('cdoc.tpl.loading')}</p>}
      {list && shown.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('cdoc.tpl.none')}</p>}

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((tpl) => (
          <li key={tpl.id} className={`${cardClass} p-4 flex flex-col gap-2`}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-gray-900 dark:text-white">{tpl.name}</h2>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${tpl.scope === 'SHARED' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200' : 'bg-lime-50 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200'}`}>
                {t(`cdoc.tpl.scope.${tpl.scope}`)}
              </span>
            </div>
            {tpl.description && <p className="text-sm text-gray-600 dark:text-gray-300">{tpl.description}</p>}
            <div className="flex flex-wrap gap-1">
              {tpl.specialty && <span className="px-2 py-0.5 rounded-md bg-canvas dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-200">{tpl.specialty}</span>}
              {tpl.diagnosisCodes.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-md bg-canvas dark:bg-gray-700 font-mono text-xs text-gray-700 dark:text-gray-200">{c}</span>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-auto">
              {t('cdoc.tpl.uses', { count: tpl.usageCount })} · {tpl.lastUsedAt ? t('cdoc.tpl.lastUsed', { date: formatDate(tpl.lastUsedAt) }) : t('cdoc.tpl.neverUsed')}
              {tpl.owner.id !== user?.id && ` · ${t('cdoc.tpl.by', { name: tpl.owner.name })}`}
            </p>
            {canEdit(tpl) && (
              <div className="flex gap-2">
                <button type="button" className={smallBtn} disabled={busyId === tpl.id} onClick={() => edit(tpl)}>{t('cdoc.tpl.edit')}</button>
                <button type="button" className={`${smallBtn} text-red-600 dark:text-red-400`} disabled={busyId === tpl.id} onClick={() => remove(tpl)}>{t('cdoc.tpl.delete')}</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {editing && (
        <TemplateFormDialog
          template={editing === 'new' ? null : editing}
          canShare={user?.role === 'DOCTOR' || isAdmin}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
