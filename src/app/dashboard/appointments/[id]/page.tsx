'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { JoinTeleconsultButton } from '@/components/teleconsultation/join-button';
import { useParams, useRouter } from 'next/navigation';
import { api, Appointment, AppointmentStatus } from '@/lib/api';
import { useToast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-modal';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';

export default function AppointmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t, tEnum, formatDate: formatLocaleDate, formatTime: formatLocaleTime, formatDateTime: formatLocaleDateTime } = useLanguage();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  // Role-based access control
  const isPatient = user?.role === 'PATIENT';
  const isDoctor = user?.role === 'DOCTOR';
  const isAdmin = user?.role === 'ADMIN';
  const isStaff = ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'].includes(user?.role || '');

  const fetchAppointment = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAppointment(params.id as string);
      setAppointment(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('appointmentDetail.errFetch'));
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  const handleStatusChange = async (newStatus: AppointmentStatus) => {
    if (!appointment) return;

    try {
      setUpdating(true);
      await api.updateAppointment(appointment.id, { status: newStatus });
      toast.success(t('appointmentsPage.statusUpdated'), t('appointmentsPage.statusUpdatedMessage', { status: tEnum(newStatus).toLowerCase() }));
      await fetchAppointment();
    } catch (err) {
      toast.error(t('appointmentsPage.updateFailed'), err instanceof Error ? err.message : t('appointmentDetail.errStatus'));
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!appointment || !cancellationReason.trim()) return;

    try {
      setUpdating(true);
      await api.updateAppointment(appointment.id, {
        status: 'CANCELLED',
        cancellationReason: cancellationReason,
      });
      setShowCancelModal(false);
      setCancellationReason('');
      toast.success(t('appointmentDetail.cancelled'), t('appointmentDetail.cancelledMessage'));
      await fetchAppointment();
    } catch (err) {
      toast.error(t('appointmentDetail.cancelFailed'), err instanceof Error ? err.message : t('appointmentDetail.cancelFailedMessage'));
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment) return;

    const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
    const confirmed = await confirm({
      title: t('appointmentsPage.deleteTitle'),
      message: t('appointmentsPage.deleteMessage', { name: patientName }),
      confirmText: t('common.delete'),
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await api.deleteAppointment(appointment.id);
      toast.success(t('appointmentsPage.deleted'), t('appointmentDetail.deletedMessage'));
      router.push('/dashboard/appointments');
    } catch (err) {
      toast.error(t('patientsPage.deleteFailed'), err instanceof Error ? err.message : t('appointmentsPage.deleteFailedMessage'));
    }
  };

  const formatDate = (dateString: string) => {
    return formatLocaleDate(dateString, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    return formatLocaleTime(time);
  };

  const formatDateTime = (dateString: string) => {
    return formatLocaleDateTime(dateString);
  };

  const statusColors: Record<AppointmentStatus, { bg: string; text: string; border: string }> = {
    SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
    CONFIRMED: { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-200' },
    CHECKED_IN: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
    IN_PROGRESS: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
    COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    NO_SHOW: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  };

  const statusLabels: Record<AppointmentStatus, string> = {
    SCHEDULED: tEnum('SCHEDULED'),
    CONFIRMED: tEnum('CONFIRMED'),
    CHECKED_IN: tEnum('CHECKED_IN'),
    IN_PROGRESS: tEnum('IN_PROGRESS'),
    COMPLETED: tEnum('COMPLETED'),
    CANCELLED: tEnum('CANCELLED'),
    NO_SHOW: tEnum('NO_SHOW'),
  };

  const typeLabels: Record<string, { label: string; icon: string }> = {
    IN_PERSON: {
      label: tEnum('IN_PERSON'),
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
    VIDEO: {
      label: tEnum('VIDEO'),
      icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    },
    PHONE: {
      label: tEnum('PHONE'),
      icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
    },
  };

  const getNextStatuses = (currentStatus: AppointmentStatus): AppointmentStatus[] => {
    const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      SCHEDULED: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
      CHECKED_IN: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    };
    return transitions[currentStatus] || [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('appointmentDetail.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-600 dark:text-red-400 mb-4">{error || t('appointmentDetail.notFound')}</p>
          <Link
            href="/dashboard/appointments"
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('appointmentDetail.back')}
          </Link>
        </div>
      </div>
    );
  }

  const nextStatuses = getNextStatuses(appointment.status);
  const typeInfo = typeLabels[appointment.type];
  const statusStyle = statusColors[appointment.status];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/dashboard/appointments"
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('appointmentDetail.title')}
              </h1>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                {statusLabels[appointment.status]}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {formatDate(appointment.appointmentDate)} {t('appointmentForm.at')} {formatTime(appointment.startTime)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <JoinTeleconsultButton appointment={appointment} isDoctor={isDoctor} />
            {/* Cancel button - available to all users for non-completed/cancelled appointments */}
            {appointment.status !== 'CANCELLED' && appointment.status !== 'COMPLETED' && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t('appointmentDetail.cancelAppointment')}
              </button>
            )}
            {/* Edit button - only for staff, not patients */}
            {isStaff && (
              <Link
                href={`/dashboard/appointments/${params.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-lime-600 hover:bg-lime-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('appointmentDetail.edit')}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Appointment Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${statusStyle.bg}`}>
                    <svg className={`w-8 h-8 ${statusStyle.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {formatDate(appointment.appointmentDate)}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg className={`w-5 h-5 ${statusStyle.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeInfo.icon} />
                  </svg>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {typeInfo.label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('appointmentDetail.reason')}</p>
                  <p className="text-gray-900 dark:text-white font-medium">{appointment.reason}</p>
                </div>
                {appointment.notes && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('appointmentDetail.notes')}</p>
                    <p className="text-gray-700 dark:text-gray-300">{appointment.notes}</p>
                  </div>
                )}
              </div>

              {appointment.cancellationReason && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">{t('appointmentDetail.cancellationReason')}</p>
                  <p className="text-red-800 dark:text-red-300">{appointment.cancellationReason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Patient Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('appointmentDetail.patientInfo')}</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-lime-100 dark:bg-lime-900 flex items-center justify-center text-lime-600 dark:text-lime-400 font-bold text-xl">
                  {appointment.patient.firstName[0]}{appointment.patient.lastName[0]}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {appointment.patient.firstName} {appointment.patient.lastName}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.patient.patientId}</p>
                </div>
                {/* View Patient Profile - only for staff */}
                {isStaff && (
                  <Link
                    href={`/dashboard/patients/${appointment.patient.id}`}
                    className="px-4 py-2 text-lime-600 hover:bg-lime-50 dark:text-lime-400 dark:hover:bg-lime-900/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    {t('appointmentDetail.viewProfile')}
                  </Link>
                )}
              </div>
              {/* Contact info - only for staff */}
              {isStaff && (
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('appointmentDetail.email')}</p>
                    <p className="text-sm text-gray-900 dark:text-white">{appointment.patient.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('appointmentDetail.phone')}</p>
                    <p className="text-sm text-gray-900 dark:text-white">{appointment.patient.phoneNumber}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Doctor Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('appointmentDetail.doctorInfo')}</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl">
                  {appointment.doctor.firstName[0]}{appointment.doctor.lastName[0]}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.doctor.department}</p>
                </div>
                {/* View Doctor Profile - only for staff */}
                {isStaff && (
                  <Link
                    href={`/dashboard/doctors/${appointment.doctor.id}`}
                    className="px-4 py-2 text-lime-600 hover:bg-lime-50 dark:text-lime-400 dark:hover:bg-lime-900/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    {t('appointmentDetail.viewProfile')}
                  </Link>
                )}
              </div>
              {/* Contact info - only for staff */}
              {isStaff && (
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('appointmentDetail.email')}</p>
                    <p className="text-sm text-gray-900 dark:text-white">{appointment.doctor.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('appointmentDetail.phone')}</p>
                    <p className="text-sm text-gray-900 dark:text-white">{appointment.doctor.phoneNumber}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Actions - only for staff, not patients */}
          {isStaff && nextStatuses.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('appointmentDetail.updateStatus')}</h3>
              </div>
              <div className="p-4 space-y-2">
                {nextStatuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={updating}
                    className={`w-full px-4 py-3 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                      status === 'CANCELLED'
                        ? 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30'
                        : `${statusColors[status].border} ${statusColors[status].text} hover:${statusColors[status].bg}`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{statusLabels[status]}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Doctor Actions - Start Consultation - only for doctors */}
          {isDoctor && (appointment.status === 'IN_PROGRESS' || appointment.status === 'CHECKED_IN') && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-lime-200 dark:border-lime-800">
              <div className="p-4 border-b border-lime-200 dark:border-lime-800">
                <h3 className="font-semibold text-lime-700 dark:text-lime-400">{t('appointmentDetail.doctorActions')}</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('appointmentDetail.doctorActionsHelp')}
                </p>
                <Link
                  href={`/dashboard/appointments/${appointment.id}/consultation`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-lime-600 text-white hover:bg-lime-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t('appointmentDetail.startConsultation')}
                </Link>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('appointmentDetail.timeline')}</h3>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700"></div>
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{t('appointmentDetail.created')}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(appointment.createdAt)}
                    </p>
                  </div>
                </div>

                {appointment.checkedInAt && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700"></div>
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{t('appointmentDetail.checkedIn')}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(appointment.checkedInAt)}
                      </p>
                    </div>
                  </div>
                )}

                {appointment.startedAt && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700"></div>
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{t('appointmentDetail.started')}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(appointment.startedAt)}
                      </p>
                    </div>
                  </div>
                )}

                {appointment.completedAt && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{t('appointmentDetail.completed')}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(appointment.completedAt)}
                      </p>
                    </div>
                  </div>
                )}

                {appointment.cancelledAt && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{t('appointmentDetail.cancelledLabel')}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(appointment.cancelledAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Info - only for staff */}
          {isStaff && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('appointmentDetail.quickInfo')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('appointmentDetail.queue')}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {appointment.queueNumber || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('appointmentDetail.rescheduleCount')}</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {t(appointment.rescheduleCount === 1 ? 'appointmentDetail.timesOne' : 'appointmentDetail.timesMany', { count: appointment.rescheduleCount })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone - only for admins */}
          {isAdmin && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800">
              <div className="p-4 border-b border-red-200 dark:border-red-800">
                <h3 className="font-semibold text-red-700 dark:text-red-400">{t('appointmentDetail.danger')}</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('appointmentDetail.dangerHelp')}
                </p>
                <button
                  onClick={handleDelete}
                  className="w-full px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg text-sm font-medium transition-colors"
                >
                  {t('appointmentDetail.delete')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowCancelModal(false)}></div>

            <div className="relative z-10 w-full max-w-md p-6 mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('appointmentDetail.cancelAppointment')}</h3>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('appointmentDetail.cancelConfirm')}
              </p>

              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder={t('appointmentDetail.cancelPh')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                >
                  {t('appointmentDetail.keep')}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={!cancellationReason.trim() || updating}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium transition-colors"
                >
                  {updating ? t('appointmentDetail.cancelling') : t('appointmentDetail.cancelAppointment')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
}
