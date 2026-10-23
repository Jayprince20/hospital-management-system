'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  api,
  PatientDetail,
  PatientAppointment,
  PatientPrescription,
  PatientLabResult,
  PatientVital,
  PatientBilling,
} from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { PatientConsentsPanel, PatientDataProtection } from '@/components/consent';
import { PatientCoveragePanel } from '@/components/insurance';
import { AdmissionDialog } from '@/components/inpatient';
import { PatientDocumentsPanel } from '@/components/documents';

type TabType = 'overview' | 'appointments' | 'prescriptions' | 'lab-results' | 'vitals' | 'billing' | 'coverage' | 'documents' | 'consents';

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, tEnum, formatDate: formatLocaleDate, formatTime: formatLocaleTime, formatCurrency } = useLanguage();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [admitting, setAdmitting] = useState(false);
  const canAdmit = user?.role === 'ADMIN' || user?.role === 'DOCTOR' || user?.role === 'RECEPTIONIST';

  const fetchPatient = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPatient(params.id as string);
      setPatient(data);
      setError(null);
    } catch (err) {
      setError(t('patientDetail.errLoad'));
      console.error('Patient fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.deletePatient(params.id as string);
      router.push('/dashboard/patients');
    } catch (err) {
      console.error('Delete error:', err);
      setError(t('patientsPage.deleteFailedOne'));
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: t('patientDetail.tabOverview'), icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'appointments', label: t('patientDetail.tabAppointments'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'prescriptions', label: t('patientDetail.tabPrescriptions'), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'lab-results', label: t('patientDetail.tabLab'), icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { id: 'vitals', label: t('patientDetail.tabVitals'), icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { id: 'billing', label: t('patientDetail.tabBilling'), icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'coverage', label: t('ins.coverage.tab'), icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
    { id: 'documents', label: t('mdoc.panel.tab'), icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { id: 'consents', label: t('privacy.tab'), icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  ];

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

  const formatDate = (dateString: string) => {
    return formatLocaleDate(dateString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    return formatLocaleTime(time);
  };

  const formatStatus = (status: string) => {
    return tEnum(status);
  };

  const statusColors: Record<string, string> = {
    'COMPLETED': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    'SCHEDULED': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    'CONFIRMED': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    'PENDING': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    'CANCELLED': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    'IN_PROGRESS': 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    'Active': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    'ACTIVE': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    'PAID': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    'DISPENSED': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-red-600 mb-4">{error || t('patientForm.notFound')}</p>
        <Link
          href="/dashboard/patients"
          className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700"
        >
          {t('patientForm.backToPatients')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/dashboard/patients"
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {patient.firstName} {patient.lastName}
              </h1>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                patient.status === 'Active'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {tEnum(patient.status?.toUpperCase())}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('patientForm.patientIdValue', { id: patient.patientId })}
            </p>
          </div>
          {/* An anonymised record is frozen: no new visits, no edits that could bring identity back */}
          {!patient.anonymizedAt && (
          <div className="flex flex-wrap items-center gap-3">
            {canAdmit && (
              <button
                type="button"
                onClick={() => setAdmitting(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v11m0-4h18m0 4V9a2 2 0 00-2-2h-8v7M7 11a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
                {t('inp.admitPatient')}
              </button>
            )}
            <Link
              href={`/dashboard/appointments/new?patientId=${patient.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {t('patientDetail.bookAppointment')}
            </Link>
            <Link
              href={`/dashboard/patients/${params.id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-lime-600 hover:bg-lime-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t('patientDetail.editPatient')}
            </Link>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t('patientDetail.delete')}
            </button>
          </div>
          )}
        </div>
      </div>

      {/* Patient Quick Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Avatar and Basic Info */}
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-lime-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-2xl">
                {patient.firstName[0]}{patient.lastName[0]}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t('unit.years', { count: calculateAge(patient.dateOfBirth) })}
                </span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {tEnum(patient.gender)}
                </span>
                {patient.bloodType && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                      {tEnum(patient.bloodType)}
                    </span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('patientDetail.dobValue', { date: formatDate(patient.dateOfBirth) })}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('patientDetail.memberSince', { date: formatDate(patient.createdAt) })}
              </p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 lg:border-l lg:border-gray-200 lg:dark:border-gray-700 lg:pl-6">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('patientDetail.email')}</p>
              <p className="text-sm text-gray-900 dark:text-white">{patient.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('patientDetail.phone')}</p>
              <p className="text-sm text-gray-900 dark:text-white">{patient.phoneNumber}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('patientDetail.address')}</p>
              <p className="text-sm text-gray-900 dark:text-white">
                {[patient.city, patient.state].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
          </div>

          {/* Alerts */}
          {patient.allergies && patient.allergies.length > 0 && (
            <div className="lg:border-l lg:border-gray-200 lg:dark:border-gray-700 lg:pl-6">
              <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {t('patientDetail.allergies')}
              </p>
              <div className="flex flex-wrap gap-1">
                {patient.allergies.map((allergy, index) => (
                  <span key={index} className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 rounded">
                    {allergy}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Patients registered before consent capture: prompt staff to collect it */}
      {!patient.anonymizedAt && patient.dataProcessingConsent !== true && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <span>{t('privacy.missingBanner')}</span>
          <button
            type="button"
            onClick={() => setActiveTab('consents')}
            className="rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700"
          >
            {t('privacy.missingBannerAction')}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-4 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-lime-600 text-lime-600 dark:text-lime-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Personal Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('patientDetail.personalInfo')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.fullName')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{patient.firstName} {patient.lastName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.dob')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(patient.dateOfBirth)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.gender')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{patient.gender}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.bloodType')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{patient.bloodType ? tEnum(patient.bloodType) : t('patientsPage.na')}</p>
                  </div>
                </div>
                <hr className="border-gray-100 dark:border-gray-700" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.fullAddress')}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {patient.address}<br />
                    {[patient.city, [patient.state, patient.zipCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}<br />
                    {patient.country}
                  </p>
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('patientDetail.emergency')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.contactName')}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{patient.emergencyName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.relationship')}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{patient.emergencyRelation}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.phoneNumber')}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{patient.emergencyPhone}</p>
                </div>
              </div>
            </div>

            {/* Insurance */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('patientDetail.insurance')}</h3>
              </div>
              {patient.insurance ? (
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.provider')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{patient.insurance.provider}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.policy')}</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{patient.insurance.policyNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.group')}</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{patient.insurance.groupNumber || t('patientsPage.na')}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.validPeriod')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(patient.insurance.validFrom)} - {formatDate(patient.insurance.validUntil)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.coverage')}</p>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                      {patient.insurance.coverageType}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  {t('patientDetail.noInsurance')}
                </div>
              )}
            </div>

            {/* Medical Conditions */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('patientDetail.medicalInfo')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('patientDetail.chronic')}</p>
                  {patient.chronicConditions && patient.chronicConditions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {patient.chronicConditions.map((condition, index) => (
                        <span key={index} className="px-3 py-1 text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 rounded-full">
                          {condition}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('patientDetail.noneRecorded')}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('patientDetail.allergies')}</p>
                  {patient.allergies && patient.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {patient.allergies.map((allergy, index) => (
                        <span key={index} className="px-3 py-1 text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 rounded-full">
                          {allergy}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('patientDetail.noneRecorded')}</p>
                  )}
                </div>
                {patient.notes && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('patientDetail.notes')}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{patient.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Vitals */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('patientDetail.latestVitals')}</h3>
                {patient.vitals && patient.vitals.length > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(patient.vitals[0].date)}</span>
                )}
              </div>
              {patient.vitals && patient.vitals.length > 0 ? (
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.bp')}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{patient.vitals[0].bloodPressure || t('patientsPage.na')}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">mmHg</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.hr')}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{patient.vitals[0].heartRate || t('patientsPage.na')}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">bpm</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.temp')}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{patient.vitals[0].temperature || t('patientsPage.na')}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('patientDetail.weight')}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{patient.vitals[0].weight || t('patientsPage.na')}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  {t('patientDetail.noVitals')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('patientDetail.aptHistory')}</h3>
              <Link
                href={`/dashboard/appointments/new?patientId=${patient.id}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-lime-600 hover:bg-lime-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('patientDetail.newAppointment')}
              </Link>
            </div>
            {patient.appointments && patient.appointments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.dateTime')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.doctor')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.department')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.type')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.status')}</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {patient.appointments.map((apt: PatientAppointment) => (
                      <tr key={apt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(apt.date)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(apt.startTime)}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{apt.doctor?.name || t('patientsPage.na')}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{apt.doctor?.department || t('patientsPage.na')}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{formatStatus(apt.type)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[apt.status] || 'bg-gray-100 text-gray-800'}`}>
                            {formatStatus(apt.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/dashboard/appointments/${apt.id}`}
                            className="text-lime-600 dark:text-lime-400 hover:text-lime-500 text-sm font-medium"
                          >
                            {t('patientDetail.view')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">{t('patientDetail.noAppointments')}</p>
              </div>
            )}
          </div>
        )}

        {/* Prescriptions Tab */}
        {activeTab === 'prescriptions' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('patientDetail.prescriptions')}</h3>
            </div>
            {patient.prescriptions && patient.prescriptions.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {patient.prescriptions.map((rx: PatientPrescription) => (
                  <div key={rx.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(rx.date)}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[rx.status] || 'bg-gray-100 text-gray-800'}`}>
                            {tEnum(rx.status)}
                          </span>
                        </div>
                        {rx.doctor && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('patientDetail.prescribedBy', { doctor: rx.doctor })}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {rx.medications.map((med, index) => (
                            <span key={index} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                              {med.name} - {med.dosage} ({med.frequency})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">{t('patientDetail.noPrescriptions')}</p>
              </div>
            )}
          </div>
        )}

        {/* Lab Results Tab */}
        {activeTab === 'lab-results' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('patientDetail.labResults')}</h3>
            </div>
            {patient.labResults && patient.labResults.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {patient.labResults.map((lab: PatientLabResult) => (
                  <div key={lab.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(lab.date)}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[lab.status] || 'bg-gray-100 text-gray-800'}`}>
                          {tEnum(lab.status)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {lab.tests.map((test, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{test.name}</span>
                          <span className={`text-sm font-medium ${test.isAbnormal ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                            {test.result}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">{t('patientDetail.noLab')}</p>
              </div>
            )}
          </div>
        )}

        {/* Vitals Tab */}
        {activeTab === 'vitals' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('patientDetail.vitalsHistory')}</h3>
            </div>
            {patient.vitals && patient.vitals.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.date')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.bp')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.hr')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.temp')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.weight')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.height')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {patient.vitals.map((vital: PatientVital, index: number) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{formatDate(vital.date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{vital.bloodPressure || t('patientsPage.na')}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{vital.heartRate ? `${vital.heartRate} bpm` : t('patientsPage.na')}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{vital.temperature ? `${vital.temperature}°` : t('patientsPage.na')}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{vital.weight ? `${vital.weight} kg` : t('patientsPage.na')}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{vital.height ? `${vital.height} cm` : t('patientsPage.na')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">{t('patientDetail.noVitals')}</p>
              </div>
            )}
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('patientDetail.billingHistory')}</h3>
            </div>
            {patient.billing && patient.billing.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.invoiceId')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.date')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.description')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.amount')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('patientDetail.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {patient.billing.map((bill: PatientBilling) => (
                      <tr key={bill.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">{bill.id}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{formatDate(bill.date)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{bill.description}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(bill.amount)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[bill.status] || 'bg-gray-100 text-gray-800'}`}>
                            {tEnum(bill.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">{t('patientDetail.noBilling')}</p>
              </div>
            )}
          </div>
        )}

        {/* Medical documents: certificates, sick leave, referral letters */}
        {activeTab === 'documents' && (
          <PatientDocumentsPanel patient={{ id: patient.id, patientId: patient.patientId, name: `${patient.firstName} ${patient.lastName}` }} />
        )}
        {activeTab === 'coverage' && (
          <PatientCoveragePanel patientId={patient.id} canManage={user?.role === 'ADMIN' || user?.role === 'RECEPTIONIST'} />
        )}
        {activeTab === 'consents' && (
          <div className="space-y-6">
            <PatientConsentsPanel patientId={patient.id} canRecord={user?.role !== 'PATIENT'} />
            {isAdmin && (
              <PatientDataProtection
                patientId={patient.id}
                hospitalId={patient.patientId}
                // Anonymised accounts get a placeholder email on an invalid domain
                anonymized={Boolean(patient.anonymizedAt)}
                onAnonymized={fetchPatient}
              />
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowDeleteModal(false)} />
            <div className="relative inline-block bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full">
              <div className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('patientDetail.deleteTitle')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {t('patientsPage.deleteMessage', { name: `${patient.firstName} ${patient.lastName}` })}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {t('patientDetail.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleting ? t('patientDetail.deleting') : t('patientDetail.deleteTitle')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {admitting && (
        <AdmissionDialog
          patient={{ id: patient.id, patientId: patient.patientId, firstName: patient.firstName, lastName: patient.lastName, gender: patient.gender, dateOfBirth: patient.dateOfBirth }}
          onClose={() => setAdmitting(false)}
          onAdmitted={(admission) => {
            setAdmitting(false);
            router.push(`/dashboard/admissions/${admission.id}`);
          }}
        />
      )}
    </div>
  );
}
