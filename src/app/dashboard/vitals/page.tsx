'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, VitalSign, Patient } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/components/toast';
import { useAuth } from '@/context/auth-context';
import { PermissionGate } from '@/components/permission-gate';
import { TableSkeleton } from '@/components/ui';
import { useLanguage } from '@/context/language-context';
import { VitalFlagBadges, bpValueClass, vitalValueClass } from '@/components/clinical-safety/vitals';
import { isCriticalFlag } from '@/lib/clinical-safety';

interface VitalsFormData {
  patientId: string;
  bloodPressureSys: string;
  bloodPressureDia: string;
  heartRate: string;
  temperature: string;
  respiratoryRate: string;
  oxygenSaturation: string;
  weight: string;
  height: string;
  notes: string;
}

const initialFormData: VitalsFormData = {
  patientId: '',
  bloodPressureSys: '',
  bloodPressureDia: '',
  heartRate: '',
  temperature: '',
  respiratoryRate: '',
  oxygenSaturation: '',
  weight: '',
  height: '',
  notes: '',
};

export default function VitalsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t, formatDateTime } = useLanguage();

  // Data state
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState({ patients: 0, today: 0, thisWeek: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVitals, setTotalVitals] = useState(0);
  const itemsPerPage = 10;

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedVital, setSelectedVital] = useState<VitalSign | null>(null);
  const [formData, setFormData] = useState<VitalsFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  // Patient search for modal
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const debouncedPatientSearch = useDebounce(patientSearch, 300);

  const getDateRange = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (dateFilter) {
      case 'today': {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { startDate: today.toISOString(), endDate: tomorrow.toISOString() };
      }
      case 'week': {
        // Calendar week starting on Monday, up to now
        const startOfWeek = new Date(today);
        startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
        return { startDate: startOfWeek.toISOString() };
      }
      case 'month': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: startOfMonth.toISOString() };
      }
      default:
        return {};
    }
  }, [dateFilter]);

  const fetchVitals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const dateRange = getDateRange();
      const response = await api.getVitals({
        patientId: patientFilter || undefined,
        ...dateRange,
        page: currentPage,
        limit: itemsPerPage,
      });

      let filteredVitals = response.vitals;

      // Client-side search filter (since API might not support text search)
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        filteredVitals = filteredVitals.filter(v =>
          v.patientName?.toLowerCase().includes(searchLower)
        );
      }

      setVitals(filteredVitals);
      setTotalPages(response.pagination.totalPages);
      setTotalVitals(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clinical.vitals.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [patientFilter, currentPage, debouncedSearch, getDateRange, t]);

  const fetchPatients = useCallback(async () => {
    try {
      const response = await api.getPatients({ limit: 100 });
      setPatients(response.data);
      setStats(prev => ({ ...prev, patients: response.total }));
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    }
  }, []);

  // Stats come from the API totals, not from the current page of results
  const fetchStats = useCallback(async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      const [todayRes, weekRes] = await Promise.all([
        api.getVitals({ startDate: todayStart.toISOString(), limit: 1 }),
        api.getVitals({ startDate: weekStart.toISOString(), limit: 1 }),
      ]);
      setStats(prev => ({ ...prev, today: todayRes.pagination.total, thisWeek: weekRes.pagination.total }));
    } catch (err) {
      console.error('Failed to fetch vitals stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchVitals();
  }, [fetchVitals]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, patientFilter, dateFilter]);

  // Search patients for modal
  useEffect(() => {
    const searchPatients = async () => {
      if (!debouncedPatientSearch || debouncedPatientSearch.length < 2) {
        setPatientSearchResults([]);
        return;
      }

      try {
        setSearchingPatients(true);
        const response = await api.getPatients({ search: debouncedPatientSearch, limit: 10 });
        setPatientSearchResults(response.data);
      } catch (err) {
        console.error('Failed to search patients:', err);
      } finally {
        setSearchingPatients(false);
      }
    };

    searchPatients();
  }, [debouncedPatientSearch]);

  const handleAddVitals = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatient) {
      toast.error(t('clinical.vitals.patientRequired'), t('clinical.vitals.selectPatient'));
      return;
    }

    try {
      setSubmitting(true);

      const created = await api.createVitals({
        patientId: selectedPatient.id,
        bloodPressureSys: formData.bloodPressureSys ? parseInt(formData.bloodPressureSys) : undefined,
        bloodPressureDia: formData.bloodPressureDia ? parseInt(formData.bloodPressureDia) : undefined,
        heartRate: formData.heartRate ? parseInt(formData.heartRate) : undefined,
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        respiratoryRate: formData.respiratoryRate ? parseInt(formData.respiratoryRate) : undefined,
        oxygenSaturation: formData.oxygenSaturation ? parseInt(formData.oxygenSaturation) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        notes: formData.notes || undefined,
        recordedBy: user?.id || '',
      });

      toast.success(t('clinical.vitals.recorded'), t('clinical.vitals.recordedMessage', { name: `${selectedPatient.firstName} ${selectedPatient.lastName}` }));
      const critical = (created.flags ?? []).filter(isCriticalFlag);
      if (critical.length) toast.warning(t('cs.vitals.critical'), critical.map((f) => f.message).join(' · '));
      setShowAddModal(false);
      resetForm();
      fetchVitals();
      fetchStats();
    } catch (err) {
      toast.error(t('clinical.vitals.recordFailed'), err instanceof Error ? err.message : t('clinical.common.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setSelectedPatient(null);
    setPatientSearch('');
    setPatientSearchResults([]);
  };

  const openViewModal = (vital: VitalSign) => {
    setSelectedVital(vital);
    setShowViewModal(true);
  };

  const formatDate = (dateString: string) => formatDateTime(dateString);

  const calculateBMI = (weight: number | null, height: number | null) => {
    if (!weight || !height || height === 0) return null;
    const heightInMeters = height / 100;
    return (weight / (heightInMeters * heightInMeters)).toFixed(1);
  };

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { label: t('clinical.vitals.bmi.underweight'), color: 'text-blue-600' };
    if (bmi < 25) return { label: t('clinical.vitals.bmi.normal'), color: 'text-green-600' };
    if (bmi < 30) return { label: t('clinical.vitals.bmi.overweight'), color: 'text-yellow-600' };
    return { label: t('clinical.vitals.bmi.obese'), color: 'text-red-600' };
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('nav.vitals')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('clinical.vitals.subtitle')}</p>
        </div>
        <PermissionGate permission="patients:record_vitals">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('clinical.vitals.record')}
          </button>
        </PermissionGate>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('clinical.vitals.totalRecords')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalVitals}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('clinical.vitals.patients')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.patients}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('clinical.vitals.todaysRecords')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.today}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('clinical.common.thisWeek')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.thisWeek}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={t('clinical.vitals.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
              />
            </div>
          </div>

          <select
            value={patientFilter}
            onChange={(e) => setPatientFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
          >
            <option value="">{t('clinical.vitals.allPatients')}</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.firstName} {patient.lastName}
              </option>
            ))}
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as 'today' | 'week' | 'month' | 'all')}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
          >
            <option value="all">{t('clinical.common.allTime')}</option>
            <option value="today">{t('clinical.common.today')}</option>
            <option value="week">{t('clinical.common.thisWeek')}</option>
            <option value="month">{t('clinical.common.thisMonth')}</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
          {error}
          <button onClick={fetchVitals} className="ml-2 underline">{t('clinical.common.retry')}</button>
        </div>
      )}

      {/* Vitals Table */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <TableSkeleton rows={5} columns={8} />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.common.patient')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.dateTime')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.bloodPressure')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.heartRate')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.tempShort')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">SpO2</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.bmiShort')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {vitals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-lg font-medium">{t('clinical.record.noVitals')}</p>
                      <p className="text-sm">{t('clinical.vitals.emptyHint')}</p>
                    </td>
                  </tr>
                ) : (
                  vitals.map((vital) => {
                    const bmi = calculateBMI(vital.weight, vital.height);
                    const bmiCategory = bmi ? getBMICategory(parseFloat(bmi)) : null;

                    return (
                      <tr key={vital.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-lime-100 dark:bg-lime-900/50 flex items-center justify-center">
                              <span className="text-lime-600 dark:text-lime-400 text-sm font-medium">
                                {vital.patientName?.split(' ').map(n => n[0]).join('') || '?'}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {vital.patientName || t('clinical.common.unknown')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(vital.recordedAt)}
                          {vital.flags && vital.flags.length > 0 && (
                            <div className="mt-1"><VitalFlagBadges flags={vital.flags} /></div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {vital.bloodPressure ? (
                            <span className={`font-medium ${bpValueClass(vital.flags)}`}>
                              {vital.bloodPressure} mmHg
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {vital.heartRate ? (
                            <span className={`font-medium ${vitalValueClass(vital.flags, 'heartRate')}`}>
                              {vital.heartRate} {t('clinical.vitals.bpm')}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {vital.temperature ? (
                            <span className={`font-medium ${vitalValueClass(vital.flags, 'temperature')}`}>
                              {vital.temperature}°C
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {vital.oxygenSaturation ? (
                            <span className={`font-medium ${vitalValueClass(vital.flags, 'oxygenSaturation')}`}>
                              {vital.oxygenSaturation}%
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {bmi ? (
                            <span className={`font-medium ${bmiCategory?.color}`}>
                              {bmi}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openViewModal(vital)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                              title={t('clinical.common.viewDetails')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 bg-white dark:bg-gray-800 px-4 py-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('clinical.vitals.showing', { from: ((currentPage - 1) * itemsPerPage) + 1, to: Math.min(currentPage * itemsPerPage, totalVitals), total: totalVitals })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('clinical.common.previous')}
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('clinical.common.next')}
            </button>
          </div>
        </div>
      )}

      {/* Add Vitals Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('clinical.vitals.recordTitle')}</h2>
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleAddVitals} className="p-6 space-y-6">
              {/* Patient Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('clinical.common.patient')} <span className="text-red-500">*</span>
                </label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-3 bg-lime-50 dark:bg-lime-900/30 border border-lime-200 dark:border-lime-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-lime-100 dark:bg-lime-900 flex items-center justify-center">
                        <span className="text-lime-600 dark:text-lime-400 font-medium">
                          {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedPatient.firstName} {selectedPatient.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{selectedPatient.patientId}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('clinical.vitals.searchPatient')}
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                    {searchingPatients && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                    {patientSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {patientSearchResults.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatient(patient);
                              setPatientSearch('');
                              setPatientSearchResults([]);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-3"
                          >
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center">
                              <span className="text-gray-600 dark:text-gray-300 text-sm">
                                {patient.firstName[0]}{patient.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {patient.firstName} {patient.lastName}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{patient.patientId}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Vital Signs Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.vitals.systolic')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.bloodPressureSys}
                      onChange={(e) => setFormData({ ...formData, bloodPressureSys: e.target.value })}
                      placeholder="120"
                      min="60"
                      max="250"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">mmHg</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.vitals.diastolic')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.bloodPressureDia}
                      onChange={(e) => setFormData({ ...formData, bloodPressureDia: e.target.value })}
                      placeholder="80"
                      min="40"
                      max="150"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">mmHg</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.vitals.heartRate')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.heartRate}
                      onChange={(e) => setFormData({ ...formData, heartRate: e.target.value })}
                      placeholder="72"
                      min="30"
                      max="220"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">bpm</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.vitals.temperature')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                      placeholder="36.5"
                      min="35"
                      max="42"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">°C</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.vitals.respiratoryRate')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.respiratoryRate}
                      onChange={(e) => setFormData({ ...formData, respiratoryRate: e.target.value })}
                      placeholder="16"
                      min="8"
                      max="40"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">/min</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.vitals.spo2')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.oxygenSaturation}
                      onChange={(e) => setFormData({ ...formData, oxygenSaturation: e.target.value })}
                      placeholder="98"
                      min="70"
                      max="100"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.vitals.weight')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      placeholder="70"
                      min="1"
                      max="500"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">kg</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.vitals.height')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                      placeholder="170"
                      min="50"
                      max="250"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">cm</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('clinical.common.notes')}
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t('clinical.vitals.notesPlaceholder')}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t('clinical.common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedPatient}
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? t('clinical.common.saving') : t('clinical.vitals.record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Vitals Modal */}
      {showViewModal && selectedVital && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('clinical.vitals.detailsTitle')}</h2>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="w-12 h-12 rounded-full bg-lime-100 dark:bg-lime-900/50 flex items-center justify-center">
                  <span className="text-lime-600 dark:text-lime-400 font-bold">
                    {selectedVital.patientName?.split(' ').map(n => n[0]).join('') || '?'}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{selectedVital.patientName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('clinical.vitals.recordedAt', { date: formatDate(selectedVital.recordedAt) })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.bloodPressure')}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedVital.bloodPressure || '-'} {selectedVital.bloodPressure && 'mmHg'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.heartRate')}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedVital.heartRate || '-'} {selectedVital.heartRate && t('clinical.vitals.bpm')}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.temperature')}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedVital.temperature || '-'} {selectedVital.temperature && '°C'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.respiratoryRate')}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedVital.respiratoryRate || '-'} {selectedVital.respiratoryRate && '/min'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.oxygenSaturation')}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedVital.oxygenSaturation || '-'} {selectedVital.oxygenSaturation && '%'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.bmiShort')}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {calculateBMI(selectedVital.weight, selectedVital.height) || '-'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.weight')}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedVital.weight || '-'} {selectedVital.weight && 'kg'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('clinical.vitals.height')}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedVital.height || '-'} {selectedVital.height && 'cm'}
                  </p>
                </div>
              </div>

              {selectedVital.notes && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 uppercase mb-1">{t('clinical.common.notes')}</p>
                  <p className="text-gray-900 dark:text-white">{selectedVital.notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('clinical.common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
