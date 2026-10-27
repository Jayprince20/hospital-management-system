'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, Patient } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { useLanguage } from '@/context/language-context';
import { LoadingSpinner, NoResults } from '@/components/ui';

export default function MyPatientsPage() {
  const { user } = useAuth();
  const { t, tEnum, formatDate } = useLanguage();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 10;

  const fetchMyPatients = useCallback(async () => {
    if (!user?.doctorId) {
      setError(t('myPatients.noDoctorProfile'));
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch patients for this doctor
      const response = await api.getDoctorPatients(user.doctorId, {
        search: debouncedSearch || undefined,
        page: currentPage,
        limit: itemsPerPage,
      });

      setPatients(response.data || []);
      setTotal(response.total || 0);
      setTotalPages(response.totalPages || 1);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError(err instanceof Error ? err.message : t('patientsPage.errFetch'));
    } finally {
      setIsLoading(false);
    }
  }, [user?.doctorId, debouncedSearch, currentPage]);

  useEffect(() => {
    fetchMyPatients();
  }, [fetchMyPatients]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('myPatients.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('myPatients.subtitle')}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
        <div className="p-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder={t('myPatients.searchPh')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-lime-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={fetchMyPatients}
            className="mt-2 text-sm text-red-600 dark:text-red-300 underline"
          >
            {t('myPatients.tryAgain')}
          </button>
        </div>
      )}

      {/* Patients Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('myPatients.colPatient')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('myPatients.colHospitalId')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('myPatients.colContact')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('myPatients.colAgeGender')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('myPatients.colBloodType')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('myPatients.colLastVisit')}
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('myPatients.colActions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <LoadingSpinner size="lg" label="Loading your patients..." />
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <NoResults
                      searchTerm={searchQuery}
                      onClear={() => setSearchQuery('')}
                    />
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-medium text-sm">
                            {patient.firstName[0]}{patient.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <Link
                            href={`/dashboard/patients/${patient.id}`}
                            className="text-sm font-medium text-gray-900 dark:text-white hover:text-lime-600 dark:hover:text-lime-400"
                          >
                            {patient.firstName} {patient.lastName}
                          </Link>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{patient.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                        {patient.patientId}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {patient.phoneNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {t('unit.years', { count: calculateAge(patient.dateOfBirth) })}
                        </span>
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-medium ${
                          patient.gender === 'MALE'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : patient.gender === 'FEMALE'
                            ? 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {tEnum(patient.gender).charAt(0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                        {patient.bloodType ? tEnum(patient.bloodType) : t('patientsPage.na')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {patient.createdAt ? formatDate(patient.createdAt) : t('patientsPage.na')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/patients/${patient.id}`}
                          className="p-2 text-gray-500 hover:text-lime-600 dark:text-gray-400 dark:hover:text-lime-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title={t('myPatients.viewPatient')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        <Link
                          href={`/dashboard/appointments/new?patientId=${patient.id}`}
                          className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title={t('myPatients.schedule')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </Link>
                        <Link
                          href={`/dashboard/records?patientId=${patient.id}`}
                          className="p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title={t('myPatients.viewRecords')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && patients.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('table.showing')} <span className="font-medium text-gray-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> {t('table.to')}{' '}
                <span className="font-medium text-gray-900 dark:text-white">
                  {Math.min(currentPage * itemsPerPage, total)}
                </span>{' '}
                {t('table.ofTotal')} <span className="font-medium text-gray-900 dark:text-white">{total}</span> {t('patients.title').toLowerCase()}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('myPatients.previous')}
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-brand text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('myPatients.next')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Card */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-lime-100 dark:bg-lime-900/50 flex items-center justify-center">
            <svg className="w-5 h-5 text-lime-600 dark:text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('myPatients.totalPatients')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
