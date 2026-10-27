'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import {
  filterTemplates,
  matchMedication,
  sortTemplates,
  type ConsultationTemplate,
  type TemplatePrescriptionLine,
  type TemplateScope,
  type TemplateSuggestions,
  type TemplateSummary,
} from '@/lib/clinical-docs';
import { DialogShell, ErrorBox, cancelBtn, cardClass, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from './ui';

function TemplatePreview({ template }: { template: ConsultationTemplate }) {
  const { t } = useLanguage();
  const block = (label: string, value: string | null | undefined) =>
    value ? (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400">{label}</p>
        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">{value}</p>
      </div>
    ) : null;
  return (
    <div className="space-y-3">
      {block(t('cdoc.tpl.field.chiefComplaint'), template.chiefComplaint)}
      {template.symptoms.length > 0 && block(t('cdoc.tpl.field.symptoms'), template.symptoms.join(', '))}
      {block(t('cdoc.tpl.field.examination'), template.examination)}
      {(template.diagnoses.length > 0 || template.diagnosis.length > 0) && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400">{t('cdoc.tpl.field.diagnoses')}</p>
          <ul className="text-sm text-gray-800 dark:text-gray-200">
            {template.diagnoses.map((d) => (
              <li key={d.code}><span className="font-mono text-xs text-gray-500">{d.code}</span> {d.label}</li>
            ))}
            {template.diagnosis.filter((l) => !template.diagnoses.some((d) => d.label === l)).map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
      )}
      {block(t('cdoc.tpl.field.treatmentPlan'), template.treatmentPlan)}
      {block(t('cdoc.tpl.field.notes'), template.notes)}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {[
          template.prescriptionLines.length ? t('cdoc.tpl.rxLines', { count: template.prescriptionLines.length }) : '',
          template.labTests.length ? t('cdoc.tpl.labTests', { count: template.labTests.length }) : '',
          template.followUpDays ? t('cdoc.tpl.followUpDays', { days: template.followUpDays }) : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  );
}

/** Searchable list of the doctor's and shared templates with a preview; "Apply" hands the template back */
export function TemplatePickerDialog({ onClose, onApply }: { onClose: () => void; onApply: (template: ConsultationTemplate) => void }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [list, setList] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<ConsultationTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getConsultationTemplates({ scope: 'ALL' })
      .then((data) => setList(sortTemplates(data, user?.id)))
      .catch((err) => {
        setError(messageOf(err, t('cdoc.tpl.loadFailed')));
        setList([]);
      });
  }, [user?.id, t]);

  useEffect(() => {
    if (!selected) return;
    let live = true;
    api
      .getConsultationTemplate(selected)
      .then((tpl) => live && setPreview(tpl))
      .catch((err) => live && setError(messageOf(err, t('cdoc.tpl.loadFailed'))));
    return () => {
      live = false;
    };
  }, [selected, t]);

  const shown = useMemo(() => filterTemplates(list ?? [], query), [list, query]);
  const current = preview && preview.id === selected ? preview : null;

  const apply = async (id = selected) => {
    if (!id || busy) return;
    setBusy(true);
    setError('');
    try {
      onApply(await api.useConsultationTemplate(id));
    } catch (err) {
      setError(messageOf(err, t('cdoc.actionFailed')));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={t('cdoc.tpl.pickerTitle')}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('cdoc.tpl.pickerTitle')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('cdoc.tpl.pickerHint')}</p>
          <input
            className={`${inputClass} mt-3`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('cdoc.tpl.search')}
            aria-label={t('cdoc.tpl.search')}
            autoFocus
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
        </div>
        <div className="flex-1 min-h-0 grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="min-h-0 overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 max-h-[35vh] md:max-h-none">
            {list === null && <p className="p-4 text-sm text-gray-500">{t('cdoc.tpl.loading')}</p>}
            {list && shown.length === 0 && <p className="p-4 text-sm text-gray-500 dark:text-gray-400">{t('cdoc.tpl.none')}</p>}
            <ul role="listbox" aria-label={t('cdoc.tpl.pickerTitle')}>
              {shown.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected === tpl.id}
                    onClick={() => setSelected(tpl.id)}
                    onDoubleClick={() => {
                      setSelected(tpl.id);
                      void apply(tpl.id);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700/60 ${selected === tpl.id ? 'bg-brand/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white truncate">{tpl.name}</span>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${tpl.scope === 'SHARED' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200' : 'bg-lime-50 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200'}`}>
                        {t(`cdoc.tpl.scope.${tpl.scope}`)}
                      </span>
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                      {[tpl.specialty, tpl.diagnosisCodes.join(', '), t('cdoc.tpl.uses', { count: tpl.usageCount })].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-h-0 overflow-y-auto p-5">
            <ErrorBox message={error} />
            {!selected && <p className="text-sm text-gray-500 dark:text-gray-400">{t('cdoc.tpl.selectToPreview')}</p>}
            {selected && !current && !error && <p className="text-sm text-gray-500">{t('cdoc.loading')}</p>}
            {current && (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {current.description ? `${current.description} · ` : ''}
                  {t('cdoc.tpl.by', { name: current.owner.name })}
                </p>
                <TemplatePreview template={current} />
              </>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button type="button" className={cancelBtn} onClick={onClose}>{t('cdoc.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={() => apply()} disabled={!selected || busy}>{t('cdoc.tpl.apply')}</button>
        </div>
      </div>
    </div>
  );
}

export interface SuggestedRxItem {
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

/**
 * Orders a template proposes: checkboxes the doctor confirms. Lines whose medicine is not in the
 * formulary are shown but cannot be added (they must be prescribed by hand).
 */
export function TemplateSuggestionsPanel({
  templateName,
  suggestions,
  medications,
  onAdd,
  onDismiss,
}: {
  templateName: string;
  suggestions: TemplateSuggestions;
  medications: Array<{ id: string; name: string }>;
  onAdd: (rx: SuggestedRxItem[], lab: Array<{ id: string; name: string }>) => void;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  const lines = useMemo(
    () => suggestions.prescriptionLines.map((line: TemplatePrescriptionLine) => ({ line, med: matchMedication(line.medicationName, medications) })),
    [suggestions.prescriptionLines, medications]
  );
  const [rxChecked, setRxChecked] = useState<boolean[]>(() => lines.map((l) => Boolean(l.med)));
  const [labChecked, setLabChecked] = useState<boolean[]>(() => suggestions.labTests.map(() => true));

  const add = () => {
    const rx: SuggestedRxItem[] = lines
      .filter((l, i) => rxChecked[i] && l.med)
      .map(({ line, med }) => ({
        medicationId: med!.id,
        medicationName: med!.name,
        dosage: line.dosage ?? '',
        frequency: line.frequency ?? '',
        duration: line.duration ?? '',
        instructions: [line.route, line.instructions].filter(Boolean).join(' — '),
      }));
    const lab = suggestions.labTests.filter((_, i) => labChecked[i]).map((x) => ({ id: x.id, name: x.name }));
    onAdd(rx, lab);
  };

  const nothing = lines.length === 0 && suggestions.labTests.length === 0;
  if (nothing) return null;

  return (
    <section className={`${cardClass} p-4 border-brand/30 bg-brand/5`} aria-label={t('cdoc.sugg.title', { name: templateName })}>
      <h3 className="font-semibold text-gray-900 dark:text-white">{t('cdoc.sugg.title', { name: templateName })}</h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{t('cdoc.sugg.hint')}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {lines.length > 0 && (
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400 mb-1">{t('cdoc.sugg.rx')}</legend>
            <ul className="space-y-1.5">
              {lines.map(({ line, med }, i) => (
                <li key={i}>
                  <label className={`flex items-start gap-2 text-sm ${med ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-gray-300"
                      checked={rxChecked[i] && Boolean(med)}
                      disabled={!med}
                      onChange={(e) => setRxChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                    />
                    <span>
                      <span className="font-medium">{med?.name ?? line.medicationName}</span> — {[line.dosage, line.frequency, line.duration].filter(Boolean).join(', ')}
                      {!med && <span className="block text-xs text-amber-700 dark:text-amber-300">{t('cdoc.sugg.notInFormulary')}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        {suggestions.labTests.length > 0 && (
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400 mb-1">{t('cdoc.sugg.lab')}</legend>
            <ul className="space-y-1.5">
              {suggestions.labTests.map((test, i) => (
                <li key={test.id}>
                  <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                    <input type="checkbox" className="rounded border-gray-300" checked={labChecked[i]} onChange={(e) => setLabChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} />
                    {test.name} <span className="text-xs text-gray-500">({test.code})</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className={smallBtn} onClick={onDismiss}>{t('cdoc.sugg.dismiss')}</button>
        <button type="button" className={primaryBtn} onClick={add} disabled={!rxChecked.some((c, i) => c && lines[i]?.med) && !labChecked.some(Boolean)}>
          {t('cdoc.sugg.add')}
        </button>
      </div>
    </section>
  );
}

/** Copy a saved consultation into a new template */
export function SaveAsTemplateDialog({ consultationId, onClose }: { consultationId: string; onClose: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<TemplateScope>('PERSONAL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!name.trim()) {
      setError(t('cdoc.tpl.nameRequired'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const tpl = await api.templateFromConsultation(consultationId, { name: name.trim(), scope });
      toast.success(t('cdoc.tpl.saved'), tpl.name);
      onClose();
    } catch (err) {
      setError(messageOf(err, t('cdoc.actionFailed')));
      setBusy(false);
    }
  };
  return (
    <DialogShell
      title={t('cdoc.tpl.saveAsTitle')}
      subtitle={t('cdoc.tpl.saveAsHint')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cancelBtn} onClick={onClose}>{t('cdoc.cancel')}</button>
          <button type="button" className={primaryBtn} onClick={save} disabled={busy || !name.trim()}>{t('cdoc.save')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <label className="block">
        <span className={labelClass}>{t('cdoc.tpl.field.name')}</span>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <fieldset>
        <legend className={labelClass}>{t('cdoc.tpl.field.scope')}</legend>
        {(['PERSONAL', 'SHARED'] as const).map((s) => (
          <label key={s} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 mb-1">
            <input type="radio" name="tpl-scope" checked={scope === s} onChange={() => setScope(s)} className="mt-0.5" />
            <span>
              {t(`cdoc.tpl.scope.${s}`)} <span className="text-xs text-gray-500">— {t(`cdoc.tpl.scopeHint.${s}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </DialogShell>
  );
}
