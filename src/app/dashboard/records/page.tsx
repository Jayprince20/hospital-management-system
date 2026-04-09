'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, Consultation } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { useLanguage } from '@/context/language-context';
import { ListSkeleton, ErrorState, NoResults, SimplePagination } from '@/components/ui';
import { formatDate } from '@/lib/formatters';

export default function MedicalRecordsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [stats, setStats] = useState({ total: 0, today: 0, thisWeek: 0, uniqueDoctors: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // If user is a doctor, filter to only their patients' records
  const isDoctor = user?.role === 'DOCTOR';
  const doctorId = isDoctor ? user?.doctorId : undefined;

  const fetchConsultations = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await api.getConsultations({
        search: debouncedSearch || undefined,
        doctorId, // Filter by doctor if user is a doctor
        page,
        limit: 10,
      });
      setConsultations(response.consultations);
      setStats(response.stats);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching consultations:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch consultations');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, doctorId, page]);

  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('records.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('records.subtitle')}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-lime-600">{stats.total}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('records.total')}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-green-600">{stats.today}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('records.today')}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-blue-600">{stats.thisWeek}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('records.thisWeek')}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-purple-600">{stats.uniqueDoctors}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('records.activeDoctors')}</p>
        </div>
      </div>

      {/* Records List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        {/* Search */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filter.searchPlaceholder')}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
          />
        </div>

        {/* Content */}
        <div className="p-4">
          {fetchError ? (
            <ErrorState message={fetchError} onRetry={fetchConsultations} />
          ) : loading ? (
            <ListSkeleton items={5} showAvatar={false} />
          ) : consultations.length === 0 ? (
            <NoResults searchTerm={search} onClear={() => setSearch('')} />
          ) : (
            <div className="space-y-4">
              {consultations.map((consultation) => (
                <Link
                  key={consultation.id}
                  href={`/dashboard/records/${consultation.id}`}
                  className="block p-4 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{consultation.patientName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{consultation.patientHospitalId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatDate(consultation.appointmentDate)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{consultation.appointmentType}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{t('records.chiefComplaint')}:</span> {consultation.chiefComplaint}
                    </p>
                  </div>

                  {consultation.diagnosis.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('records.diagnosis')}</p>
                      <div className="flex flex-wrap gap-1">
                        {consultation.diagnosis.map((d, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400 rounded text-xs"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {consultation.doctorName} - {consultation.department}
                    </span>
                    <div className="flex items-center gap-3">
                      {consultation.prescriptionCount > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {consultation.prescriptionCount} Rx
                        </span>
                      )}
                      {consultation.labOrderCount > 0 && (
                        <span className="flex items-center gap-1 text-purple-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                          {consultation.labOrderCount} Labs
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        <SimplePagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          className="px-4 py-3 border-t border-gray-100 dark:border-gray-700"
        />
      </div>
    </div>
  );
}
