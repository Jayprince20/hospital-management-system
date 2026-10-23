'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { api } from '@/lib/api';
import { LoadingState, ErrorState } from '@/components/ui';
import { useLanguage } from '@/context/language-context';
import { toLocalDateString } from '@/lib/formatters';
import { MyTicketCard } from '@/components/queue';
import { MyAdmissionCard } from '@/components/inpatient';

interface PatientAppointment {
  id: string;
  date: string;
  time: string;
  status: string;
  type: string;
  doctor: {
    id: string;
    name: string;
    department: string;
    profileImageUrl?: string;
  };
  reason?: string;
}

interface PatientVital {
  id: string;
  recordedAt: string;
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  oxygenSaturation?: number;
}

interface PatientPrescription {
  id: string;
  medications: string[];
  status: string;
  doctorName: string;
  createdAt: string;
}

interface PatientLabResult {
  id: string;
  testName: string;
  status: string;
  result?: string;
  isAbnormal?: boolean;
  completedAt?: string;
}

interface PatientConsultation {
  id: string;
  date: string;
  doctorName: string;
  department: string;
  chiefComplaint: string;
  diagnosis: string[];
}

export function PatientDashboard() {
  const { user } = useAuth();
  const { t, tEnum, formatDate, formatTime } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState<PatientAppointment[]>([]);
  const [recentVitals, setRecentVitals] = useState<PatientVital[]>([]);
  const [activePrescriptions, setActivePrescriptions] = useState<PatientPrescription[]>([]);
  const [recentLabResults, setRecentLabResults] = useState<PatientLabResult[]>([]);
  const [recentConsultations, setRecentConsultations] = useState<PatientConsultation[]>([]);

  const fetchPatientData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First, we need to find the patient ID
      // Try to search for patient by email if patientId is not available
      let patientId = user.patientId;

      if (!patientId && user.email) {
        try {
          const patientsRes = await api.getPatients({ search: user.email, limit: 1 });
          if (patientsRes.data && patientsRes.data.length > 0) {
            patientId = patientsRes.data[0].id;
          }
        } catch {
          // Patient search failed, continue without patient data
        }
      }

      if (!patientId) {
        // No patient record found - show empty state
        setLoading(false);
        return;
      }

      // Fetch upcoming appointments
      const today = toLocalDateString();
      try {
        const appointmentsRes = await api.getAppointments({
          patientId: patientId,
          dateFrom: today,
          limit: 5,
        });
        const closedStatuses = ['CANCELLED', 'NO_SHOW', 'COMPLETED'];
        setUpcomingAppointments((appointmentsRes.data || []).filter((apt) => !closedStatuses.includes(apt.status)).map((apt) => ({
          id: apt.id,
          date: apt.appointmentDate,
          time: apt.startTime,
          status: apt.status,
          type: apt.type,
          doctor: {
            id: apt.doctor?.id || '',
            name: `Dr. ${apt.doctor?.firstName || ''} ${apt.doctor?.lastName || ''}`.trim(),
            department: apt.doctor?.department || t('admin.patient.general'),
            profileImageUrl: apt.doctor?.profileImageUrl,
          },
          reason: apt.reason,
        })));
      } catch {
        setUpcomingAppointments([]);
      }

      // Fetch patient details including vitals
      try {
        const patientDetail = await api.getPatient(patientId);
        setRecentVitals((patientDetail.vitals || []).slice(0, 5).map((v, index) => ({
          id: `${v.date}-${index}`,
          recordedAt: v.date,
          bloodPressure: v.bloodPressure ?? undefined,
          heartRate: v.heartRate ?? undefined,
          temperature: v.temperature ?? undefined,
          weight: v.weight ?? undefined,
        })));
      } catch {
        setRecentVitals([]);
      }

      // Fetch active prescriptions
      try {
        const rxRes = await api.getPrescriptions({ patientId: patientId, limit: 5 });
        setActivePrescriptions((rxRes.prescriptions || []).map((rx) => ({
          id: rx.id,
          medications: rx.items?.map((item) => item.medication || t('admin.patient.medication')) || [],
          status: rx.status,
          doctorName: rx.doctorName,
          createdAt: rx.createdAt,
        })));
      } catch {
        setActivePrescriptions([]);
      }

      // Fetch recent lab results
      try {
        const labsRes = await api.getLabOrders({ patientId: patientId, limit: 5 });
        setRecentLabResults((labsRes.labOrders || []).flatMap((order) =>
          (order.tests || []).map((item) => ({
            id: `${order.id}-${item.id}`,
            testName: item.name || t('admin.patient.labTest'),
            status: order.status,
            result: item.result,
            isAbnormal: item.isAbnormal,
            completedAt: order.completedAt,
          }))
        ).slice(0, 5));
      } catch {
        setRecentLabResults([]);
      }

      // Fetch recent consultations
      try {
        const consultationsRes = await api.getConsultations({ patientId: patientId, limit: 5 });
        setRecentConsultations((consultationsRes.consultations || []).map((c) => ({
          id: c.id,
          date: c.appointmentDate || c.createdAt,
          doctorName: c.doctorName,
          department: c.department || t('admin.patient.general'),
          chiefComplaint: c.chiefComplaint || '',
          diagnosis: c.diagnosis || [],
        })));
      } catch {
        setRecentConsultations([]);
      }

    } catch (err) {
      setError(t('admin.patient.failedToLoadYourHealthData'));
      console.error('Patient dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    fetchPatientData();
  }, [fetchPatientData]);

  const statusColors: Record<string, string> = {
    'SCHEDULED': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400',
    'CONFIRMED': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-400',
    'CHECKED_IN': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-400',
    'COMPLETED': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    'CANCELLED': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-400',
    'ACTIVE': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400',
    'DISPENSED': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-400',
    'PROCESSING': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-400',
  };

  if (loading) {
    return <LoadingState label={t('admin.patient.loadingYourHealthPortal')} minHeight="h-96" />;
  }

  if (error) {
    return <ErrorState title={t('admin.patient.error')} message={error} onRetry={fetchPatientData} />;
  }

  // Check if no data loaded (no patient record found)
  const hasData = upcomingAppointments.length > 0 ||
                  recentVitals.length > 0 ||
                  activePrescriptions.length > 0 ||
                  recentLabResults.length > 0 ||
                  recentConsultations.length > 0;

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('admin.patient.welcomeBack', { name: user?.firstName || '' })}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {hasData
            ? t('admin.patient.summaryReady')
            : t('admin.patient.portalReady')}
        </p>
      </div>

      <MyTicketCard />
      <MyAdmissionCard />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{upcomingAppointments.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.patient.upcomingAppointments')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {activePrescriptions.filter(p => p.status === 'ACTIVE').length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.patient.activePrescriptions')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {recentLabResults.filter(l => l.status === 'PROCESSING').length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.patient.pendingLabResults')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{recentConsultations.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.patient.pastVisits')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Appointments */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.patient.upcomingAppointments')}</h2>
            <Link
              href="/dashboard/appointments/new"
              className="px-3 py-1.5 bg-lime-600 text-white text-sm font-medium rounded-lg hover:bg-lime-700 transition-colors"
            >
              {t('admin.patient.bookAppointment')}
            </Link>
          </div>

          {upcomingAppointments.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 mb-4">{t('admin.patient.noUpcomingAppointments')}</p>
              <Link
                href="/dashboard/appointments/new"
                className="inline-flex items-center gap-2 text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('admin.patient.bookAnAppointment')}
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {upcomingAppointments.map((apt) => (
                <div key={apt.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[80px] bg-lime-50 dark:bg-lime-900/30 rounded-lg p-2">
                        <p className="text-sm font-medium text-lime-700 dark:text-lime-400">
                          {formatDate(apt.date, { month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-lg font-bold text-lime-800 dark:text-lime-300">{formatTime(apt.time)}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {apt.doctor.name.replace('Dr. ', '').split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{apt.doctor.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {apt.doctor.department} • {tEnum(apt.type)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[apt.status]}`}>
                        {tEnum(apt.status)}
                      </span>
                      <Link
                        href={`/dashboard/appointments/${apt.id}`}
                        className="text-lime-600 dark:text-lime-400 hover:text-lime-500 text-sm font-medium"
                      >
                        {t('admin.patient.view')}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions for Patient */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.patient.quickAccess')}</h2>
            </div>
            <div className="p-4 space-y-2">
              <Link
                href="/dashboard/appointments/new"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.patient.bookAppointment')}</span>
              </Link>
              <Link
                href="/dashboard/my-health"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.patient.myHealthPortal')}</span>
              </Link>
              <Link
                href="/dashboard/appointments"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.patient.myAppointments')}</span>
              </Link>
              <Link
                href="/dashboard/doctors"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.patient.findADoctor')}</span>
              </Link>
              <Link
                href="/dashboard/departments"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.patient.departments')}</span>
              </Link>
            </div>
          </div>

          {/* Latest Vitals */}
          {recentVitals.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.patient.latestVitals')}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('admin.patient.recorded', { date: formatDate(recentVitals[0].recordedAt) })}
                </p>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                {recentVitals[0].bloodPressure && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{recentVitals[0].bloodPressure}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin.patient.bloodPressure')}</p>
                  </div>
                )}
                {recentVitals[0].heartRate && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{recentVitals[0].heartRate}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin.patient.heartRateBpm')}</p>
                  </div>
                )}
                {recentVitals[0].temperature && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{recentVitals[0].temperature}°C</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin.patient.temperature')}</p>
                  </div>
                )}
                {recentVitals[0].oxygenSaturation && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{recentVitals[0].oxygenSaturation}%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin.patient.oxygenSaturation')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Consultations & Lab Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Recent Consultations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.patient.recentVisits')}</h2>
            <Link href="/dashboard/my-health" className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium">
              {t('admin.patient.viewAll')}
            </Link>
          </div>
          {recentConsultations.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              {t('admin.patient.noConsultationRecordsYet')}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentConsultations.map((consultation) => (
                <Link
                  key={consultation.id}
                  href={`/dashboard/records/${consultation.id}`}
                  className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{consultation.doctorName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{consultation.department}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {consultation.chiefComplaint || t('admin.patient.generalConsultation')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(consultation.date)}</p>
                      {consultation.diagnosis.length > 0 && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400 rounded">
                          {consultation.diagnosis[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Lab Results */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.patient.labResults')}</h2>
            <Link href="/dashboard/my-health" className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium">
              {t('admin.patient.viewAll')}
            </Link>
          </div>
          {recentLabResults.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              {t('admin.patient.noLabResultsYet')}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {recentLabResults.map((lab) => (
                <div key={lab.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{lab.testName}</p>
                      {lab.result && (
                        <p className={`text-sm ${lab.isAbnormal ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                          {t('admin.patient.result', { result: lab.result })} {lab.isAbnormal && t('admin.patient.abnormal')}
                        </p>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[lab.status] || statusColors['PROCESSING']}`}>
                      {lab.status === 'COMPLETED' ? t('admin.patient.ready') : tEnum(lab.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Prescriptions */}
      {activePrescriptions.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.patient.myPrescriptions')}</h2>
            <Link href="/dashboard/my-health" className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium">
              {t('admin.patient.viewAll')}
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {activePrescriptions.map((rx) => (
              <div key={rx.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {rx.medications.slice(0, 3).join(', ')}
                      {rx.medications.length > 3 && t('admin.patient.more', { count: rx.medications.length - 3 })}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('admin.patient.prescribedBy', { doctor: rx.doctorName, date: formatDate(rx.createdAt) })}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[rx.status]}`}>
                    {tEnum(rx.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
