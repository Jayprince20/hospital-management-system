'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, Consultation, Appointment } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/components/toast';
import { useAuth } from '@/context/auth-context';
import { PermissionGate } from '@/components/permission-gate';
import { TableSkeleton } from '@/components/ui';
import { useLanguage } from '@/context/language-context';
import { toLocalDateString } from '@/lib/formatters';

interface ConsultationFormData {
  appointmentId: string;
  chiefComplaint: string;
  symptoms: string[];
  examination: string;
  diagnosis: string[];
  diagnosisCodes: string[];
  treatmentPlan: string;
  notes: string;
  followUpDate: string;
}

const initialFormData: ConsultationFormData = {
  appointmentId: '',
  chiefComplaint: '',
  symptoms: [],
  examination: '',
  diagnosis: [],
  diagnosisCodes: [],
  treatmentPlan: '',
  notes: '',
  followUpDate: '',
};

export default function ConsultationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { t, formatDate, formatDateTime, formatTime } = useLanguage();

  // Data state
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [scheduledAppointments, setScheduledAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisWeek: 0,
    uniqueDoctors: 0,
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalConsultations, setTotalConsultations] = useState(0);
  const itemsPerPage = 10;

  // Modal state
  const [showStartModal, setShowStartModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState<ConsultationFormData>(initialFormData);
  const [symptomInput, setSymptomInput] = useState('');
  const [diagnosisInput, setDiagnosisInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        // Calendar week starting on Monday
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

  const fetchConsultations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const dateRange = getDateRange();
      const filters: Record<string, string | number | undefined> = {
        ...dateRange,
        page: currentPage,
        limit: itemsPerPage,
      };

      if (debouncedSearch) {
        filters.search = debouncedSearch;
      }

      // If user is a doctor, filter by their ID
      if (user?.role === 'DOCTOR') {
        // The API should handle this based on auth, but we could add doctorId filter
      }

      const response = await api.getConsultations(filters);

      setConsultations(response.consultations);
      setStats(response.stats);
      setTotalPages(response.pagination.totalPages);
      setTotalConsultations(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clinical.consultations.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, getDateRange, user?.role, t]);

  const fetchPendingAppointments = useCallback(async () => {
    try {
      // Fetch appointments that are CHECKED_IN (ready for consultation)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [checkedInResponse, scheduledResponse, confirmedResponse] = await Promise.all([
        api.getAppointments({
          status: 'CHECKED_IN',
          dateFrom: todayStart.toISOString(),
          dateTo: todayEnd.toISOString(),
          limit: 50,
        }),
        api.getAppointments({
          status: 'SCHEDULED',
          dateFrom: todayStart.toISOString(),
          dateTo: todayEnd.toISOString(),
          limit: 50,
        }),
        api.getAppointments({
          status: 'CONFIRMED',
          dateFrom: todayStart.toISOString(),
          dateTo: todayEnd.toISOString(),
          limit: 50,
        }),
      ]);

      setPendingAppointments(checkedInResponse.data);
      // Combine scheduled and confirmed appointments that need check-in
      setScheduledAppointments([...scheduledResponse.data, ...confirmedResponse.data]);
    } catch (err) {
      console.error('Failed to fetch pending appointments:', err);
    }
  }, []);

  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  useEffect(() => {
    fetchPendingAppointments();
  }, [fetchPendingAppointments]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, dateFilter]);

  const handleStartConsultation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAppointment) {
      toast.error(t('clinical.consultations.appointmentRequired'), t('clinical.consultations.selectAppointment'));
      return;
    }

    if (!formData.chiefComplaint.trim()) {
      toast.error(t('clinical.consultations.complaintRequired'), t('clinical.consultations.enterComplaint'));
      return;
    }

    try {
      setSubmitting(true);

      await api.createConsultation({
        appointmentId: selectedAppointment.id,
        chiefComplaint: formData.chiefComplaint,
        symptoms: formData.symptoms.length > 0 ? formData.symptoms : undefined,
        examination: formData.examination || undefined,
        diagnosis: formData.diagnosis.length > 0 ? formData.diagnosis : undefined,
        diagnosisCodes: formData.diagnosisCodes.length > 0 ? formData.diagnosisCodes : undefined,
        treatmentPlan: formData.treatmentPlan || undefined,
        notes: formData.notes || undefined,
        followUpDate: formData.followUpDate || undefined,
      });

      toast.success(t('clinical.consultations.created'), t('clinical.consultations.createdMessage', { name: `${selectedAppointment.patient.firstName} ${selectedAppointment.patient.lastName}` }));
      setShowStartModal(false);
      resetForm();
      fetchConsultations();
      fetchPendingAppointments();
    } catch (err) {
      toast.error(t('clinical.consultations.createFailed'), err instanceof Error ? err.message : t('clinical.common.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setSelectedAppointment(null);
    setSymptomInput('');
    setDiagnosisInput('');
  };

  const addSymptom = () => {
    if (symptomInput.trim() && !formData.symptoms.includes(symptomInput.trim())) {
      setFormData({ ...formData, symptoms: [...formData.symptoms, symptomInput.trim()] });
      setSymptomInput('');
    }
  };

  const removeSymptom = (symptom: string) => {
    setFormData({ ...formData, symptoms: formData.symptoms.filter(s => s !== symptom) });
  };

  const addDiagnosis = () => {
    if (diagnosisInput.trim() && !formData.diagnosis.includes(diagnosisInput.trim())) {
      setFormData({ ...formData, diagnosis: [...formData.diagnosis, diagnosisInput.trim()] });
      setDiagnosisInput('');
    }
  };

  const removeDiagnosis = (diagnosis: string) => {
    setFormData({ ...formData, diagnosis: formData.diagnosis.filter(d => d !== diagnosis) });
  };

  const handleCheckIn = async (appointment: Appointment) => {
    try {
      setCheckingIn(appointment.id);
      await api.updateAppointment(appointment.id, { status: 'CHECKED_IN' });
      toast.success(t('clinical.consultations.checkedIn'), t('clinical.consultations.checkedInMessage', { name: `${appointment.patient.firstName} ${appointment.patient.lastName}` }));
      // Refresh appointments
      await fetchPendingAppointments();
    } catch (err) {
      toast.error(t('clinical.consultations.checkInFailed'), err instanceof Error ? err.message : t('clinical.consultations.checkInFailedMessage'));
    } finally {
      setCheckingIn(null);
    }
  };

  const openViewModal = (consultation: Consultation) => {
    setSelectedConsultation(consultation);
    setShowViewModal(true);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('nav.consultations')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('clinical.consultations.subtitle')}</p>
        </div>
        <PermissionGate permission="records:create">
          <button
            onClick={() => setShowStartModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('clinical.consultations.start')}
          </button>
        </PermissionGate>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('clinical.consultations.total')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('clinical.common.today')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.today}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('clinical.common.thisWeek')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.thisWeek}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('enum.CHECKED_IN')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingAppointments.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('clinical.consultations.scheduledToday')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{scheduledAppointments.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Appointments Alert */}
      {pendingAppointments.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                {t(pendingAppointments.length === 1 ? 'clinical.consultations.readyOne' : 'clinical.consultations.readyMany', { count: pendingAppointments.length })}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                {t('clinical.consultations.readyHint')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Appointments Alert */}
      {pendingAppointments.length === 0 && scheduledAppointments.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">
                {t(scheduledAppointments.length === 1 ? 'clinical.consultations.scheduledOne' : 'clinical.consultations.scheduledMany', { count: scheduledAppointments.length })}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {t('clinical.consultations.scheduledHint')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={t('clinical.consultations.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
              />
            </div>
          </div>

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
          <button onClick={fetchConsultations} className="ml-2 underline">{t('clinical.common.retry')}</button>
        </div>
      )}

      {/* Consultations Table */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <TableSkeleton rows={5} columns={6} />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.common.patient')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.common.doctor')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.common.chiefComplaint')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.common.diagnosis')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.common.date')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('clinical.common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {consultations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg font-medium">{t('clinical.consultations.noneFound')}</p>
                      <p className="text-sm">{t('clinical.consultations.noneFoundHint')}</p>
                    </td>
                  </tr>
                ) : (
                  consultations.map((consultation) => (
                    <tr key={consultation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-lime-100 dark:bg-lime-900/50 flex items-center justify-center">
                            <span className="text-lime-600 dark:text-lime-400 text-sm font-medium">
                              {consultation.patientName?.split(' ').map(n => n[0]).join('') || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{consultation.patientName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{consultation.patientHospitalId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900 dark:text-white">{consultation.doctorName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{consultation.department}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900 dark:text-white max-w-xs truncate">{consultation.chiefComplaint}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {consultation.diagnosis.slice(0, 2).map((d, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded">
                              {d}
                            </span>
                          ))}
                          {consultation.diagnosis.length > 2 && (
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                              +{consultation.diagnosis.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(consultation.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openViewModal(consultation)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                            title={t('clinical.common.viewDetails')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <Link
                            href={`/dashboard/consultations/${consultation.id}`}
                            className="p-1.5 text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/50 rounded-lg transition-colors"
                            title={t('clinical.common.fullDetails')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 bg-white dark:bg-gray-800 px-4 py-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('clinical.consultations.showing', { from: ((currentPage - 1) * itemsPerPage) + 1, to: Math.min(currentPage * itemsPerPage, totalConsultations), total: totalConsultations })}
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

      {/* Start Consultation Modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('clinical.consultations.start')}</h2>
                <button
                  onClick={() => { setShowStartModal(false); resetForm(); }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleStartConsultation} className="p-6 space-y-6">
              {/* Select Patient/Appointment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('clinical.consultations.selectPatient')} <span className="text-red-500">*</span>
                </label>
                {selectedAppointment ? (
                  <div className="flex items-center justify-between p-3 bg-lime-50 dark:bg-lime-900/30 border border-lime-200 dark:border-lime-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-lime-100 dark:bg-lime-900 flex items-center justify-center">
                        <span className="text-lime-600 dark:text-lime-400 font-medium">
                          {selectedAppointment.patient.firstName[0]}{selectedAppointment.patient.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedAppointment.patient.firstName} {selectedAppointment.patient.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {selectedAppointment.patient.patientId} - {selectedAppointment.reason}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAppointment(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Checked-in patients - ready for consultation */}
                    {pendingAppointments.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                          {t('clinical.consultations.checkedInReady')}
                        </p>
                        <div className="space-y-2">
                          {pendingAppointments.map((apt) => (
                            <button
                              key={apt.id}
                              type="button"
                              onClick={() => setSelectedAppointment(apt)}
                              className="w-full p-3 text-left border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    {apt.patient.firstName[0]}{apt.patient.lastName[0]}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {apt.patient.firstName} {apt.patient.lastName}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {apt.reason} - {formatTime(apt.startTime)}
                                  </p>
                                </div>
                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
                                  {t('clinical.consultations.ready')}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scheduled patients - need check-in */}
                    {scheduledAppointments.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                          {t('clinical.consultations.needCheckIn')}
                        </p>
                        <div className="space-y-2">
                          {scheduledAppointments.map((apt) => (
                            <div
                              key={apt.id}
                              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                                    {apt.patient.firstName[0]}{apt.patient.lastName[0]}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {apt.patient.firstName} {apt.patient.lastName}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {apt.reason} - {formatTime(apt.startTime)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCheckIn(apt)}
                                  disabled={checkingIn === apt.id}
                                  className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                >
                                  {checkingIn === apt.id ? t('clinical.consultations.checkingIn') : t('clinical.consultations.checkIn')}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No appointments message */}
                    {pendingAppointments.length === 0 && scheduledAppointments.length === 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                        {t('clinical.consultations.noAppointmentsToday')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Chief Complaint */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('clinical.common.chiefComplaint')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.chiefComplaint}
                  onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
                  placeholder={t('clinical.consultations.complaintPlaceholder')}
                  rows={2}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                />
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('clinical.common.symptoms')}
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={symptomInput}
                    onChange={(e) => setSymptomInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSymptom())}
                    placeholder={t('clinical.consultations.addSymptom')}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={addSymptom}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {t('clinical.common.add')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.symptoms.map((symptom, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                      {symptom}
                      <button type="button" onClick={() => removeSymptom(symptom)} className="hover:text-blue-900 dark:hover:text-blue-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Examination */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('clinical.consultations.physicalExam')}
                </label>
                <textarea
                  value={formData.examination}
                  onChange={(e) => setFormData({ ...formData, examination: e.target.value })}
                  placeholder={t('clinical.consultations.examPlaceholder')}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                />
              </div>

              {/* Diagnosis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('clinical.common.diagnosis')}
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={diagnosisInput}
                    onChange={(e) => setDiagnosisInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDiagnosis())}
                    placeholder={t('clinical.consultations.addDiagnosis')}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={addDiagnosis}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {t('clinical.common.add')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.diagnosis.map((d, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full text-sm">
                      {d}
                      <button type="button" onClick={() => removeDiagnosis(d)} className="hover:text-green-900 dark:hover:text-green-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Treatment Plan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('clinical.common.treatmentPlan')}
                </label>
                <textarea
                  value={formData.treatmentPlan}
                  onChange={(e) => setFormData({ ...formData, treatmentPlan: e.target.value })}
                  placeholder={t('clinical.consultations.treatmentPlaceholder')}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                />
              </div>

              {/* Follow-up Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('clinical.common.followUpDate')}
                </label>
                <input
                  type="date"
                  value={formData.followUpDate}
                  onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                  min={toLocalDateString()}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('clinical.common.additionalNotes')}
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t('clinical.common.notesPlaceholder')}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowStartModal(false); resetForm(); }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t('clinical.common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedAppointment || !formData.chiefComplaint.trim()}
                  className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? t('clinical.common.creating') : t('clinical.consultations.complete')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Consultation Modal */}
      {showViewModal && selectedConsultation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('clinical.consultations.details')}</h2>
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

            <div className="p-6 space-y-6">
              {/* Patient Info */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="w-14 h-14 rounded-full bg-lime-100 dark:bg-lime-900/50 flex items-center justify-center">
                  <span className="text-lime-600 dark:text-lime-400 font-bold text-lg">
                    {selectedConsultation.patientName?.split(' ').map(n => n[0]).join('') || '?'}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-lg text-gray-900 dark:text-white">{selectedConsultation.patientName}</p>
                  <p className="text-gray-500 dark:text-gray-400">{selectedConsultation.patientHospitalId}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedConsultation.doctorName} - {selectedConsultation.department}
                  </p>
                </div>
              </div>

              {/* Chief Complaint */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{t('clinical.common.chiefComplaint')}</h3>
                <p className="text-gray-900 dark:text-white">{selectedConsultation.chiefComplaint}</p>
              </div>

              {/* Symptoms */}
              {selectedConsultation.symptoms.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{t('clinical.common.symptoms')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedConsultation.symptoms.map((s, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Examination */}
              {selectedConsultation.examination && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{t('clinical.common.examination')}</h3>
                  <p className="text-gray-900 dark:text-white">{selectedConsultation.examination}</p>
                </div>
              )}

              {/* Diagnosis */}
              {selectedConsultation.diagnosis.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{t('clinical.common.diagnosis')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedConsultation.diagnosis.map((d, i) => (
                      <span key={i} className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full text-sm">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Treatment Plan */}
              {selectedConsultation.treatmentPlan && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{t('clinical.common.treatmentPlan')}</h3>
                  <p className="text-gray-900 dark:text-white">{selectedConsultation.treatmentPlan}</p>
                </div>
              )}

              {/* Follow-up */}
              {selectedConsultation.followUpDate && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{t('clinical.common.followUpDate')}</h3>
                  <p className="text-gray-900 dark:text-white">{formatDate(selectedConsultation.followUpDate)}</p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedConsultation.prescriptionCount}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('nav.prescriptions')}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedConsultation.labOrderCount}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('clinical.common.labOrders')}</p>
                </div>
              </div>

              {/* Date */}
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {t('clinical.common.createdAt', { date: formatDateTime(selectedConsultation.createdAt) })}
              </p>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <Link
                href={`/dashboard/consultations/${selectedConsultation.id}`}
                className="px-4 py-2 text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/50 rounded-lg transition-colors"
              >
                {t('clinical.common.viewFullDetails')}
              </Link>
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
