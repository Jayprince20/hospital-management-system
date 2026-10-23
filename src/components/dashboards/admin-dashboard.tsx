'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, DashboardData, PaymentStats } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const COLORS = ['#84cc16', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface AdminDashboardProps {
  data: DashboardData;
  onRefresh: () => void;
  loading: boolean;
}

export function AdminDashboard({ data, onRefresh, loading }: AdminDashboardProps) {
  const { t, tEnum, formatCurrency, formatTime, locale, formatNumber } = useLanguage();
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(true);

  useEffect(() => {
    const fetchPaymentStats = async () => {
      try {
        setLoadingPayments(true);
        const stats = await api.getPaymentStats();
        setPaymentStats(stats);
      } catch (err) {
        console.error('Error fetching payment stats:', err);
      } finally {
        setLoadingPayments(false);
      }
    };
    fetchPaymentStats();
  }, []);

  const stats = data?.stats;

  // The API labels months in English ("Oct 26"); re-render them in the UI language
  const formatMonthLabel = (label: string) => {
    const [mon, yy] = String(label).split(' ');
    const monthIndex = EN_MONTHS.indexOf(mon);
    if (monthIndex < 0 || !yy) return label;
    return new Date(2000 + Number(yy), monthIndex, 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  };
  const todayAppointments = data?.todayAppointments || [];
  const departmentStats = data?.departmentStats || [];

  // Mock data for appointment trends (in a real app, this would come from API)
  const appointmentTrends = [
    { day: t('admin.day.mon'), scheduled: 45, completed: 38, cancelled: 3 },
    { day: t('admin.day.tue'), scheduled: 52, completed: 45, cancelled: 4 },
    { day: t('admin.day.wed'), scheduled: 48, completed: 42, cancelled: 2 },
    { day: t('admin.day.thu'), scheduled: 55, completed: 48, cancelled: 5 },
    { day: t('admin.day.fri'), scheduled: 60, completed: 52, cancelled: 3 },
    { day: t('admin.day.sat'), scheduled: 35, completed: 30, cancelled: 2 },
    { day: t('admin.day.sun'), scheduled: 20, completed: 18, cancelled: 1 },
  ];

  // Appointment status distribution
  const appointmentStatusData = [
    { name: tEnum('COMPLETED'), value: stats?.appointments.completed || 0, color: '#22c55e' },
    { name: tEnum('SCHEDULED'), value: stats?.appointments.scheduled || 0, color: '#3b82f6' },
    { name: tEnum('IN_PROGRESS'), value: stats?.appointments.inProgress || 0, color: '#f59e0b' },
    { name: tEnum('CANCELLED'), value: stats?.appointments.cancelled || 0, color: '#ef4444' },
  ];

  // Department performance data
  const departmentData = departmentStats.map((dept, index) => ({
    name: dept.name,
    doctors: dept.totalDoctors || 0,
    available: dept.availableDoctors || 0,
    appointments: dept.appointmentsToday || 0,
    color: COLORS[index % COLORS.length],
  }));

  const statusColors: Record<string, string> = {
    'SCHEDULED': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    'CONFIRMED': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400',
    'CHECKED_IN': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-400',
    'IN_PROGRESS': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-400',
    'COMPLETED': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-400',
    'CANCELLED': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admin.dash.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('admin.dash.subtitle')}</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('admin.common.refresh')}
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('admin.dash.totalPatients')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(stats?.patients.total || 0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('admin.dash.todayAppointments')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.appointments.today || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('admin.dash.activeDoctors')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.doctors.available || 0}/{stats?.doctors.total || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('admin.dash.departments')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.doctors.departments || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-lime-100 dark:bg-lime-900/50 rounded-lg">
              <svg className="w-5 h-5 text-lime-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{t('admin.dash.todayRevenue')}</p>
              <p
                className="text-base xl:text-lg font-bold leading-tight text-gray-900 dark:text-white break-words"
                title={loadingPayments ? undefined : formatCurrency(paymentStats?.summary.todayAmount || 0)}
              >
                {loadingPayments ? '...' : formatCurrency(paymentStats?.summary.todayAmount || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('admin.dash.pending')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.appointments.scheduled || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.dash.revenueTrend')}</h2>
            <Link href="/dashboard/payments" className="text-sm text-lime-600 hover:text-lime-700">{t('admin.common.viewDetails')}</Link>
          </div>
          <div className="h-[250px]">
            {loadingPayments ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-600"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={paymentStats?.dailyTrend || []}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#84cc16" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#84cc16" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickFormatter={(v) => new Date(v).toLocaleDateString(locale, { month: 'short', day: 'numeric' })} />
                  <YAxis stroke="#9ca3af" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => [formatCurrency(value as number), t('admin.dash.revenue')]} />
                  <Area type="monotone" dataKey="amount" stroke="#84cc16" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Appointment Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.dash.appointmentStatus')}</h2>
            <Link href="/dashboard/appointments" className="text-sm text-lime-600 hover:text-lime-700">{t('admin.common.viewAll')}</Link>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={appointmentStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {appointmentStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Appointments */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.dash.weeklyAppointments')}</h2>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={appointmentTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" name={tEnum('COMPLETED')} fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="scheduled" name={tEnum('SCHEDULED')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cancelled" name={tEnum('CANCELLED')} fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Performance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.dash.departmentActivity')}</h2>
            <Link href="/dashboard/departments" className="text-sm text-lime-600 hover:text-lime-700">{t('admin.common.viewAll')}</Link>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={11} width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="appointments" name={t('admin.dash.todayAppointments')} fill="#84cc16" radius={[0, 4, 4, 0]} />
                <Bar dataKey="doctors" name={t('admin.dash.totalDoctors')} fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Revenue */}
      {!loadingPayments && paymentStats && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.dash.monthlyRevenue')}</h2>
            <Link href="/dashboard/payments" className="text-sm text-lime-600 hover:text-lime-700">{t('admin.dash.fullReport')}</Link>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentStats.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickFormatter={formatMonthLabel} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip labelFormatter={(label) => formatMonthLabel(label as string)} formatter={(value, _name, item) => [item?.dataKey === 'amount' ? formatCurrency(value as number) : value, item?.dataKey === 'amount' ? t('admin.dash.revenue') : t('admin.dash.payments')]} />
                <Legend />
                <Bar dataKey="amount" name={t('admin.dash.revenue')} fill="#84cc16" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bottom Row - Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.dash.todayAppointments')}</h2>
            <span className="text-sm text-gray-500">{t('admin.dash.scheduledCount', { count: todayAppointments.length })}</span>
          </div>
          <div className="overflow-x-auto max-h-[300px]">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.common.time')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.common.patient')}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {todayAppointments.slice(0, 8).map((apt) => (
                  <tr key={apt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                      {formatTime(apt.time)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{apt.patient.name}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[apt.status]}`}>
                        {tEnum(apt.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {todayAppointments.length === 0 && (
              <p className="text-center text-gray-500 py-8">{t('admin.dash.noAppointmentsToday')}</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.dash.quickActions')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/dashboard/patients/new"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-lime-500 hover:bg-lime-50 dark:hover:bg-lime-900/20 transition-colors"
            >
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.dash.addPatient')}</span>
            </Link>

            <Link
              href="/dashboard/appointments/new"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-lime-500 hover:bg-lime-50 dark:hover:bg-lime-900/20 transition-colors"
            >
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.dash.newAppointment')}</span>
            </Link>

            <Link
              href="/dashboard/billing?new=1"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-lime-500 hover:bg-lime-50 dark:hover:bg-lime-900/20 transition-colors"
            >
              <div className="p-2 bg-lime-100 dark:bg-lime-900/50 rounded-lg">
                <svg className="w-5 h-5 text-lime-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.dash.createInvoice')}</span>
            </Link>

            <Link
              href="/dashboard/reports"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-lime-500 hover:bg-lime-50 dark:hover:bg-lime-900/20 transition-colors"
            >
              <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.dash.viewReports')}</span>
            </Link>

            <Link
              href="/dashboard/users"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-lime-500 hover:bg-lime-50 dark:hover:bg-lime-900/20 transition-colors"
            >
              <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.dash.manageUsers')}</span>
            </Link>

            <Link
              href="/dashboard/payments"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-lime-500 hover:bg-lime-50 dark:hover:bg-lime-900/20 transition-colors"
            >
              <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.dash.paymentAnalytics')}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
