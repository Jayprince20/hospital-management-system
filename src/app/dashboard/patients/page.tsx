'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, Patient, PatientsResponse } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-modal';
import { useLanguage } from '@/context/language-context';
import { LoadingSpinner, NoResults } from '@/components/ui';
import { PermissionGate } from '@/components/permission-gate';
import { toLocalDateString } from '@/lib/formatters';

export default function PatientsPage() {
  const { t, tEnum, formatDate: formatLocaleDate } = useLanguage();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, newThisMonth: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Pick up a query handed over by the header search (?search=...)
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('search');
    if (initial) setSearchQuery(initial);
  }, []);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemsPerPage = 10;

  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const fetchPatients = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response: PatientsResponse = await api.getPatients({
        search: debouncedSearch || undefined,
        status: statusFilter !== 'all' ? (statusFilter as 'active' | 'inactive') : undefined,
        gender: genderFilter !== 'all' ? (genderFilter as 'MALE' | 'FEMALE' | 'OTHER') : undefined,
        page: currentPage,
        limit: itemsPerPage,
      });

      setPatients(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
      setStats(response.stats);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError(err instanceof Error ? err.message : t('patientsPage.errFetch'));
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, genderFilter, currentPage]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const handleSelectAll = () => {
    if (selectedPatients.length === patients.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(patients.map((p) => p.id));
    }
  };

  const handleSelectPatient = (id: string) => {
    setSelectedPatients((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleDelete = async (id: string, patientName: string) => {
    const confirmed = await confirm({
      title: t('patientsPage.deleteTitle'),
      message: t('patientsPage.deleteMessage', { name: patientName }),
      confirmText: t('common.delete'),
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await api.deletePatient(id);
      toast.success(t('patientsPage.deletedTitle'), t('patientsPage.deletedMessage', { name: patientName }));
      fetchPatients();
      setSelectedPatients((prev) => prev.filter((p) => p !== id));
    } catch (err) {
      toast.error(t('patientsPage.deleteFailed'), err instanceof Error ? err.message : t('patientsPage.deleteFailedOne'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPatients.length === 0) return;

    const confirmed = await confirm({
      title: t('patientsPage.bulkDeleteTitle'),
      message: t('patientsPage.bulkDeleteMessage', { count: selectedPatients.length }),
      confirmText: t('patientsPage.bulkDeleteConfirm', { count: selectedPatients.length }),
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      let deleted = 0;
      let failed = 0;

      for (const id of selectedPatients) {
        try {
          await api.deletePatient(id);
          deleted++;
        } catch {
          failed++;
        }
      }

      if (deleted > 0) {
        toast.success(t('patientsPage.bulkDeletedTitle'), t('patientsPage.bulkDeletedMessage', { count: deleted }));
      }
      if (failed > 0) {
        toast.warning(t('patientsPage.someFailedTitle'), t('patientsPage.someFailedMessage', { count: failed }));
      }

      setSelectedPatients([]);
      fetchPatients();
    } catch (err) {
      toast.error(t('patientsPage.deleteFailed'), err instanceof Error ? err.message : t('patientsPage.deleteFailedMany'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    if (selectedPatients.length === 0) {
      toast.warning(t('patientsPage.noSelectionTitle'), t('patientsPage.noSelectionMessage'));
      return;
    }

    // Get selected patient data
    const selectedData = patients.filter((p) => selectedPatients.includes(p.id));

    // Create CSV content
    const headers = [t('patientForm.patientId'), t('patientForm.firstName'), t('patientForm.lastName'), t('patientForm.emailShort'), t('patientForm.phone'), t('patientForm.gender'), t('patientForm.dob'), t('patientForm.bloodType'), t('common.status')];
    const csvContent = [
      headers.join(','),
      ...selectedData.map((p) =>
        [
          p.patientId,
          p.firstName,
          p.lastName,
          p.email,
          p.phoneNumber,
          tEnum(p.gender),
          p.dateOfBirth,
          p.bloodType ? tEnum(p.bloodType) : 'N/A',
          p.status,
        ].map((field) => `"${field}"`).join(',')
      ),
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `patients_export_${toLocalDateString()}.csv`;
    link.click();

    toast.success(t('patientsPage.exportTitle'), t('patientsPage.exportMessage', { count: selectedData.length }));
  };

  const formatDate = (dateString: string) => {
    return formatLocaleDate(dateString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('patients.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('patients.subtitle')}
          </p>
        </div>
        <PermissionGate permission="patients:create">
          <Link
            href="/dashboard/patients/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-lime-600 hover:bg-lime-700 text-white font-medium rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('patients.new')}
          </Link>
        </PermissionGate>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
        <div className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
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
                  placeholder={t('filter.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-lime-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-lime-500 focus:border-transparent"
              >
                <option value="all">{t('filter.allStatus')}</option>
                <option value="active">{t('common.active')}</option>
                <option value="inactive">{t('common.inactive')}</option>
              </select>

              <select
                value={genderFilter}
                onChange={(e) => {
                  setGenderFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-lime-500 focus:border-transparent"
              >
                <option value="all">{t('patients.allGender')}</option>
                <option value="MALE">{t('patients.male')}</option>
                <option value="FEMALE">{t('patients.female')}</option>
                <option value="OTHER">{t('patients.other')}</option>
              </select>
            </div>
          </div>

          {/* Selected actions */}
          {selectedPatients.length > 0 && (
            <div className="mt-4 flex items-center gap-4 p-3 bg-lime-50 dark:bg-lime-900/30 rounded-lg">
              <span className="text-sm text-lime-700 dark:text-lime-300">
                {t('patients.selected', { count: selectedPatients.length })}
              </span>
              <div className="flex gap-2">
                <PermissionGate permission="patients:view_all">
                  <button
                    onClick={handleExport}
                    className="px-3 py-1.5 text-xs font-medium text-lime-700 dark:text-lime-300 hover:bg-lime-100 dark:hover:bg-lime-900/50 rounded-lg transition-colors"
                  >
                    {t('patients.export')}
                  </button>
                </PermissionGate>
                <PermissionGate permission="patients:delete">
                  <button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? t('form.deleting') : t('common.delete')}
                  </button>
                </PermissionGate>
              </div>
              <button
                onClick={() => setSelectedPatients([])}
                className="ml-auto text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {t('patients.clearSelection')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={fetchPatients}
            className="mt-2 text-sm text-red-600 dark:text-red-300 underline"
          >
            {t('patientsPage.tryAgain')}
          </button>
        </div>
      )}

      {/* Patients Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedPatients.length === patients.length && patients.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.patient')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('patients.hospitalId')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('patients.contact')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('patients.ageGender')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('patients.bloodType')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.status')}
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <LoadingSpinner size="lg" label={t('patients.loading')} />
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <NoResults searchTerm={searchQuery} onClear={() => setSearchQuery('')} />
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedPatients.includes(patient.id)}
                        onChange={() => handleSelectPatient(patient.id)}
                        className="w-4 h-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
                      />
                    </td>
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
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        patient.status === 'Active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {tEnum(patient.status?.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/patients/${patient.id}`}
                          className="p-2 text-gray-500 hover:text-lime-600 dark:text-gray-400 dark:hover:text-lime-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title={t('table.view')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        <PermissionGate permission="patients:edit">
                          <Link
                            href={`/dashboard/patients/${patient.id}/edit`}
                            className="p-2 text-gray-500 hover:text-lime-600 dark:text-gray-400 dark:hover:text-lime-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title={t('common.edit')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                        </PermissionGate>
                        <PermissionGate permission="patients:delete">
                          <button
                            onClick={() => handleDelete(patient.id, `${patient.firstName} ${patient.lastName}`)}
                            disabled={isDeleting}
                            className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                            title={t('common.delete')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </PermissionGate>
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
                  {t('common.previous')}
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-lime-600 text-white'
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
                  {t('common.next')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('patients.total')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('patients.active')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.newThisMonth}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('patients.newThisMonth')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('patients.appointmentsToday')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
}
