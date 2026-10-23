'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, type AdmissionStatus, type AdmissionsResponse, type Doctor, type Ward } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { AdmissionDialog, AdmissionStatusBadge, cardClass, useDaysLabel, usePolling } from '@/components/inpatient';

const PAGE_SIZE = 20;

export default function AdmissionsPage() {
  const { t, formatDate, formatDateTime } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const daysLabel = useDaysLabel();
  const canAdmit = user?.role === 'ADMIN' || user?.role === 'DOCTOR' || user?.role === 'RECEPTIONIST';

  const [status, setStatus] = useState<AdmissionStatus>('ADMITTED');
  const [wardId, setWardId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdmissionsResponse | null>(null);
  const [error, setError] = useState('');
  const [wards, setWards] = useState<Ward[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [admitting, setAdmitting] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    api.getWards().then((b) => setWards(b.wards)).catch(() => setWards([]));
    api.getDoctors({ limit: 100 }).then((r) => setDoctors(r.data)).catch(() => setDoctors([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await api.getAdmissions({
        status,
        ...(wardId ? { wardId } : {}),
        ...(doctorId ? { doctorId } : {}),
        ...(debounced ? { search: debounced } : {}),
        page,
        limit: PAGE_SIZE,
      });
      if (mine !== seq.current) return;
      setData(res);
      setError('');
    } catch (err) {
      if (mine !== seq.current) return;
      setError(err instanceof Error && err.message ? err.message : t('inp.loadFailed'));
    }
  }, [status, wardId, doctorId, debounced, page, t]);

  usePolling(load, null);

  const filterChange = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('inp.list.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('inp.list.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/wards" className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
            {t('inp.list.bedBoard')}
          </Link>
          {canAdmit && (
            <button type="button" onClick={() => setAdmitting(true)} className="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white rounded-lg text-sm">
              + {t('inp.list.admit')}
            </button>
          )}
        </div>
      </div>

      <div className={`${cardClass} p-4 flex flex-col lg:flex-row gap-3`}>
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden shrink-0" role="group">
          {(['ADMITTED', 'DISCHARGED', 'CANCELLED'] as AdmissionStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => filterChange(() => setStatus(s))}
              className={`px-3 py-2 text-sm ${status === s ? 'bg-lime-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              {t(`inp.list.filter.${s}`)}
            </button>
          ))}
        </div>
        <input
          aria-label={t('inp.list.search')}
          value={search}
          onChange={(e) => filterChange(() => setSearch(e.target.value))}
          placeholder={t('inp.list.search')}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <select aria-label={t('inp.ward')} value={wardId} onChange={(e) => filterChange(() => setWardId(e.target.value))} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="">{t('inp.list.allWards')}</option>
          {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select aria-label={t('inp.attendingDoctor')} value={doctorId} onChange={(e) => filterChange(() => setDoctorId(e.target.value))} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="">{t('inp.list.allDoctors')}</option>
          {user?.role === 'DOCTOR' && user.doctorId && <option value={user.doctorId}>{t('inp.list.myPatients')}</option>}
          {doctors.map((d) => <option key={d.id} value={d.id}>Dr {d.firstName} {d.lastName}</option>)}
        </select>
      </div>

      {error && <div className="p-3 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">{t('inp.patient')}</th>
              <th className="px-4 py-3">{t('inp.list.wardBed')}</th>
              <th className="px-4 py-3">{t('inp.attendingDoctor')}</th>
              <th className="px-4 py-3">{status === 'ADMITTED' ? t('inp.list.since') : t('inp.list.dates')}</th>
              <th className="px-4 py-3">{t('inp.list.stay')}</th>
              <th className="px-4 py-3">{status === 'ADMITTED' ? t('inp.list.dueDoses') : t('inp.list.outcome')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {data === null && !error && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</td></tr>
            )}
            {data && data.admissions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t('inp.list.empty')}</td></tr>
            )}
            {data?.admissions.map((a) => (
              <tr key={a.id} onClick={() => router.push(`/dashboard/admissions/${a.id}`)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/admissions/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-gray-900 dark:text-white hover:underline">
                    {a.patient.firstName} {a.patient.lastName}
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {a.patient.patientId} · {a.number}
                    {a.patient.allergies.length > 0 && <span className="ml-1 text-red-600 dark:text-red-400">· {t('inp.allergyShort')}</span>}
                  </p>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {a.ward.name}
                  {a.bed && <span className="block text-xs text-gray-500 dark:text-gray-400">{t('inp.bedLabel', { label: a.bed.label })}</span>}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Dr {a.attendingDoctor.name.replace(/^Dr\.?\s*/i, '')}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {status === 'ADMITTED'
                    ? formatDateTime(a.admittedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : `${formatDate(a.admittedAt, { day: 'numeric', month: 'short' })} → ${a.dischargedAt ? formatDate(a.dischargedAt, { day: 'numeric', month: 'short' }) : '—'}`}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 tabular-nums">{daysLabel(a.days)}</td>
                <td className="px-4 py-3">
                  {status === 'ADMITTED' ? (
                    a.dueMedications > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{t('inp.list.dueCount', { count: a.dueMedications })}</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )
                  ) : a.status === 'DISCHARGED' && a.dischargeType ? (
                    <span className="text-xs text-gray-700 dark:text-gray-300">{t(`inp.dischargeType.${a.dischargeType}`)}</span>
                  ) : (
                    <AdmissionStatusBadge status={a.status} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{t('inp.list.page', { page: data.pagination.page, pages: data.pagination.totalPages })}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50">{t('inp.list.previous')}</button>
            <button type="button" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50">{t('inp.list.next')}</button>
          </div>
        </div>
      )}

      {admitting && (
        <AdmissionDialog
          onClose={() => setAdmitting(false)}
          onAdmitted={(admission) => {
            setAdmitting(false);
            toast.success(t('inp.admit.done', { number: admission.number }));
            router.push(`/dashboard/admissions/${admission.id}`);
          }}
        />
      )}
    </div>
  );
}
