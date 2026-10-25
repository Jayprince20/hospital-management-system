'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { api, type Doctor } from '@/lib/api';
import { LoadingState, ErrorState } from '@/components/ui';

interface ScheduleDay {
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isActive: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_SCHEDULE: ScheduleDay[] = [
  { dayOfWeek: 0, dayName: 'Sunday', startTime: '09:00', endTime: '13:00', slotDuration: 30, isActive: false },
  { dayOfWeek: 1, dayName: 'Monday', startTime: '08:00', endTime: '16:00', slotDuration: 30, isActive: true },
  { dayOfWeek: 2, dayName: 'Tuesday', startTime: '08:00', endTime: '16:00', slotDuration: 30, isActive: true },
  { dayOfWeek: 3, dayName: 'Wednesday', startTime: '08:00', endTime: '16:00', slotDuration: 30, isActive: true },
  { dayOfWeek: 4, dayName: 'Thursday', startTime: '08:00', endTime: '16:00', slotDuration: 30, isActive: true },
  { dayOfWeek: 5, dayName: 'Friday', startTime: '08:00', endTime: '16:00', slotDuration: 30, isActive: true },
  { dayOfWeek: 6, dayName: 'Saturday', startTime: '09:00', endTime: '13:00', slotDuration: 30, isActive: false },
];

export default function SchedulePage() {
  const { user } = useAuth();
  const { t, tEnum } = useLanguage();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleDay[]>(DEFAULT_SCHEDULE);
  const [doctorData, setDoctorData] = useState<Doctor | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!user?.doctorId) {
      setError(t('myPatients.noDoctorProfile'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch doctor data with schedule
      const doctorRes = await api.getDoctor(user.doctorId);
      setDoctorData(doctorRes);

      // Map the schedule from API response
      if (doctorRes.schedule && doctorRes.schedule.length > 0) {
        const scheduleMap = new Map(
          doctorRes.schedule.map((s) => [s.dayOfWeek, s])
        );

        const mappedSchedule = DEFAULT_SCHEDULE.map((day) => {
          const apiDay = scheduleMap.get(day.dayOfWeek);
          if (apiDay) {
            return {
              ...day,
              startTime: apiDay.startTime,
              endTime: apiDay.endTime,
              slotDuration: apiDay.slotDuration,
              isActive: apiDay.isActive,
            };
          }
          return day;
        });

        setSchedule(mappedSchedule);
      }
    } catch (err) {
      console.error('Error fetching schedule:', err);
      setError(t('schedule.errLoad'));
      toast.error(t('common.error'), t('schedule.errLoadRetry'));
    } finally {
      setLoading(false);
    }
  }, [user?.doctorId, toast]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleToggleDay = (dayOfWeek: number) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, isActive: !day.isActive } : day
      )
    );
  };

  const handleTimeChange = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day
      )
    );
  };

  const handleSlotDurationChange = (dayOfWeek: number, value: number) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, slotDuration: value } : day
      )
    );
  };

  const handleSaveSchedule = async () => {
    if (!user?.doctorId) return;

    try {
      setSaving(true);
      setError(null);

      // Format schedule for API
      const formattedSchedule = schedule.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        startTime: day.startTime,
        endTime: day.endTime,
        slotDuration: day.slotDuration,
        isActive: day.isActive,
      }));

      await api.updateDoctorSchedule(user.doctorId, formattedSchedule);
      toast.success(t('common.success'), t('schedule.saved'));
    } catch (err) {
      console.error('Error saving schedule:', err);
      toast.error(t('common.error'), t('schedule.errSave'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label={t('schedule.loading')} minHeight="h-96" />;
  }

  if (error && !doctorData) {
    return <ErrorState title={t('common.error')} message={error} onRetry={fetchSchedule} />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('schedule.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('schedule.subtitle')}
        </p>
        <Link href="/dashboard/my-schedule" className="inline-block mt-2 text-sm text-lime-700 dark:text-lime-400 hover:underline">
          {t('ros.mine.seeShifts')}
        </Link>
      </div>


      {/* Doctor Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-lime-500 to-blue-500 flex items-center justify-center">
            <span className="text-white font-bold text-xl">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Dr. {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {doctorData?.department || tEnum('DOCTOR')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {doctorData?.specializations?.join(', ') || t('schedule.generalPractice')}
            </p>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('schedule.weekly')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('schedule.weeklyHelp')}
          </p>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {schedule.map((day) => (
            <div
              key={day.dayOfWeek}
              className={`p-4 ${day.isActive ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Day Toggle */}
                <div className="flex items-center gap-3 min-w-[150px]">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={day.isActive}
                      onChange={() => handleToggleDay(day.dayOfWeek)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-lime-300 dark:peer-focus:ring-lime-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand"></div>
                  </label>
                  <span className={`font-medium ${day.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                    {t(`schedule.day${day.dayOfWeek}`)}
                  </span>
                </div>

                {/* Time Inputs */}
                {day.isActive && (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-500 dark:text-gray-400">{t('schedule.from')}</label>
                      <input
                        type="time"
                        value={day.startTime}
                        onChange={(e) => handleTimeChange(day.dayOfWeek, 'startTime', e.target.value)}
                        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-500 dark:text-gray-400">{t('schedule.to')}</label>
                      <input
                        type="time"
                        value={day.endTime}
                        onChange={(e) => handleTimeChange(day.dayOfWeek, 'endTime', e.target.value)}
                        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-500 dark:text-gray-400">{t('schedule.slot')}</label>
                      <select
                        value={day.slotDuration}
                        onChange={(e) => handleSlotDurationChange(day.dayOfWeek, parseInt(e.target.value))}
                        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                      >
                        <option value={15}>15 min</option>
                        <option value={20}>20 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                      </select>
                    </div>
                  </div>
                )}

                {!day.isActive && (
                  <span className="text-sm text-gray-400 dark:text-gray-500">
                    {t('schedule.notWorking')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end">
          <button
            onClick={handleSaveSchedule}
            disabled={saving}
            className="px-6 py-2.5 bg-brand text-white font-medium rounded-lg hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('schedule.saving')}
              </span>
            ) : (
              t('schedule.save')
            )}
          </button>
        </div>
      </div>

      {/* Tips Section */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
          {t('schedule.tipsTitle')}
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('schedule.tip1')}
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('schedule.tip2')}
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('schedule.tip3')}
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('schedule.tip4')}
          </li>
        </ul>
      </div>
    </div>
  );
}
