'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useDebounce } from '@/hooks/use-debounce';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export function GlobalSearch() {
  const router = useRouter();
  const { checkPermission } = useAuth();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loadedQuery, setLoadedQuery] = useState('');
  const [patients, setPatients] = useState<SearchResult[]>([]);
  const [doctors, setDoctors] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query.trim(), 250);

  const canSearchPatients = checkPermission('patients:view');
  const canSearchDoctors = checkPermission('doctors:view');
  const hasQuery = debouncedQuery.length >= 2;
  const shownPatients = hasQuery ? patients : [];
  const shownDoctors = hasQuery ? doctors : [];
  const results = [...shownPatients, ...shownDoctors];

  useEffect(() => {
    if (debouncedQuery.length < 2) return;

    let cancelled = false;

    Promise.all([
      canSearchPatients
        ? api.getPatients({ search: debouncedQuery, limit: 5 }).then((r) => r.data).catch(() => [])
        : Promise.resolve([]),
      canSearchDoctors
        ? api.getDoctors({ search: debouncedQuery, limit: 5 }).then((r) => r.data).catch(() => [])
        : Promise.resolve([]),
    ]).then(([patientData, doctorData]) => {
      if (cancelled) return;
      setPatients(
        patientData.map((p) => ({
          id: p.id,
          title: `${p.firstName} ${p.lastName}`,
          subtitle: [p.patientId, p.phoneNumber].filter(Boolean).join(' • '),
          href: `/dashboard/patients/${p.id}`,
        }))
      );
      setDoctors(
        doctorData.map((d) => ({
          id: d.id,
          title: `Dr. ${d.firstName} ${d.lastName}`,
          subtitle: d.department || '',
          href: `/dashboard/doctors/${d.id}`,
        }))
      );
      setActiveIndex(-1);
      setLoadedQuery(debouncedQuery);
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, canSearchPatients, canSearchDoctors]);

  // Close when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        go(results[activeIndex].href);
      } else if (results.length === 1) {
        go(results[0].href);
      } else if (query.trim() && canSearchPatients) {
        go(`/dashboard/patients?search=${encodeURIComponent(query.trim())}`);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const renderGroup = (label: string, items: SearchResult[], offset: number) =>
    items.length > 0 && (
      <div className="py-1">
        <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </p>
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(item.href)}
            className={`w-full text-left px-4 py-2 flex flex-col hover:bg-lime-50 dark:hover:bg-gray-700 ${
              activeIndex === offset + i ? 'bg-lime-50 dark:bg-gray-700' : ''
            }`}
          >
            <span className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</span>
            {item.subtitle && <span className="text-xs text-gray-500 dark:text-gray-400">{item.subtitle}</span>}
          </button>
        ))}
      </div>
    );

  const showPanel = open && debouncedQuery.length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-lime-500 focus:border-transparent text-sm"
      />

      {showPanel && (
        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto z-50">
          {loadedQuery !== debouncedQuery && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{t('search.searching')}</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {t('search.noResults', { query: debouncedQuery })}
            </p>
          ) : (
            <>
              {renderGroup(t('search.patients'), shownPatients, 0)}
              {renderGroup(t('search.doctors'), shownDoctors, shownPatients.length)}
              {canSearchPatients && shownPatients.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(`/dashboard/patients?search=${encodeURIComponent(debouncedQuery)}`)}
                  className="w-full text-left px-4 py-2 text-sm text-lime-700 dark:text-lime-400 border-t border-gray-100 dark:border-gray-700 hover:bg-lime-50 dark:hover:bg-gray-700"
                >
                  {t('search.viewAllPatients')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
