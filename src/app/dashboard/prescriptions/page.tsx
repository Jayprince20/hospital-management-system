'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, Prescription } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { useLanguage } from '@/context/language-context';
import { ListSkeleton, ErrorState, NoResults, SimplePagination } from '@/components/ui';
import { PermissionGate } from '@/components/permission-gate';

type PrescriptionStatus = 'ACTIVE' | 'DISPENSED' | 'PARTIALLY_DISPENSED' | 'CANCELLED' | 'EXPIRED';

export default function PrescriptionsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<PrescriptionStatus | ''>('');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // If user is a doctor, the backend will automatically filter to their prescriptions
  const isDoctor = user?.role === 'DOCTOR';

  const fetchPrescriptions = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await api.getPrescriptions({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        page,
        limit: 10,
      });
      setPrescriptions(response.prescriptions);
      setStatusCounts(response.statusCounts);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to fetch prescriptions');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400';
      case 'DISPENSED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400';
      case 'PARTIALLY_DISPENSED':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate stats
  const totalPrescriptions = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const activePrescriptions = statusCounts['ACTIVE'] || 0;
  const dispensedToday = statusCounts['DISPENSED'] || 0;
  const pendingDispense = (statusCounts['ACTIVE'] || 0) + (statusCounts['PARTIALLY_DISPENSED'] || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isDoctor ? 'My Prescriptions' : 'Prescriptions'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isDoctor ? 'Manage prescriptions for your patients' : 'View and manage all prescriptions'}
          </p>
        </div>
        <PermissionGate permission="prescriptions:create">
          <Link
            href="/dashboard/prescriptions/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Prescription
          </Link>
        </PermissionGate>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-lime-600">{totalPrescriptions}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Prescriptions</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-blue-600">{activePrescriptions}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-green-600">{dispensedToday}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Dispensed</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-3xl font-bold text-orange-600">{pendingDispense}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending Dispense</p>
        </div>
      </div>

      {/* Prescriptions List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by patient name or ID..."
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PrescriptionStatus | '')}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISPENSED">Dispensed</option>
              <option value="PARTIALLY_DISPENSED">Partially Dispensed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {fetchError ? (
            <ErrorState message={fetchError} onRetry={fetchPrescriptions} />
          ) : loading ? (
            <ListSkeleton items={5} showAvatar={false} />
          ) : prescriptions.length === 0 ? (
            <NoResults searchTerm={search} onClear={() => setSearch('')} />
          ) : (
            <div className="space-y-4">
              {prescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  className="p-4 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {prescription.patientName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {prescription.patientHospitalId}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(prescription.status)}`}>
                        {prescription.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Prescribed by:</span> {prescription.doctorName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(prescription.createdAt)}
                    </p>
                  </div>

                  {/* Medications */}
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Medications</p>
                    <div className="flex flex-wrap gap-2">
                      {prescription.items.slice(0, 3).map((item) => (
                        <span
                          key={item.id}
                          className={`px-2 py-1 rounded text-xs ${
                            item.isDispensed
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          {item.medication} x{item.quantity}
                        </span>
                      ))}
                      {prescription.items.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400 rounded text-xs">
                          +{prescription.items.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {prescription.notes && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      <span className="font-medium">Notes:</span> {prescription.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {prescription.itemCount} medication{prescription.itemCount !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/prescriptions/${prescription.id}`}
                        className="px-3 py-1.5 text-sm text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/50 rounded-lg transition-colors"
                      >
                        View Details
                      </Link>
                      <PermissionGate permission="prescriptions:dispense">
                        {prescription.status === 'ACTIVE' && (
                          <Link
                            href={`/dashboard/pharmacy?prescription=${prescription.id}`}
                            className="px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          >
                            Dispense
                          </Link>
                        )}
                      </PermissionGate>
                    </div>
                  </div>
                </div>
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
