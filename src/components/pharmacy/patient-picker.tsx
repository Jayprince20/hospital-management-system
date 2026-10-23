'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { inputClass } from './ui';

export interface PickedPatient {
  id: string;
  patientId: string;
  name: string;
  phone?: string | null;
}

/** Search a registered patient by name or hospital number */
export function PatientPicker({ onPick, autoFocus = false }: { onPick: (p: PickedPatient) => void; autoFocus?: boolean }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickedPatient[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .getPatients({ search: q, limit: 6 })
        .then((res) => {
          if (mine !== seq.current) return;
          setResults(res.data.map((p) => ({ id: p.id, patientId: p.patientId, name: `${p.firstName} ${p.lastName}`, phone: p.phoneNumber })));
        })
        .catch(() => mine === seq.current && setResults([]))
        .finally(() => mine === seq.current && setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const visible = q.length >= 2 ? results : [];

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('pos.customer.searchPatient')}
        className={inputClass}
        autoFocus={autoFocus}
        aria-label={t('pos.customer.searchPatient')}
      />
      {q.length >= 2 && (
        <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {searching && visible.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">{t('pos.searching')}</li>}
          {!searching && visible.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">{t('pos.noResult')}</li>}
          {visible.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(p);
                  setQuery('');
                  setResults([]);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <span className="block text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{p.patientId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
