'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type MedicalDocumentStatus, type MedicalDocumentType, type MedicalDocumentsResponse } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { DOCUMENT_TYPES } from '@/lib/medical-documents';
import { DocumentTable, NewDocumentDialog } from '@/components/documents';
import { ErrorBox, cardClass, inputClass, primaryBtn } from '@/components/documents/ui';

const PAGE_SIZE = 25;

export default function MedicalDocumentsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const canIssue = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const [type, setType] = useState<MedicalDocumentType | ''>('');
  const [status, setStatus] = useState<MedicalDocumentStatus | ''>('');
  const [doctorId, setDoctorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [result, setResult] = useState<MedicalDocumentsResponse | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .getDoctors({ limit: 100 })
      .then((res) => live && setDoctors(res.data.map((d) => ({ id: d.id, name: `Dr ${d.firstName} ${d.lastName}` }))))
      .catch(() => live && setDoctors([]));
    return () => {
      live = false;
    };
  }, []);

  // Search waits for the typing to stop
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(() => {
    api
      .getMedicalDocuments({
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(doctorId ? { doctorId } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(query ? { search: query } : {}),
        page,
        limit: PAGE_SIZE,
      })
      .then((res) => {
        setResult(res);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('mdoc.loadFailed')));
  }, [type, status, doctorId, from, to, query, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const totalPages = result?.pagination.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('mdoc.page.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('mdoc.page.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {user?.role !== 'NURSE' && (
            <Link href="/dashboard/referrals" className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">{t('mdoc.page.referrals')}</Link>
          )}
          {canIssue && (
            <button type="button" onClick={() => setCreating(true)} className={`${primaryBtn} text-sm`}>{t('mdoc.new.button')}</button>
          )}
        </div>
      </div>

      <div className={`${cardClass} p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3`}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('mdoc.filter.search')}
          aria-label={t('mdoc.filter.search')}
          className={`${inputClass} lg:col-span-2`}
        />
        <select aria-label={t('mdoc.filter.type')} value={type} onChange={(e) => resetPage(setType)(e.target.value as MedicalDocumentType | '')} className={inputClass}>
          <option value="">{t('mdoc.filter.allTypes')}</option>
          {DOCUMENT_TYPES.map((v) => (
            <option key={v} value={v}>{t(`mdoc.type.${v}`)}</option>
          ))}
        </select>
        <select aria-label={t('mdoc.filter.status')} value={status} onChange={(e) => resetPage(setStatus)(e.target.value as MedicalDocumentStatus | '')} className={inputClass}>
          <option value="">{t('mdoc.filter.allStatuses')}</option>
          <option value="ISSUED">{t('mdoc.status.ISSUED')}</option>
          <option value="REVOKED">{t('mdoc.status.REVOKED')}</option>
        </select>
        <select aria-label={t('mdoc.filter.doctor')} value={doctorId} onChange={(e) => resetPage(setDoctorId)(e.target.value)} className={inputClass}>
          <option value="">{t('mdoc.filter.allDoctors')}</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <div className="flex gap-2 lg:col-span-1">
          <input type="date" aria-label={t('mdoc.filter.from')} value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} className={inputClass} />
          <input type="date" aria-label={t('mdoc.filter.to')} value={to} onChange={(e) => resetPage(setTo)(e.target.value)} className={inputClass} />
        </div>
      </div>

      <ErrorBox message={error} />

      <div className={cardClass}>
        {result === null && !error ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('mdoc.loading')}</p>
        ) : (
          result && <DocumentTable documents={result.documents} onChanged={load} />
        )}
        {result && totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-gray-700 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 text-gray-700 dark:text-gray-300">{t('mdoc.prev')}</button>
            <span className="text-gray-600 dark:text-gray-300">{t('mdoc.pageOf', { page, total: totalPages })}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 text-gray-700 dark:text-gray-300">{t('mdoc.next')}</button>
          </div>
        )}
      </div>

      {creating && (
        <NewDocumentDialog
          onClose={() => setCreating(false)}
          onIssued={() => {
            setPage(1);
            load();
          }}
        />
      )}
    </div>
  );
}
