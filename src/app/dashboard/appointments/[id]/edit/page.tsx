'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api, Appointment, AppointmentType, AppointmentStatus, Doctor } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { toLocalDateString } from '@/lib/formatters';

export default function EditAppointmentPage() {
  const router = useRouter();
  const params = useParams();
  const { t, tEnum } = useLanguage();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    appointmentDate: '',
    startTime: '',
    endTime: '',
    type: 'IN_PERSON' as AppointmentType,
    status: 'SCHEDULED' as AppointmentStatus,
    reason: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchAppointment = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAppointment(params.id as string);
      setAppointment(data);
      setFormData({
        appointmentDate: toLocalDateString(data.appointmentDate),
        startTime: data.startTime,
        endTime: data.endTime,
        type: data.type,
        status: data.status,
        reason: data.reason,
        notes: data.notes || '',
      });
    } catch (err) {
      setError(t('appointmentEdit.errLoad'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchDoctors = async () => {
    try {
      const response = await api.getDoctors({ available: true, limit: 100 });
      setDoctors(response.data);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  useEffect(() => {
    fetchAppointment();
    fetchDoctors();
  }, [fetchAppointment]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.appointmentDate) newErrors.appointmentDate = t('appointmentEdit.errDate');
    if (!formData.startTime) newErrors.startTime = t('appointmentEdit.errStart');
    if (!formData.endTime) newErrors.endTime = t('appointmentEdit.errEnd');
    if (!formData.reason.trim()) newErrors.reason = t('appointmentEdit.errReason');

    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = t('appointmentEdit.errEndAfter');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await api.updateAppointment(params.id as string, {
        appointmentDate: formData.appointmentDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        type: formData.type,
        status: formData.status,
        reason: formData.reason,
        notes: formData.notes || undefined,
      });
      router.push(`/dashboard/appointments/${params.id}`);
    } catch (err) {
      console.error('Error updating appointment:', err);
      setErrors({ submit: err instanceof Error ? err.message : t('appointmentsPage.updateFailedMessage') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions: { value: AppointmentStatus; label: string; color: string }[] = [
    { value: 'SCHEDULED', label: tEnum('SCHEDULED'), color: 'bg-blue-100 text-blue-800' },
    { value: 'CONFIRMED', label: tEnum('CONFIRMED'), color: 'bg-lime-100 text-lime-800' },
    { value: 'CHECKED_IN', label: tEnum('CHECKED_IN'), color: 'bg-yellow-100 text-yellow-800' },
    { value: 'IN_PROGRESS', label: tEnum('IN_PROGRESS'), color: 'bg-purple-100 text-purple-800' },
    { value: 'COMPLETED', label: tEnum('COMPLETED'), color: 'bg-green-100 text-green-800' },
    { value: 'CANCELLED', label: tEnum('CANCELLED'), color: 'bg-red-100 text-red-800' },
    { value: 'NO_SHOW', label: tEnum('NO_SHOW'), color: 'bg-gray-100 text-gray-800' },
  ];

  const typeOptions: { value: AppointmentType; label: string }[] = [
    { value: 'IN_PERSON', label: tEnum('IN_PERSON') },
    { value: 'VIDEO', label: tEnum('VIDEO') },
    { value: 'PHONE', label: tEnum('PHONE') },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-red-600 mb-4">{error || t('appointmentDetail.notFound')}</p>
        <Link href="/dashboard/appointments" className="px-4 py-2 bg-lime-600 text-white rounded-lg">
          {t('appointmentDetail.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href={`/dashboard/appointments/${params.id}`}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('appointmentEdit.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('appointmentEdit.subtitle', { patient: `${appointment.patient.firstName} ${appointment.patient.lastName}`, doctor: `${appointment.doctor.firstName} ${appointment.doctor.lastName}` })}
            </p>
          </div>
        </div>
      </div>

      {errors.submit && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{errors.submit}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        {/* Patient & Doctor Info (Read-only) */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('appointmentEdit.info')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('appointmentEdit.patient')}</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {appointment.patient.firstName} {appointment.patient.lastName}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.patient.patientId}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('appointmentEdit.doctor')}</p>
              <p className="font-medium text-gray-900 dark:text-white">
                Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.doctor.department}</p>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('appointmentEdit.status')} <span className="text-red-500">*</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('appointmentEdit.type')} <span className="text-red-500">*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('appointmentEdit.date')} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="appointmentDate"
                value={formData.appointmentDate}
                onChange={handleChange}
                className={`w-full px-4 py-2.5 rounded-lg border ${
                  errors.appointmentDate ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500`}
              />
              {errors.appointmentDate && (
                <p className="mt-1 text-sm text-red-500">{errors.appointmentDate}</p>
              )}
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('appointmentEdit.start')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 rounded-lg border ${
                    errors.startTime ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500`}
                />
                {errors.startTime && (
                  <p className="mt-1 text-sm text-red-500">{errors.startTime}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('appointmentEdit.end')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 rounded-lg border ${
                    errors.endTime ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500`}
                />
                {errors.endTime && (
                  <p className="mt-1 text-sm text-red-500">{errors.endTime}</p>
                )}
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('appointmentEdit.reason')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              className={`w-full px-4 py-2.5 rounded-lg border ${
                errors.reason ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500`}
              placeholder={t('appointmentEdit.reasonPh')}
            />
            {errors.reason && (
              <p className="mt-1 text-sm text-red-500">{errors.reason}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('appointmentEdit.notes')}
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              placeholder={t('appointmentEdit.notesPh')}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3">
          <Link
            href={`/dashboard/appointments/${params.id}`}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            {t('appointmentEdit.cancel')}
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-lime-600 hover:bg-lime-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSubmitting ? t('appointmentEdit.saving') : t('appointmentEdit.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
