'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { api, PatientDetail, type Invoice } from '@/lib/api';
import { MobileMoneyPayment } from '@/components/payments';
import { useLanguage } from '@/context/language-context';
import { MyConsents } from '@/components/consent';
import { isInsured, patientDue } from '@/lib/insurance';
import { MyTicketCard } from '@/components/queue';
import { MyAdmissionCard } from '@/components/inpatient';
import { MyPharmacyPurchases } from '@/components/pharmacy/my-purchases';
import { MyMedicalDocuments } from '@/components/documents';

type TabType = 'overview' | 'appointments' | 'vitals' | 'lab-results' | 'prescriptions' | 'consultations' | 'documents' | 'billing' | 'privacy';

export default function MyHealthPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [patientData, setPatientData] = useState<PatientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  // Bumped after a payment so balances and the billing summary are re-read
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // First, try to find patient ID
        // Check if user has patientId, otherwise search by email
        let patientId = user.patientId;

        if (!patientId && user.email) {
          try {
            const patientsRes = await api.getPatients({ search: user.email, limit: 1 });
            if (patientsRes.data && patientsRes.data.length > 0) {
              patientId = patientsRes.data[0].id;
            }
          } catch {
            // Patient search failed
          }
        }

        if (!patientId) {
          setError(t('admin.health.noRecord'));
          setIsLoading(false);
          return;
        }

        const data = await api.getPatient(patientId);
        setPatientData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching patient data:', err);
        setError(t('admin.health.loadError'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatientData();
  }, [user, t, refreshKey]);

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: t('admin.health.tab.overview'), icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'appointments', label: t('admin.health.tab.appointments'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'vitals', label: t('admin.health.tab.vitals'), icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { id: 'lab-results', label: t('admin.health.tab.labResults'), icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
    { id: 'prescriptions', label: t('admin.health.tab.prescriptions'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { id: 'consultations', label: t('admin.health.tab.consultations'), icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    { id: 'documents', label: t('mdoc.mine.tab'), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'billing', label: t('admin.health.tab.billing'), icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'privacy', label: t('privacy.portal.title'), icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('admin.health.loadingYourHealthRecords')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('admin.health.unableToLoadRecords')}</h3>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-lime-500 to-green-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {t('dashboard.welcome')}, {patientData?.firstName || user?.firstName}!
            </h1>
            <p className="text-lime-100">
              {patientData?.patientId && t('admin.health.patientId', { id: patientData.patientId })}
            </p>
          </div>
        </div>
      </div>

      <MyTicketCard />
      <MyAdmissionCard />

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <nav className="flex -mb-px min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-lime-500 text-lime-600 dark:text-lime-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab patientData={patientData} />}
          {activeTab === 'appointments' && <AppointmentsTab appointments={patientData?.appointments || []} />}
          {activeTab === 'vitals' && <VitalsTab vitals={patientData?.vitals || []} />}
          {activeTab === 'lab-results' && <LabResultsTab labResults={patientData?.labResults || []} />}
          {activeTab === 'prescriptions' && <PrescriptionsTab prescriptions={patientData?.prescriptions || []} />}
          {activeTab === 'consultations' && <ConsultationsTab patientId={patientData?.id} />}
          {activeTab === 'documents' && <MyMedicalDocuments />}
          {activeTab === 'billing' && (
            <>
              {patientData?.id && <PayInvoices patientId={patientData.id} phone={patientData.phoneNumber} onPaid={() => setRefreshKey((n) => n + 1)} />}
              <BillingTab billing={patientData?.billing || []} />
              <div className="mt-8">
                <MyPharmacyPurchases />
              </div>
            </>
          )}
          {activeTab === 'privacy' && patientData?.id && <MyConsents patientId={patientData.id} />}
        </div>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ patientData }: { patientData: PatientDetail | null }) {
  const { t, tEnum, formatDate, formatCurrency } = useLanguage();
  if (!patientData) return null;

  const upcomingAppointments = patientData.appointments?.filter(
    (apt) => apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED'
  ).length || 0;

  const activePrescriptions = patientData.prescriptions?.filter(
    (rx) => rx.status === 'ACTIVE' || rx.status === 'PARTIALLY_DISPENSED'
  ).length || 0;

  const pendingLabResults = patientData.labResults?.filter(
    (lab) => lab.status === 'ORDERED' || lab.status === 'PROCESSING'
  ).length || 0;

  const pendingBills = patientData.billing?.filter(
    (bill) => bill.status === 'PENDING' || bill.status === 'OVERDUE'
  ).length || 0;

  const stats = [
    { label: t('admin.health.upcomingAppointments'), value: upcomingAppointments, color: 'blue', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: t('admin.health.activePrescriptions'), value: activePrescriptions, color: 'green', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { label: t('admin.health.pendingLabResults'), value: pendingLabResults, color: 'purple', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
    { label: t('admin.health.pendingBills'), value: pendingBills, color: 'yellow', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  ];

  const colorClasses: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/40' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', iconBg: 'bg-green-100 dark:bg-green-900/40' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-100 dark:bg-purple-900/40' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', iconBg: 'bg-yellow-100 dark:bg-yellow-900/40' },
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-xl p-4 ${colorClasses[stat.color].bg}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[stat.color].iconBg}`}>
                <svg className={`w-5 h-5 ${colorClasses[stat.color].text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                </svg>
              </div>
              <div>
                <p className={`text-2xl font-bold ${colorClasses[stat.color].text}`}>{stat.value}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Patient Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.health.personalInformation')}</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">{t('admin.health.fullName')}</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{patientData.firstName} {patientData.lastName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">{t('admin.health.dateOfBirth')}</dt>
              <dd className="text-gray-900 dark:text-white font-medium">
                {formatDate(patientData.dateOfBirth)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">{t('admin.health.gender')}</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{tEnum(patientData.gender)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">{t('admin.health.bloodType')}</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{patientData.bloodType ? tEnum(patientData.bloodType) : t('admin.health.notRecorded')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">{t('admin.health.phone')}</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{patientData.phoneNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">{t('admin.health.email')}</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{patientData.email}</dd>
            </div>
          </dl>
        </div>

        {/* Medical Information */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.health.medicalInformation')}</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.health.allergies')}</h4>
              <div className="flex flex-wrap gap-2">
                {patientData.allergies?.length > 0 ? (
                  patientData.allergies.map((allergy, idx) => (
                    <span key={idx} className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-xs">
                      {allergy}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 text-sm">{t('admin.health.noKnownAllergies')}</span>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.health.chronicConditions')}</h4>
              <div className="flex flex-wrap gap-2">
                {patientData.chronicConditions?.length > 0 ? (
                  patientData.chronicConditions.map((condition, idx) => (
                    <span key={idx} className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs">
                      {condition}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 text-sm">{t('admin.health.noChronicConditionsRecorded')}</span>
                )}
              </div>
            </div>
            {patientData.insurance && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('admin.health.insurance')}</h4>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                  <p className="text-gray-900 dark:text-white font-medium">{patientData.insurance.provider}</p>
                  <p className="text-gray-500 dark:text-gray-400">{t('admin.health.policy', { value: patientData.insurance.policyNumber })}</p>
                  <p className="text-gray-500 dark:text-gray-400">{t('admin.health.coverage', { value: patientData.insurance.coverageType })}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Latest Vitals */}
      {patientData.vitals && patientData.vitals.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.health.latestVitalSigns')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {patientData.vitals[0]?.bloodPressure && (
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.health.bloodPressure')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{patientData.vitals[0].bloodPressure}</p>
                <p className="text-xs text-gray-400">mmHg</p>
              </div>
            )}
            {patientData.vitals[0]?.heartRate && (
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.health.heartRate')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{patientData.vitals[0].heartRate}</p>
                <p className="text-xs text-gray-400">bpm</p>
              </div>
            )}
            {patientData.vitals[0]?.temperature && (
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.health.temperature')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{patientData.vitals[0].temperature}</p>
                <p className="text-xs text-gray-400">&deg;C</p>
              </div>
            )}
            {patientData.vitals[0]?.weight && (
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.health.weight')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{patientData.vitals[0].weight}</p>
                <p className="text-xs text-gray-400">kg</p>
              </div>
            )}
            {patientData.vitals[0]?.height && (
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.health.height')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{patientData.vitals[0].height}</p>
                <p className="text-xs text-gray-400">cm</p>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {t('admin.health.lastRecorded', { date: formatDate(patientData.vitals[0].date) })}
          </p>
        </div>
      )}
    </div>
  );
}

// Appointments Tab Component
function AppointmentsTab({ appointments }: { appointments: PatientDetail['appointments'] }) {
  const { t, tEnum, formatDate, formatCurrency } = useLanguage();
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      CHECKED_IN: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      IN_PROGRESS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      COMPLETED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
      CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      NO_SHOW: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return colors[status] || colors.SCHEDULED;
  };

  if (!appointments || appointments.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{t('admin.health.noAppointments')}</h3>
        <p className="text-gray-500 dark:text-gray-400">{t('admin.health.youDonAposTHaveAny')}</p>
      </div>
    );
  }

  // Sort appointments by date (most recent first)
  const sortedAppointments = [...appointments].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-4">
      {sortedAppointments.map((appointment) => (
        <div key={appointment.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-lime-100 dark:bg-lime-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-lime-600 dark:text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDate(appointment.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {appointment.startTime} - {appointment.endTime}
                </p>
                {appointment.doctor && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    <span className="font-medium">{t('admin.health.doctorLabel')}</span> {appointment.doctor.name}
                    {appointment.doctor.department && ` (${appointment.doctor.department})`}
                  </p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span className="font-medium">{t('admin.health.reasonLabel')}</span> {appointment.reason}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                {tEnum(appointment.status)}
              </span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full text-xs font-medium">
                {tEnum(appointment.type)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Vitals Tab Component
function VitalsTab({ vitals }: { vitals: PatientDetail['vitals'] }) {
  const { t, tEnum, formatDate, formatCurrency } = useLanguage();
  if (!vitals || vitals.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{t('admin.health.noVitalSignsRecorded')}</h3>
        <p className="text-gray-500 dark:text-gray-400">{t('admin.health.yourVitalSignsHistoryWillAppear')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('admin.health.date')}</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('admin.health.bloodPressure')}</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('admin.health.heartRate')}</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('admin.health.temperature')}</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('admin.health.weight')}</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('admin.health.height')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {vitals.map((vital, idx) => (
            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                {formatDate(vital.date)}
              </td>
              <td className="py-3 px-4 text-sm text-center text-gray-900 dark:text-white">
                {vital.bloodPressure || '-'}
              </td>
              <td className="py-3 px-4 text-sm text-center text-gray-900 dark:text-white">
                {vital.heartRate ? `${vital.heartRate} bpm` : '-'}
              </td>
              <td className="py-3 px-4 text-sm text-center text-gray-900 dark:text-white">
                {vital.temperature ? `${vital.temperature}°C` : '-'}
              </td>
              <td className="py-3 px-4 text-sm text-center text-gray-900 dark:text-white">
                {vital.weight ? `${vital.weight} kg` : '-'}
              </td>
              <td className="py-3 px-4 text-sm text-center text-gray-900 dark:text-white">
                {vital.height ? `${vital.height} cm` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Lab Results Tab Component
function LabResultsTab({ labResults }: { labResults: PatientDetail['labResults'] }) {
  const { t, tEnum, formatDate, formatCurrency } = useLanguage();
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ORDERED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      SAMPLE_COLLECTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      PROCESSING: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[status] || colors.ORDERED;
  };

  if (!labResults || labResults.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{t('admin.health.noLabResults')}</h3>
        <p className="text-gray-500 dark:text-gray-400">{t('admin.health.yourLaboratoryTestResultsWillAppear')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {labResults.map((result) => (
        <div key={result.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatDate(result.date, { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(result.tests.length === 1 ? 'admin.health.testsOne' : 'admin.health.testsOther', { count: result.tests.length })}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
              {tEnum(result.status)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {result.tests.map((test, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  test.isAbnormal
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    : 'bg-white dark:bg-gray-800'
                }`}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">{test.name}</p>
                <p className={`text-lg font-bold ${
                  test.isAbnormal
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {test.result || t('admin.health.pending')}
                </p>
                {test.isAbnormal && (
                  <span className="text-xs text-red-600 dark:text-red-400">{t('admin.health.abnormal')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Prescriptions Tab Component
function PrescriptionsTab({ prescriptions }: { prescriptions: PatientDetail['prescriptions'] }) {
  const { t, tEnum, formatDate, formatCurrency } = useLanguage();
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      DISPENSED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      PARTIALLY_DISPENSED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      EXPIRED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
    };
    return colors[status] || colors.ACTIVE;
  };

  if (!prescriptions || prescriptions.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{t('admin.health.noPrescriptions')}</h3>
        <p className="text-gray-500 dark:text-gray-400">{t('admin.health.yourPrescriptionsWillAppearHere')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prescriptions.map((prescription) => (
        <div key={prescription.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatDate(prescription.date, { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              {prescription.doctor && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('admin.health.prescribedBy', { doctor: prescription.doctor })}
                </p>
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(prescription.status)}`}>
              {tEnum(prescription.status)}
            </span>
          </div>
          <div className="space-y-2">
            {prescription.medications.map((med, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-3">
                <p className="font-medium text-gray-900 dark:text-white">{med.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {med.dosage} - {med.frequency}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Consultations Tab Component
function ConsultationsTab({ patientId }: { patientId?: string }) {
  const { t, tEnum, formatDate, formatCurrency } = useLanguage();
  const [consultations, setConsultations] = useState<Array<{
    id: string;
    appointmentDate: string;
    doctorName: string;
    department: string;
    chiefComplaint: string;
    diagnosis: string[];
    followUpDate?: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConsultations = async () => {
      if (!patientId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.getConsultations({ patientId, limit: 50 });
        setConsultations(response.consultations);
      } catch (error) {
        console.error('Error fetching consultations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConsultations();
  }, [patientId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-600"></div>
      </div>
    );
  }

  if (!consultations || consultations.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{t('admin.health.noConsultations')}</h3>
        <p className="text-gray-500 dark:text-gray-400">{t('admin.health.yourConsultationHistoryWillAppearHere')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {consultations.map((consultation) => (
        <div key={consultation.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatDate(consultation.appointmentDate, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {consultation.doctorName} - {consultation.department}
              </p>
              <div className="mt-2">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{t('admin.health.chiefComplaint')}</span> {consultation.chiefComplaint}
                </p>
                {consultation.diagnosis && consultation.diagnosis.length > 0 && (
                  <div className="mt-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.health.diagnosis')}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {consultation.diagnosis.map((d, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {consultation.followUpDate && (
              <div className="text-right">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('admin.health.followUp')}</span>
                <p className="text-sm font-medium text-lime-600 dark:text-lime-400">
                  {formatDate(consultation.followUpDate)}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Billing Tab Component
/** Unpaid invoices the patient can settle themselves by Mobile Money */
function PayInvoices({ patientId, phone, onPaid }: { patientId: string; phone?: string; onPaid?: () => void }) {
  const { t, tEnum, formatCurrency, formatDate } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .getInvoices({ patientId, limit: 50 })
      .then((res) => {
        if (!cancelled) setInvoices(res.invoices.filter((inv) => patientDue(inv) > 0 && inv.status !== 'CANCELLED' && inv.status !== 'DRAFT'));
      })
      .catch(() => {
        if (!cancelled) setInvoices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, reload]);

  if (!invoices) return null;

  return (
    <div className="mb-6 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="border-b border-gray-100 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">{t('pay.portal.title')}</h3>
      </div>
      {invoices.length === 0 ? (
        <p className="p-4 text-sm text-gray-500 dark:text-gray-400">{t('pay.portal.nothingDue')}</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{t('pay.invoice', { number: inv.invoiceNumber })}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(inv.createdAt)} · {tEnum(inv.status)}
                </p>
                {isInsured(inv) && inv.payer && (
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    {t('ins.portal.covered', { payer: inv.payer.name, amount: formatCurrency(inv.insurerShare ?? 0) })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-orange-600">{formatCurrency(patientDue(inv))}</span>
                <button
                  type="button"
                  onClick={() => setPaying(inv)}
                  className="rounded-lg bg-lime-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-lime-700"
                >
                  {t('pay.portal.payNow')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {paying && (
        <MobileMoneyPayment
          isOpen
          payerIsUser
          invoice={{ id: paying.id, invoiceNumber: paying.invoiceNumber, balance: patientDue(paying), patientPhone: phone }}
          onFinished={() => {
            setReload((n) => n + 1);
            onPaid?.();
          }}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  );
}

function BillingTab({ billing }: { billing: PatientDetail['billing'] }) {
  const { t, tEnum, formatDate, formatCurrency } = useLanguage();
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
      PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      PARTIALLY_PAID: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
      REFUNDED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    };
    return colors[status] || colors.PENDING;
  };

  if (!billing || billing.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{t('admin.health.noBillingRecords')}</h3>
        <p className="text-gray-500 dark:text-gray-400">{t('admin.health.yourBillingHistoryWillAppearHere')}</p>
      </div>
    );
  }

  const totalOutstanding = billing
    .filter(bill => bill.status === 'PENDING' || bill.status === 'OVERDUE' || bill.status === 'PARTIALLY_PAID')
    .reduce((sum, bill) => sum + Number(bill.balance ?? bill.amount), 0);

  return (
    <div className="space-y-6">
      {/* Outstanding Balance */}
      {totalOutstanding > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/40 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">{t('admin.health.outstandingBalance')}</p>
              <p className="text-xl font-bold text-yellow-900 dark:text-yellow-100">
                {formatCurrency(totalOutstanding)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Billing List */}
      <div className="space-y-3">
        {billing.map((bill) => (
          <div key={bill.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{t('pay.invoice', { number: bill.description })}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(bill.date, { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900 dark:text-white">
                  {formatCurrency(bill.amount)}
                </p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bill.status)}`}>
                  {tEnum(bill.status)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
