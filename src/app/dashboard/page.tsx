'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { api, DashboardData, DashboardAppointment } from '@/lib/api';
import { LoadingState, ErrorState } from '@/components/ui';
import { PermissionGate } from '@/components/permission-gate';
import { formatTime, formatRelativeTime, formatAppointmentStatus } from '@/lib/formatters';
import { roleQuickActions, roleDescriptions, UserRole, hasPermission } from '@/lib/rbac';
import {
  AdminDashboard,
  DoctorDashboard,
  PatientDashboard,
  NurseDashboard,
  PharmacistDashboard,
  LabTechDashboard,
  ReceptionistDashboard,
} from '@/components/dashboards';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const dashboardData = await api.getDashboardStats();
      setData(dashboardData);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const formatGrowth = (value: number) => {
    if (value > 0) return `+${value}%`;
    if (value < 0) return `${value}%`;
    return '0%';
  };

  const getGrowthColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const statusColors: Record<string, string> = {
    'SCHEDULED': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    'CONFIRMED': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400',
    'CHECKED_IN': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-400',
    'IN_PROGRESS': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-400',
    'COMPLETED': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-400',
    'CANCELLED': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-400',
    'NO_SHOW': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-400',
  };

  // formatTime, formatRelativeTime, and formatAppointmentStatus imported from @/lib/formatters

  if (loading && !data) {
    return <LoadingState label={t('common.loading')} minHeight="h-96" />;
  }

  if (error && !data) {
    return (
      <ErrorState
        title="Failed to load dashboard"
        message={error}
        onRetry={fetchDashboardData}
        className="h-96 flex flex-col justify-center"
      />
    );
  }

  // Render role-specific dashboards for non-admin roles
  const userRole = user?.role as UserRole;

  if (userRole === 'DOCTOR') {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.welcome')}, Dr. {user?.lastName || 'Doctor'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {roleDescriptions.DOCTOR}
          </p>
        </div>
        <DoctorDashboard />
      </div>
    );
  }

  if (userRole === 'PATIENT') {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.welcome')}, {user?.firstName || 'Patient'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {roleDescriptions.PATIENT}
          </p>
        </div>
        <PatientDashboard />
      </div>
    );
  }

  if (userRole === 'NURSE') {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.welcome')}, {user?.firstName || 'Nurse'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {roleDescriptions.NURSE}
          </p>
        </div>
        <NurseDashboard />
      </div>
    );
  }

  if (userRole === 'PHARMACIST') {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.welcome')}, {user?.firstName || 'Pharmacist'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {roleDescriptions.PHARMACIST}
          </p>
        </div>
        <PharmacistDashboard />
      </div>
    );
  }

  if (userRole === 'LAB_TECH') {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.welcome')}, {user?.firstName || 'Lab Technician'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {roleDescriptions.LAB_TECH}
          </p>
        </div>
        <LabTechDashboard />
      </div>
    );
  }

  if (userRole === 'RECEPTIONIST') {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.welcome')}, {user?.firstName || 'Receptionist'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {roleDescriptions.RECEPTIONIST}
          </p>
        </div>
        <ReceptionistDashboard />
      </div>
    );
  }

  // Admin dashboard with analytics and graphs
  if (userRole === 'ADMIN' && data) {
    return <AdminDashboard data={data} onRefresh={fetchDashboardData} loading={loading} />;
  }

  // Default dashboard for other roles and fallback
  const stats = data?.stats;
  const todayAppointments = data?.todayAppointments || [];
  const recentPatients = data?.recentPatients || [];
  const departmentStats = data?.departmentStats || [];

  // Build stat cards based on permissions - show only what user can access
  const allStatCards = [
    {
      label: t('dashboard.totalPatients'),
      value: stats?.patients.total.toLocaleString() || '0',
      change: formatGrowth(stats?.patients.growth || 0),
      changeColor: getGrowthColor(stats?.patients.growth || 0),
      subtext: `${stats?.patients.newThisMonth || 0} ${t('patients.newThisMonth')}`,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      color: 'bg-blue-500',
      href: '/dashboard/patients',
      permission: 'patients:view' as const,
    },
    {
      label: t('dashboard.todayAppointments'),
      value: stats?.appointments.today.toString() || '0',
      change: formatGrowth(stats?.appointments.weeklyGrowth || 0),
      changeColor: getGrowthColor(stats?.appointments.weeklyGrowth || 0),
      subtext: `${stats?.appointments.scheduled || 0} ${t('appointments.scheduled')}, ${stats?.appointments.completed || 0} ${t('appointments.completed')}`,
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: 'bg-green-500',
      href: '/dashboard/appointments',
      permission: 'appointments:view' as const,
    },
    {
      label: t('doctors.available'),
      value: stats?.doctors.available.toString() || '0',
      change: `of ${stats?.doctors.total || 0}`,
      changeColor: 'text-gray-500',
      subtext: `${stats?.doctors.departments || 0} ${t('nav.departments').toLowerCase()}`,
      icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-purple-500',
      href: '/dashboard/doctors',
      permission: 'doctors:view' as const,
    },
    {
      label: t('status.scheduled'),
      value: stats?.appointments.upcoming.toString() || '0',
      change: `${stats?.appointments.thisWeek || 0} ${t('appointments.thisWeek')}`,
      changeColor: 'text-gray-500',
      subtext: `${stats?.appointments.inProgress || 0} ${t('status.inProgress').toLowerCase()}`,
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-orange-500',
      href: '/dashboard/appointments',
      permission: 'appointments:view' as const,
    },
  ];

  // Filter stat cards based on user permissions
  const statCards = allStatCards.filter(card =>
    hasPermission(user?.role, card.permission)
  );

  // Get role-specific quick actions for admin
  const quickActions = userRole ? roleQuickActions[userRole] || [] : [];
  const roleDescription = userRole ? roleDescriptions[userRole] : '';

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.welcome')}, {user?.firstName || 'User'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {roleDescription || t('dashboard.overview')}
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('common.search')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <Link
            key={index}
            href={stat.href}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 hover:border-lime-300 dark:hover:border-lime-600 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                  <span className={`text-sm font-medium ${stat.changeColor}`}>
                    {stat.change}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{stat.subtext}</p>
              </div>
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Appointments - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('dashboard.todayAppointments')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {todayAppointments.length} {t('dashboard.appointmentsScheduled')}
              </p>
            </div>
            <Link
              href="/dashboard/appointments"
              className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium"
            >
              {t('dashboard.viewAll')}
            </Link>
          </div>
          {todayAppointments.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">{t('dashboard.noAppointmentsToday')}</p>
              <Link
                href="/dashboard/appointments/new"
                className="inline-flex items-center gap-2 mt-4 text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('dashboard.bookAppointment')}
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('table.time')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('table.patient')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('table.doctor')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('table.status')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('table.action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {todayAppointments.map((apt: DashboardAppointment) => (
                    <tr key={apt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{formatTime(apt.time)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{formatTime(apt.endTime)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center mr-3 overflow-hidden">
                            {apt.patient.profileImageUrl ? (
                              <img src={apt.patient.profileImageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                {apt.patient.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{apt.patient.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{apt.doctor.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{apt.doctor.department}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[apt.status] || statusColors['SCHEDULED']}`}>
                          {formatAppointmentStatus(apt.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/dashboard/appointments/${apt.id}`}
                          className="text-lime-600 dark:text-lime-400 hover:text-lime-900 dark:hover:text-lime-300 text-sm font-medium"
                        >
                          {t('table.view')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('dashboard.quickActions')}
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {quickActions.map((action, i) => {
                // Map color names to Tailwind classes
                const colorClasses: Record<string, { bg: string; text: string; hover: string }> = {
                  blue: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-600 dark:text-blue-400', hover: 'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20' },
                  green: { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-600 dark:text-green-400', hover: 'hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' },
                  purple: { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-600 dark:text-purple-400', hover: 'hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20' },
                  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-600 dark:text-yellow-400', hover: 'hover:border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' },
                  orange: { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-600 dark:text-orange-400', hover: 'hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20' },
                  red: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-600 dark:text-red-400', hover: 'hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' },
                  cyan: { bg: 'bg-cyan-100 dark:bg-cyan-900/50', text: 'text-cyan-600 dark:text-cyan-400', hover: 'hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20' },
                  lime: { bg: 'bg-lime-100 dark:bg-lime-900/50', text: 'text-lime-600 dark:text-lime-400', hover: 'hover:border-lime-500 hover:bg-lime-50 dark:hover:bg-lime-900/20' },
                  gray: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', hover: 'hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50' },
                };
                const colors = colorClasses[action.color] || colorClasses.lime;

                return (
                  <Link
                    key={i}
                    href={action.href}
                    className={`flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 ${colors.hover} transition-colors`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                      <svg className={`w-5 h-5 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row - Conditionally show based on permissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Recent Patients - Only show to users with patient view access */}
        <PermissionGate permission="patients:view">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('dashboard.recentActivity')}
              </h2>
              <Link
                href="/dashboard/patients"
                className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500 font-medium"
              >
                {t('dashboard.viewAll')}
              </Link>
            </div>
            <div className="p-6">
              {recentPatients.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('empty.noPatients')}</p>
              ) : (
                <div className="space-y-4">
                  {recentPatients.map((patient) => (
                    <Link
                      key={patient.id}
                      href={`/dashboard/patients/${patient.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden">
                          {patient.profileImageUrl ? (
                            <img src={patient.profileImageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                              {patient.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{patient.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{patient.patientId}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatRelativeTime(patient.createdAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PermissionGate>

        {/* Department Overview - Only show to users with department view access */}
        <PermissionGate permission="departments:view">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('dashboard.departmentOverview')}
              </h2>
            </div>
            <div className="p-6">
              {departmentStats.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('empty.noDepartments')}</p>
              ) : (
                <div className="space-y-4">
                  {departmentStats.map((dept) => (
                    <div key={dept.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{dept.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {dept.availableDoctors} {t('dashboard.of')} {dept.totalDoctors} {t('dashboard.doctorsAvailable')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{dept.appointmentsToday}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('nav.appointments').toLowerCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PermissionGate>
      </div>

      {/* Appointment Status Summary - Show to users who can view all stats */}
      <PermissionGate permission="dashboard:view_stats">
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('dashboard.appointmentsSummary')}
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.appointments.scheduled || 0}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('status.scheduled')}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats?.appointments.inProgress || 0}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('status.inProgress')}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.appointments.completed || 0}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('status.completed')}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats?.appointments.cancelled || 0}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('status.cancelled')}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-lime-50 dark:bg-lime-900/20">
                <p className="text-2xl font-bold text-lime-600 dark:text-lime-400">{stats?.appointments.today || 0}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.totalToday')}</p>
              </div>
            </div>
          </div>
        </div>
      </PermissionGate>
    </div>
  );
}
