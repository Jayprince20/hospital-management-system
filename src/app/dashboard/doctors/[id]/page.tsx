'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, Doctor, Appointment, Patient } from '@/lib/api';
import { useLanguage } from '@/context/language-context';

type TabType = 'overview' | 'appointments' | 'patients' | 'schedule' | 'reviews';

export default function DoctorDetailPage() {
  const params = useParams();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientTotal, setPatientTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const { t, tEnum, formatCurrency, formatDate: formatLocaleDate, formatTime, locale } = useLanguage();

  const fetchDoctor = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDoctor(params.id as string);
      setDoctor(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clinical.doctorDetail.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [params.id, t]);

  // Activity data for the stats cards and the appointments/patients tabs
  const fetchActivity = useCallback(async () => {
    const doctorId = params.id as string;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    try {
      const [recent, today, doctorPatients] = await Promise.all([
        api.getAppointments({ doctorId, limit: 10 }),
        api.getAppointments({ doctorId, dateFrom: todayStart.toISOString(), dateTo: todayEnd.toISOString(), limit: 1 }),
        api.getDoctorPatients(doctorId, { limit: 10 }),
      ]);
      setAppointments(recent.data);
      setTodayCount(today.total);
      setPatients(doctorPatients.data);
      setPatientTotal(doctorPatients.total);
    } catch (err) {
      console.error('Failed to fetch doctor activity:', err);
    }
  }, [params.id]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    fetchDoctor();
  }, [fetchDoctor]);

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: t('clinical.doctorDetail.tab.overview'), icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'appointments', label: t('clinical.doctorDetail.tab.appointments'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'patients', label: t('clinical.doctorDetail.tab.patients'), icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'schedule', label: t('clinical.doctorDetail.tab.schedule'), icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'reviews', label: t('clinical.doctorDetail.tab.reviews'), icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  ];

  const formatDate = (dateString: string) => formatLocaleDate(dateString);

  // 7 Jan 2024 was a Sunday, so day N of that week maps to dayOfWeek N
  const getDayName = (dayOfWeek: number, format: 'long' | 'short' = 'long'): string =>
    new Date(2024, 0, 7 + dayOfWeek).toLocaleDateString(locale, { weekday: format });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('clinical.doctorDetail.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-600 dark:text-red-400 mb-4">{error || t('clinical.doctorDetail.notFound')}</p>
          <Link
            href="/dashboard/doctors"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('clinical.doctorDetail.back')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/dashboard/doctors"
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Dr. {doctor.firstName} {doctor.lastName}
              </h1>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                doctor.isAvailable
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {doctor.isAvailable ? t('doctors.available') : t('doctors.unavailable')}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {doctor.doctorId} • {doctor.department}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('appointments')}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {t('clinical.doctorDetail.viewAppointments')}
            </button>
            <Link
              href={`/dashboard/doctors/${params.id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t('clinical.doctorDetail.editProfile')}
            </Link>
          </div>
        </div>
      </div>

      {/* Doctor Quick Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Avatar and Basic Info */}
          <div className="flex items-start gap-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-lime-500 flex items-center justify-center flex-shrink-0">
              {doctor.profileImageUrl ? (
                <img src={doctor.profileImageUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white font-bold text-3xl">
                  {doctor.firstName[0]}{doctor.lastName[0]}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center text-yellow-500">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${i < Math.floor(doctor.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {doctor.rating?.toFixed(1) || '0.0'} ({t((doctor.totalReviews || 0) === 1 ? 'clinical.doctorDetail.reviewOne' : 'clinical.doctorDetail.reviewMany', { count: doctor.totalReviews || 0 })})
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {t('clinical.doctorDetail.licenseLine', { number: doctor.licenseNumber })}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('clinical.doctorDetail.memberSince', { date: formatDate(doctor.createdAt) })}
              </p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 lg:border-l lg:border-gray-200 lg:dark:border-gray-700 lg:pl-6">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('clinical.common.email')}</p>
              <p className="text-sm text-gray-900 dark:text-white">{doctor.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('clinical.common.phone')}</p>
              <p className="text-sm text-gray-900 dark:text-white">{doctor.phoneNumber}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('clinical.doctorDetail.consultationFee')}</p>
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(doctor.consultationFee)}
              </p>
            </div>
          </div>

          {/* Specializations */}
          <div className="lg:border-l lg:border-gray-200 lg:dark:border-gray-700 lg:pl-6">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {t('clinical.doctorDetail.specializations')}
            </p>
            <div className="flex flex-wrap gap-1">
              {doctor.specializations?.map((spec, index) => (
                <span key={index} className="px-2 py-1 text-xs font-medium bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-300 rounded">
                  {spec}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

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
            {/* Professional Information */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('clinical.doctorDetail.professionalInfo')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('clinical.common.department')}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{doctor.department}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('clinical.doctorDetail.licenseNumber')}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{doctor.licenseNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('clinical.doctorDetail.qualifications')}</p>
                  <div className="flex flex-wrap gap-2">
                    {doctor.qualifications?.map((qual, index) => (
                      <span key={index} className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded">
                        {qual}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('clinical.doctorDetail.languages')}</p>
                  <div className="flex flex-wrap gap-2">
                    {doctor.languages?.map((lang, index) => (
                      <span key={index} className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 rounded">
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('clinical.doctorDetail.about')}</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {doctor.bio || t('clinical.doctorDetail.noBio')}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{todayCount}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('doctors.todayAppointments')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{patientTotal}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('clinical.doctorDetail.totalPatients')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{doctor.rating?.toFixed(1) || '0.0'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('clinical.doctorDetail.averageRating')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(doctor.consultationFee)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('clinical.doctorDetail.consultationFee')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule Preview */}
            <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('clinical.doctorDetail.weeklySchedule')}</h3>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500"
                >
                  {t('clinical.doctorDetail.viewFullSchedule')}
                </button>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-7 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const scheduleDay = doctor.schedule?.find((s) => s.dayOfWeek === day);
                    const isActive = scheduleDay?.isActive;
                    return (
                      <div
                        key={day}
                        className={`p-3 rounded-lg text-center ${
                          isActive
                            ? 'bg-lime-50 dark:bg-lime-900/30 border border-lime-200 dark:border-lime-800'
                            : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <p className={`text-xs font-medium mb-1 ${
                          isActive ? 'text-lime-600 dark:text-lime-400' : 'text-gray-400'
                        }`}>
                          {getDayName(day, 'short')}
                        </p>
                        {isActive && scheduleDay ? (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {formatTime(scheduleDay.startTime)} - {formatTime(scheduleDay.endTime)}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">{t('clinical.doctorDetail.off')}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('clinical.doctorDetail.recentAppointments')}</h3>
            </div>
            {appointments.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('clinical.doctorDetail.noAppointments')}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('clinical.doctorDetail.noAppointmentsHint')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {appointments.map((apt) => (
                  <Link
                    key={apt.id}
                    href={`/dashboard/appointments/${apt.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {apt.patient.firstName} {apt.patient.lastName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{apt.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {formatDate(apt.appointmentDate)} · {formatTime(apt.startTime)}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{tEnum(apt.status)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Patients Tab */}
        {activeTab === 'patients' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('clinical.doctorDetail.tab.patients')}</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">{patientTotal}</span>
            </div>
            {patients.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('clinical.doctorDetail.noPatients')}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('clinical.doctorDetail.noPatientsHint')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {patients.map((patient) => (
                  <Link
                    key={patient.id}
                    href={`/dashboard/patients/${patient.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{patient.patientId}</p>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{patient.phoneNumber}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('clinical.doctorDetail.weeklySchedule')}</h3>
              <Link
                href={`/dashboard/doctors/${params.id}/edit`}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('clinical.doctorDetail.editSchedule')}
              </Link>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const scheduleDay = doctor.schedule?.find((s) => s.dayOfWeek === day);
                  const isActive = scheduleDay?.isActive;
                  return (
                    <div
                      key={day}
                      className={`p-4 rounded-lg border ${
                        isActive
                          ? 'bg-white dark:bg-gray-800 border-lime-200 dark:border-lime-800'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          <span className={`font-medium ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                            {getDayName(day)}
                          </span>
                        </div>
                        {isActive && scheduleDay ? (
                          <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{formatTime(scheduleDay.startTime)} - {formatTime(scheduleDay.endTime)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>{t('clinical.doctorDetail.slotMinutes', { count: scheduleDay.slotDuration })}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">{t('clinical.doctorDetail.notWorking')}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div>
            {/* Rating Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="text-center">
                  <p className="text-5xl font-bold text-gray-900 dark:text-white">{doctor.rating?.toFixed(1) || '0.0'}</p>
                  <div className="flex items-center justify-center mt-2">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-5 h-5 ${i < Math.floor(doctor.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t((doctor.totalReviews || 0) === 1 ? 'clinical.doctorDetail.reviewOne' : 'clinical.doctorDetail.reviewMany', { count: doctor.totalReviews || 0 })}</p>
                </div>
                <div className="flex-1 w-full space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <div key={star} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400 w-3">{star}</span>
                      <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 rounded-full"
                          style={{ width: '0%' }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Reviews List - Empty State */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('clinical.doctorDetail.patientReviews')}</h3>
              </div>
              <div className="p-12 text-center">
                <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('clinical.doctorDetail.noReviews')}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('clinical.doctorDetail.noReviewsHint')}
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
