'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { addDiagnosis, type DiagnosisEntry, type Icd10Code, type MdoAlert } from '@/lib/clinical-safety';
import { inputClass } from '@/components/inpatient/ui';

/** ICD-10 autocomplete: type a code or words, pick a code; free text can be added as an uncoded diagnosis */
export function DiagnosisPicker({ value, onChange }: { value: DiagnosisEntry[]; onChange: (next: DiagnosisEntry[]) => void }) {
  const { t } = useLanguage();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  // Results are kept with the query they answer; anything else on screen is still loading
  const [answer, setAnswer] = useState<{ q: string; codes: Icd10Code[]; failed: boolean } | null>(null);
  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      api
        .searchIcd10(q, 15)
        .then((codes) => mine === seq.current && setAnswer({ q, codes, failed: false }))
        .catch(() => mine === seq.current && setAnswer({ q, codes: [], failed: true }));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  const current = answer && answer.q === q ? answer : null;
  const results = q.length >= 2 ? current?.codes ?? [] : [];
  const searching = q.length >= 2 && !current;
  const failed = Boolean(current?.failed);

  const pick = (entry: DiagnosisEntry) => {
    onChange(addDiagnosis(value, entry));
    setQuery('');
    setOpen(false);
  };
  const addUncoded = () => query.trim() && pick({ label: query.trim(), code: null });

  // Options: the codes found, then "add as uncoded"
  const optionCount = results.length + (query.trim() ? 1 : 0);
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(optionCount - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active < results.length && results[active]) {
        const c = results[active];
        pick({ label: c.label, code: c.code, notifiable: c.notifiable });
      } else addUncoded();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const hasUncoded = value.some((d) => !d.code);

  return (
    <div>
      <label htmlFor={`${listId}-input`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('cs.dx.label')}</label>
      <div className="relative">
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open && query.trim().length >= 2}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={t('cs.dx.placeholder')}
          className={inputClass}
          autoComplete="off"
        />
        {open && query.trim().length >= 2 && (
          <ul id={`${listId}-list`} role="listbox" className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg text-sm">
            {searching && results.length === 0 && <li className="px-3 py-2 text-gray-500">{t('cs.dx.searching')}</li>}
            {!searching && failed && <li className="px-3 py-2 text-red-600">{t('cs.dx.searchFailed')}</li>}
            {!searching && !failed && results.length === 0 && <li className="px-3 py-2 text-gray-500">{t('cs.dx.noResult')}</li>}
            {results.map((c, i) => (
              <li
                key={c.code}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick({ label: c.label, code: c.code, notifiable: c.notifiable });
                }}
                onMouseEnter={() => setActive(i)}
                className={`px-3 py-2 cursor-pointer flex items-start gap-2 ${i === active ? 'bg-lime-50 dark:bg-lime-900/30' : ''}`}
              >
                <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-200 mt-0.5 w-14 shrink-0">{c.code}</span>
                <span className="flex-1 text-gray-900 dark:text-white">{c.label}</span>
                {c.notifiable && <MdoBadge />}
              </li>
            ))}
            {query.trim() && (
              <li
                role="option"
                aria-selected={active === results.length}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addUncoded();
                }}
                onMouseEnter={() => setActive(results.length)}
                className={`px-3 py-2 cursor-pointer border-t border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300 ${active === results.length ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
              >
                {t('cs.dx.addUncoded', { text: query.trim() })}
              </li>
            )}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {value.length === 0 && <span className="text-sm text-gray-500 dark:text-gray-400">{t('cs.dx.none')}</span>}
        {value.map((d) => (
          <span
            key={`${d.code ?? ''}|${d.label}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${d.code ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            {d.code ? <span className="font-mono text-xs font-semibold">{d.code}</span> : <span className="text-xs italic">{t('cs.dx.uncoded')}</span>}
            <span>{d.label}</span>
            {d.notifiable && <MdoBadge />}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== d))} className="hover:text-red-500" aria-label={t('cs.dx.remove', { label: d.label })}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      {hasUncoded && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t('cs.dx.uncodedHint')}</p>}
    </div>
  );
}

export function MdoBadge() {
  const { t } = useLanguage();
  return <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold uppercase tracking-wide">{t('cs.dx.mdo')}</span>;
}

/** Red banner after saving a consultation that recorded a notifiable disease */
export function MdoBanner({ alerts }: { alerts: MdoAlert[] }) {
  const { t } = useLanguage();
  if (alerts.length === 0) return null;
  return (
    <div role="alert" className="p-4 rounded-xl border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
      <p className="font-semibold">{t('cs.mdo.title')}</p>
      <p className="text-sm mt-1">{t('cs.mdo.text', { diseases: alerts.map((a) => `${a.label} (${a.code})`).join(', ') })}</p>
    </div>
  );
}
