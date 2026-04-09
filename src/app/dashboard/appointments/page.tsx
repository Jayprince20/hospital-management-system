'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, Appointment, AppointmentFilters, AppointmentsResponse, AppointmentStatus, AppointmentType } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-modal';
import { useLanguage } from '@/context/language-context';
import { TableSkeleton } from '@/components/ui';
import { formatDate as formatDateBase, formatTime, getStatusColorClasses } from '@/lib/formatters';
import { PermissionGate } from '@/components/permission-gate';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function AppointmentsPage() {
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({
    totalToday: 0,
    scheduledToday: 0,
    completedToday: 0,
    cancelledToday: 0,
    totalThisWeek: 0,
    upcomingCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AppointmentType | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAppointments, setTotalAppointments] = useState(0);
  const itemsPerPage = 10;

  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const getDateRange = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (dateFilter) {
      case 'today': {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { dateFrom: today.toISOString(), dateTo: tomorrow.toISOString() };
      }
      case 'week': {
        const endOfWeek = new Date(today);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        return { dateFrom: today.toISOString(), dateTo: endOfWeek.toISOString() };
      }
      case 'month': {
        const endOfMonth = new Date(today);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        return { dateFrom: today.toISOString(), dateTo: endOfMonth.toISOString() };
      }
      default:
        return {};
    }
  }, [dateFilter]);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const dateRange = getDateRange();
      const filters: AppointmentFilters = {
        page: currentPage,
        limit: itemsPerPage,
        ...dateRange,
      };

      if (debouncedSearch) filters.search = debouncedSearch;
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (typeFilter !== 'all') filters.type = typeFilter;

      const response: AppointmentsResponse = await api.getAppointments(filters);

      setAppointments(response.data);
      setStats(response.stats);
      setTotalPages(response.totalPages);
      setTotalAppointments(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, typeFilter, dateFilter, currentPage, getDateRange]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, typeFilter, dateFilter]);

  const handleStatusChange = async (id: string, newStatus: AppointmentStatus) => {
    try {
      await api.updateAppointment(id, { status: newStatus });
      toast.success('Status updated', `Appointment status changed to ${newStatus.replace('_', ' ').toLowerCase()}.`);
      fetchAppointments();
    } catch (err) {
      toast.error('Update failed', err instanceof Error ? err.message : 'Failed to update appointment');
    }
  };

  const handleDelete = async (id: string, patientName: string) => {
    const confirmed = await confirm({
      title: 'Delete Appointment',
      message: `Are you sure you want to delete the appointment for ${patientName}? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await api.deleteAppointment(id);
      toast.success('Appointment deleted', `Appointment for ${patientName} has been removed.`);
      fetchAppointments();
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Failed to delete appointment');
    } finally {
      setIsDeleting(false);
    }
  };

  // Custom date format with weekday for appointments
  const formatDate = (dateString: string) => formatDateBase(dateString, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const typeIcons: Record<AppointmentType, string> = {
    IN_PERSON: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    VIDEO: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    PHONE: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('appointments.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('appointments.subtitle')}</p>
        </div>
        <PermissionGate permission="appointments:create">
          <Link
            href="/dashboard/appointments/new"
            className="bg-lime-600 text-white px-4 py-2 rounded-lg hover:bg-lime-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('appointments.new')}
          </Link>
        </PermissionGate>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('appointments.todayTotal')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalToday}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-lime-100 dark:bg-lime-900/50 rounded-lg">
              <svg className="w-6 h-6 text-lime-600 dark:text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('appointments.scheduled')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.scheduledToday}</p>
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
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('appointments.completed')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completedToday}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('appointments.thisWeek')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalThisWeek}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status Distribution Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Today&apos;s Status Distribution</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Scheduled', value: stats.scheduledToday, color: '#84cc16' },
                    { name: 'Completed', value: stats.completedToday, color: '#22c55e' },
                    { name: 'Cancelled', value: stats.cancelledToday, color: '#ef4444' },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  <Cell fill="#84cc16" />
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Overview Bar Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appointment Overview</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Today', total: stats.totalToday, completed: stats.completedToday },
                  { name: 'This Week', total: stats.totalThisWeek, completed: Math.round(stats.totalThisWeek * 0.6) },
                  { name: 'Upcoming', total: stats.upcomingCount, completed: 0 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={t('filter.searchPlaceholder')}
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
            <option value="all">{t('filter.allDates')}</option>
            <option value="today">{t('filter.today')}</option>
            <option value="week">{t('filter.thisWeek')}</option>
            <option value="month">{t('filter.thisMonth')}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | 'all')}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
          >
            <option value="all">{t('filter.allStatus')}</option>
            <option value="SCHEDULED">{t('status.scheduled')}</option>
            <option value="CONFIRMED">{t('status.confirmed')}</option>
            <option value="CHECKED_IN">{t('status.checkedIn')}</option>
            <option value="IN_PROGRESS">{t('status.inProgress')}</option>
            <option value="COMPLETED">{t('status.completed')}</option>
            <option value="CANCELLED">{t('status.cancelled')}</option>
            <option value="NO_SHOW">{t('status.noShow')}</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AppointmentType | 'all')}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
          >
            <option value="all">{t('filter.allTypes')}</option>
            <option value="IN_PERSON">{t('appointments.inPerson')}</option>
            <option value="VIDEO">{t('appointments.video')}</option>
            <option value="PHONE">{t('appointments.phone')}</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
          {error}
          <button onClick={fetchAppointments} className="ml-2 underline">{t('appointments.retry')}</button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <TableSkeleton rows={5} columns={7} />
        </div>
      ) : (
        <>
          {/* Appointments Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('table.dateTime')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('table.patient')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('table.doctor')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('table.type')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('table.reason')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('table.status')}</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{t('table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {appointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(appointment.appointmentDate)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300">
                            {appointment.patient.firstName[0]}{appointment.patient.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {appointment.patient.firstName} {appointment.patient.lastName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{appointment.patient.patientId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{appointment.doctor.department}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeIcons[appointment.type]} />
                          </svg>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {appointment.type === 'IN_PERSON' ? t('appointments.inPerson') :
                             appointment.type === 'VIDEO' ? t('appointments.video') : t('appointments.phone')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">{appointment.reason}</p>
                      </td>
                      <td className="px-6 py-4">
                        <PermissionGate
                          permission="appointments:edit"
                          fallback={
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColorClasses(appointment.status)}`}>
                              {appointment.status === 'SCHEDULED' ? t('status.scheduled') :
                               appointment.status === 'CONFIRMED' ? t('status.confirmed') :
                               appointment.status === 'CHECKED_IN' ? t('status.checkedIn') :
                               appointment.status === 'IN_PROGRESS' ? t('status.inProgress') :
                               appointment.status === 'COMPLETED' ? t('status.completed') :
                               appointment.status === 'CANCELLED' ? t('status.cancelled') : t('status.noShow')}
                            </span>
                          }
                        >
                          <select
                            value={appointment.status}
                            onChange={(e) => handleStatusChange(appointment.id, e.target.value as AppointmentStatus)}
                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${getStatusColorClasses(appointment.status)}`}
                          >
                            <option value="SCHEDULED">{t('status.scheduled')}</option>
                            <option value="CONFIRMED">{t('status.confirmed')}</option>
                            <option value="CHECKED_IN">{t('status.checkedIn')}</option>
                            <option value="IN_PROGRESS">{t('status.inProgress')}</option>
                            <option value="COMPLETED">{t('status.completed')}</option>
                            <option value="CANCELLED">{t('status.cancelled')}</option>
                            <option value="NO_SHOW">{t('status.noShow')}</option>
                          </select>
                        </PermissionGate>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/dashboard/appointments/${appointment.id}`}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50"
                            title={t('table.view')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          <PermissionGate permission="appointments:edit">
                            <Link
                              href={`/dashboard/appointments/${appointment.id}/edit`}
                              className="p-2 text-gray-400 hover:text-lime-600 dark:hover:text-lime-400 rounded-lg hover:bg-lime-50 dark:hover:bg-lime-900/50"
                              title={t('common.edit')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Link>
                          </PermissionGate>
                          <PermissionGate permission="appointments:cancel">
                            <button
                              onClick={() => handleDelete(appointment.id, `${appointment.patient.firstName} ${appointment.patient.lastName}`)}
                              disabled={isDeleting}
                              className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50 disabled:opacity-50"
                              title={t('common.delete')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Empty State */}
          {appointments.length === 0 && !loading && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('appointments.noAppointmentsFound')}</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || dateFilter !== 'all'
                  ? t('appointments.adjustFilters')
                  : t('appointments.getStarted')}
              </p>
              <PermissionGate permission="appointments:create">
                <Link
                  href="/dashboard/appointments/new"
                  className="inline-flex items-center gap-2 bg-lime-600 text-white px-4 py-2 rounded-lg hover:bg-lime-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('appointments.new')}
                </Link>
              </PermissionGate>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 px-4 py-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('table.showing')} {((currentPage - 1) * itemsPerPage) + 1} {t('table.to')} {Math.min(currentPage * itemsPerPage, totalAppointments)} {t('table.ofTotal')} {totalAppointments} {t('nav.appointments').toLowerCase()}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('common.previous')}
                </button>
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 border rounded-lg text-sm ${
                        currentPage === pageNum
                          ? 'bg-lime-600 text-white border-lime-600'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
}
