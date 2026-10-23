'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { api, Appointment } from '@/lib/api';
import { LoadingState, ErrorState } from '@/components/ui';
import { useLanguage } from '@/context/language-context';
import { DoctorQueueCard } from '@/components/queue';
import { DoctorImagingCard } from '@/components/imaging';
import { DoctorLabCriticalCard } from '@/components/lab';

interface DoctorAppointment {
  id: string;
  time: string;
  endTime: string;
  status: string;
  type: string;
  patient: {
    id: string;
    name: string;
    patientId: string;
  };
  reason?: string;
}

interface DoctorStats {
  todayAppointments: number;
  completedToday: number;
  pendingToday: number;
  inProgress: number;
  totalPatients: number;
  pendingLabResults: number;
  activePrescriptions: number;
}

interface PendingLabResult {
  id: string;
  patientName: string;
  testName: string;
  orderedAt: string;
  status: string;
  priority: string;
}

interface RecentPrescription {
  id: string;
  patientName: string;
  medications: string[];
  status: string;
  createdAt: string;
}

export function DoctorDashboard() {
  const { user } = useAuth();
  const { t, tEnum, formatTime, formatDate } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DoctorStats>({
    todayAppointments: 0,
    completedToday: 0,
    pendingToday: 0,
    inProgress: 0,
    totalPatients: 0,
    pendingLabResults: 0,
    activePrescriptions: 0,
  });
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [pendingLabs, setPendingLabs] = useState<PendingLabResult[]>([]);
  const [recentPrescriptions, setRecentPrescriptions] = useState<RecentPrescription[]>([]);

  const fetchDoctorData = useCallback(async () => {
    if (!user?.doctorId) {
      setLoading(false);
      setError(t('clinical.doctorDashboard.noProfile'));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Today's appointments. Dates are stored at local midnight, so query the
      // full local day rather than a bare YYYY-MM-DD (which is parsed as UTC).
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date();
      dayEnd.setHours(23, 59, 59, 999);
      const appointmentsRes = await api.getAppointments({
        doctorId: user.doctorId,
        dateFrom: dayStart.toISOString(),
        dateTo: dayEnd.toISOString(),
        limit: 50,
      });

      const todayAppts: Appointment[] = (appointmentsRes.data || [])
        .slice()
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      setAppointments(todayAppts.map((apt) => ({
        id: apt.id,
        time: apt.startTime,
        endTime: apt.endTime,
        status: apt.status,
        type: apt.type,
        patient: {
          id: apt.patient?.id || '',
          name: `${apt.patient?.firstName || ''} ${apt.patient?.lastName || ''}`.trim(),
          patientId: apt.patient?.patientId || '',
        },
        reason: apt.reason,
      })));

      const completed = todayAppts.filter((a) => a.status === 'COMPLETED').length;
      const pending = todayAppts.filter((a) => ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'].includes(a.status)).length;
      const inProgress = todayAppts.filter((a) => a.status === 'IN_PROGRESS').length;

      // Lab orders still awaiting results (ordered, collected or processing)
      let labs: PendingLabResult[] = [];
      try {
        const labsRes = await api.getLabOrders({ doctorId: user.doctorId, limit: 50 });
        labs = (labsRes.labOrders || [])
          .filter((lab) => !['COMPLETED', 'CANCELLED'].includes(lab.status))
          .map((lab) => ({
            id: lab.id,
            patientName: lab.patientName,
            testName: lab.tests.map((test) => test.name).join(', ') || t('clinical.doctorDashboard.labTest'),
            orderedAt: lab.createdAt,
            status: lab.status,
            priority: lab.priority,
          }));
      } catch {
        labs = [];
      }
      setPendingLabs(labs.slice(0, 5));

      // Active prescriptions written by this doctor
      let prescriptions: RecentPrescription[] = [];
      try {
        const rxRes = await api.getPrescriptions({ doctorId: user.doctorId, status: 'ACTIVE', limit: 5 });
        prescriptions = (rxRes.prescriptions || []).map((rx) => ({
          id: rx.id,
          patientName: rx.patientName,
          medications: rx.items.map((item) => item.medication),
          status: rx.status,
          createdAt: rx.createdAt,
        }));
      } catch {
        prescriptions = [];
      }
      setRecentPrescriptions(prescriptions);

      setStats({
        todayAppointments: todayAppts.length,
        completedToday: completed,
        pendingToday: pending,
        inProgress,
        totalPatients: 0,
        pendingLabResults: labs.length,
        activePrescriptions: prescriptions.length,
      });

    } catch (err) {
      setError(t('clinical.doctorDashboard.loadFailed'));
      console.error('Doctor dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.doctorId, t]);

  useEffect(() => {
    fetchDoctorData();
    const interval = setInterval(fetchDoctorData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchDoctorData]);

  const statusColors: Record<string, string> = {
    'SCHEDULED': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    'CONFIRMED': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400',
    'CHECKED_IN': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-400',
    'IN_PROGRESS': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-400',
    'COMPLETED': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-400',
    'CANCELLED': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-400',
  };

  const priorityColors: Record<string, string> = {
    'STAT': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-400',
    'URGENT': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-400',
    'ROUTINE': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };

  if (loading) {
    return <LoadingState label={t('clinical.doctorDashboard.loading')} minHeight="h-96" />;
  }

  if (error) {
    return <ErrorState title={t('clinical.doctorDashboard.errorTitle')} message={error} onRetry={fetchDoctorData} />;
  }

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t(new Date().getHours() < 12 ? 'clinical.doctorDashboard.goodMorning' : new Date().getHours() < 18 ? 'clinical.doctorDashboard.goodAfternoon' : 'clinical.doctorDashboard.goodEvening', { name: user?.lastName || '' })}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t(stats.pendingToday === 1 ? 'clinical.doctorDashboard.waitingOne' : 'clinical.doctorDashboard.waitingMany', { count: stats.pendingToday })}
        </p>
      </div>

      <DoctorQueueCard />
      <DoctorImagingCard />
      <DoctorLabCriticalCard />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.todayAppointments}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('doctors.todayAppointments')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingToday}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('clinical.doctorDashboard.waitingPatients')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.completedToday}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('clinical.doctorDashboard.completedToday')}</p>
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
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{pendingLabs.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('clinical.doctorDashboard.pendingLabResults')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Patient Queue - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('clinical.doctorDashboard.queue')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t(appointments.length === 1 ? 'clinical.doctorDashboard.scheduledOne' : 'clinical.doctorDashboard.scheduledMany', { count: appointments.length })}</p>
            </div>
            <Link href="/dashboard/appointments" className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium">
              {t('clinical.doctorDashboard.viewAll')}
            </Link>
          </div>

          {appointments.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">{t('clinical.consultations.noAppointmentsToday')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {appointments.map((apt) => (
                <div key={apt.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{formatTime(apt.time)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{tEnum(apt.type)}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime-500 to-blue-500 flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {apt.patient.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <Link
                          href={`/dashboard/patients/${apt.patient.id}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-lime-600 dark:hover:text-lime-400"
                        >
                          {apt.patient.name}
                        </Link>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {apt.patient.patientId} • {apt.reason || t('clinical.doctorDashboard.generalConsultation')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[apt.status]}`}>
                        {tEnum(apt.status)}
                      </span>
                      {apt.status === 'CHECKED_IN' && (
                        <Link
                          href={`/dashboard/consultations/new?appointmentId=${apt.id}`}
                          className="px-3 py-1.5 bg-lime-600 text-white text-sm font-medium rounded-lg hover:bg-lime-700 transition-colors"
                        >
                          {t('clinical.consultations.start')}
                        </Link>
                      )}
                      {apt.status === 'IN_PROGRESS' && (
                        <Link
                          href={`/dashboard/consultations/new?appointmentId=${apt.id}`}
                          className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          {t('clinical.doctorDashboard.continue')}
                        </Link>
                      )}
                      {['SCHEDULED', 'CONFIRMED'].includes(apt.status) && (
                        <Link
                          href={`/dashboard/appointments/${apt.id}`}
                          className="px-3 py-1.5 text-gray-600 dark:text-gray-400 text-sm font-medium hover:text-lime-600 dark:hover:text-lime-400"
                        >
                          {t('clinical.doctorDashboard.view')}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions & Pending Items */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('clinical.doctorDashboard.quickActions')}</h2>
            </div>
            <div className="p-4 space-y-2">
              <Link
                href="/dashboard/schedule"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('clinical.doctorDashboard.manageSchedule')}</span>
              </Link>
              <Link
                href="/dashboard/prescriptions/new"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('clinical.doctorDashboard.writePrescription')}</span>
              </Link>
              <Link
                href="/dashboard/laboratory/orders/new"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('clinical.doctorDashboard.orderLabTest')}</span>
              </Link>
              <Link
                href="/dashboard/my-patients"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('nav.myPatients')}</span>
              </Link>
            </div>
          </div>

          {/* Pending Lab Results */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('clinical.doctorDashboard.pendingLabResults')}</h2>
              <Link href="/dashboard/lab-results" className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium">
                {t('clinical.doctorDashboard.viewAll')}
              </Link>
            </div>
            {pendingLabs.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                {t('clinical.doctorDashboard.noPendingLabs')}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {pendingLabs.map((lab) => (
                  <Link
                    key={lab.id}
                    href={`/dashboard/laboratory/orders/${lab.id}`}
                    className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{lab.patientName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{lab.testName}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColors[lab.priority]}`}>
                        {tEnum(lab.priority)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Prescriptions */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('clinical.doctorDashboard.recentPrescriptions')}</h2>
          <Link href="/dashboard/prescriptions" className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium">
            {t('clinical.doctorDashboard.viewAll')}
          </Link>
        </div>
        {recentPrescriptions.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            {t('clinical.doctorDashboard.noRecentPrescriptions')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('clinical.common.patient')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('clinical.doctorDashboard.medications')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('clinical.doctorDashboard.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('clinical.common.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentPrescriptions.map((rx) => (
                  <tr key={rx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{rx.patientName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {rx.medications.slice(0, 2).join(', ')}
                      {rx.medications.length > 2 && ` ${t('clinical.doctorDashboard.more', { count: rx.medications.length - 2 })}`}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        rx.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400' :
                        rx.status === 'DISPENSED' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-400' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {tEnum(rx.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(rx.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
