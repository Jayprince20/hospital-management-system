'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { api } from '@/lib/api';
import { LoadingState, ErrorState } from '@/components/ui';
import { formatTime, formatDate } from '@/lib/formatters';

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
    profileImageUrl?: string;
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
      setError('Doctor profile not found. Please contact support.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch doctor's appointments for today
      const today = new Date().toISOString().split('T')[0];
      const appointmentsRes = await api.getAppointments({
        doctorId: user.doctorId,
        dateFrom: today,
        dateTo: today,
        limit: 20,
      });

      const todayAppts = appointmentsRes.data || [];
      setAppointments(todayAppts.map((apt: any) => ({
        id: apt.id,
        time: apt.startTime || apt.scheduledAt,
        endTime: apt.endTime,
        status: apt.status,
        type: apt.type,
        patient: {
          id: apt.patient?.id || '',
          name: `${apt.patient?.firstName || ''} ${apt.patient?.lastName || ''}`.trim(),
          patientId: apt.patient?.patientId || '',
          profileImageUrl: apt.patient?.profileImageUrl,
        },
        reason: apt.reason,
      })));

      // Calculate stats from appointments
      const completed = todayAppts.filter((a: any) => a.status === 'COMPLETED').length;
      const pending = todayAppts.filter((a: any) => ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'].includes(a.status)).length;
      const inProgress = todayAppts.filter((a: any) => a.status === 'IN_PROGRESS').length;

      // Fetch pending lab orders for this doctor's patients
      try {
        const labsRes = await api.getLabOrders({
          doctorId: user.doctorId,
          status: 'PROCESSING',
          limit: 5,
        });
        setPendingLabs((labsRes.labOrders || []).map((lab: any) => ({
          id: lab.id,
          patientName: `${lab.patient?.firstName || ''} ${lab.patient?.lastName || ''}`.trim(),
          testName: lab.items?.[0]?.test?.name || 'Lab Test',
          orderedAt: lab.createdAt,
          status: lab.status,
          priority: lab.priority,
        })));
      } catch {
        setPendingLabs([]);
      }

      // Fetch recent prescriptions by this doctor
      try {
        const rxRes = await api.getPrescriptions({
          doctorId: user.doctorId,
          status: 'ACTIVE',
          limit: 5,
        });
        setRecentPrescriptions((rxRes.prescriptions || []).map((rx: any) => ({
          id: rx.id,
          patientName: `${rx.patient?.firstName || ''} ${rx.patient?.lastName || ''}`.trim(),
          medications: rx.items?.map((i: any) => i.medication?.name || 'Medication') || [],
          status: rx.status,
          createdAt: rx.createdAt,
        })));
      } catch {
        setRecentPrescriptions([]);
      }

      setStats({
        todayAppointments: todayAppts.length,
        completedToday: completed,
        pendingToday: pending,
        inProgress,
        totalPatients: appointmentsRes.stats?.totalToday || 0,
        pendingLabResults: pendingLabs.length,
        activePrescriptions: recentPrescriptions.length,
      });

    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Doctor dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.doctorId]);

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
    return <LoadingState label="Loading your dashboard..." minHeight="h-96" />;
  }

  if (error) {
    return <ErrorState title="Error" message={error} onRetry={fetchDoctorData} />;
  }

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, Dr. {user?.lastName}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          You have {stats.pendingToday} patient{stats.pendingToday !== 1 ? 's' : ''} waiting today
        </p>
      </div>

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
              <p className="text-sm text-gray-500 dark:text-gray-400">Today's Appointments</p>
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Waiting Patients</p>
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Completed Today</p>
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Lab Results</p>
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Today's Patient Queue</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{appointments.length} appointments scheduled</p>
            </div>
            <Link href="/dashboard/appointments" className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium">
              View All
            </Link>
          </div>

          {appointments.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">No appointments scheduled for today</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {appointments.map((apt) => (
                <div key={apt.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{formatTime(apt.time)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{apt.type}</p>
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
                          {apt.patient.patientId} • {apt.reason || 'General Consultation'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[apt.status]}`}>
                        {apt.status.replace('_', ' ')}
                      </span>
                      {apt.status === 'CHECKED_IN' && (
                        <Link
                          href={`/dashboard/consultations/new?appointmentId=${apt.id}`}
                          className="px-3 py-1.5 bg-lime-600 text-white text-sm font-medium rounded-lg hover:bg-lime-700 transition-colors"
                        >
                          Start Consultation
                        </Link>
                      )}
                      {apt.status === 'IN_PROGRESS' && (
                        <Link
                          href={`/dashboard/consultations/new?appointmentId=${apt.id}`}
                          className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          Continue
                        </Link>
                      )}
                      {['SCHEDULED', 'CONFIRMED'].includes(apt.status) && (
                        <Link
                          href={`/dashboard/appointments/${apt.id}`}
                          className="px-3 py-1.5 text-gray-600 dark:text-gray-400 text-sm font-medium hover:text-lime-600 dark:hover:text-lime-400"
                        >
                          View
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
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
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Manage My Schedule</span>
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
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Write Prescription</span>
              </Link>
              <Link
                href="/dashboard/lab-orders/new"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Order Lab Test</span>
              </Link>
              <Link
                href="/dashboard/patients"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">My Patients</span>
              </Link>
            </div>
          </div>

          {/* Pending Lab Results */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pending Lab Results</h2>
              <Link href="/dashboard/lab-results" className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium">
                View All
              </Link>
            </div>
            {pendingLabs.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No pending lab results
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {pendingLabs.map((lab) => (
                  <Link
                    key={lab.id}
                    href={`/dashboard/laboratory/${lab.id}`}
                    className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{lab.patientName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{lab.testName}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColors[lab.priority]}`}>
                        {lab.priority}
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Prescriptions</h2>
          <Link href="/dashboard/prescriptions" className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium">
            View All
          </Link>
        </div>
        {recentPrescriptions.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            No recent prescriptions
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Medications</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentPrescriptions.map((rx) => (
                  <tr key={rx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{rx.patientName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {rx.medications.slice(0, 2).join(', ')}
                      {rx.medications.length > 2 && ` +${rx.medications.length - 2} more`}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        rx.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400' :
                        rx.status === 'DISPENSED' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-400' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {rx.status}
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
