'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, type AppointmentType } from '@/lib/api';
import { useToast } from '@/components/toast';
import { useLanguage } from '@/context/language-context';
import { toLocalDateString } from '@/lib/formatters';
import { ConfirmationBadge, SimulateSmsReply, TomorrowConfirmations } from '@/components/confirmation';

interface Appointment {
  id: string;
  patientId: string;
  patient: {
    firstName: string;
    lastName: string;
    patientId: string;
    phoneNumber?: string;
  };
  doctorId: string;
  doctor: {
    firstName: string;
    lastName: string;
    department?: string;
  };
  appointmentDate: string;
  startTime: string;
  status: string;
  type: string;
  reason?: string;
  confirmedAt?: string | null;
  confirmationChannel?: string | null;
}

interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
}

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specializations: string[];
  department?: string;
}

export function ReceptionistDashboard() {
  const toast = useToast();
  const { t, tEnum, formatTime } = useLanguage();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  // Quick appointment form
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    patientId: '',
    doctorId: '',
    date: '',
    time: '',
    type: 'IN_PERSON',
    reason: '',
  });
  const [submittingAppointment, setSubmittingAppointment] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const today = toLocalDateString();

      const [appointmentsRes, patientsRes, doctorsRes] = await Promise.all([
        api.getAppointments({ dateFrom: today, dateTo: today, limit: 50 }),
        api.getPatients({ limit: 100 }),
        api.getDoctors({ limit: 50 }),
      ]);

      if (appointmentsRes.data) {
        setAppointments(appointmentsRes.data as unknown as Appointment[]);
      }
      if (patientsRes.data) {
        setPatients(patientsRes.data);
      }
      if (doctorsRes.data) {
        setDoctors(doctorsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(t('admin.reception.failedLoad'), t('admin.reception.tryRefresh'));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (appointment: Appointment) => {
    try {
      setCheckingIn(appointment.id);
      // Checking in puts the patient in the queue: the ticket number is what they wait with
      const ticket = await api.createQueueTicket({ patientId: appointment.patientId, appointmentId: appointment.id });
      toast.success(
        t('q.checkIn.done', { number: ticket.number }),
        t('q.checkIn.message', { name: `${appointment.patient.firstName} ${appointment.patient.lastName}`, number: ticket.number })
      );
      fetchData();
    } catch (error) {
      console.error('Failed to check in:', error);
      toast.error(t('admin.reception.checkInFailed'), error instanceof Error && error.message ? error.message : t('admin.reception.tryAgain'));
    } finally {
      setCheckingIn(null);
    }
  };

  const handleMarkNoShow = async (appointment: Appointment) => {
    try {
      await api.updateAppointment(appointment.id, { status: 'NO_SHOW' });
      toast.success(t('admin.reception.markedNoShow'), t('admin.reception.appointmentUpdated'));
      fetchData();
    } catch (error) {
      console.error('Failed to update:', error);
      toast.error(t('admin.reception.updateFailed'), t('admin.reception.tryAgain'));
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentForm.patientId || !appointmentForm.doctorId || !appointmentForm.date || !appointmentForm.time) {
      toast.error(t('admin.reception.missingFields'), t('admin.reception.fillRequired'));
      return;
    }

    try {
      setSubmittingAppointment(true);

      // Calculate end time (add 30 minutes)
      const [hours, minutes] = appointmentForm.time.split(':');
      const endHours = parseInt(hours) + (parseInt(minutes) + 30 >= 60 ? 1 : 0);
      const endMinutes = (parseInt(minutes) + 30) % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

      await api.createAppointment({
        patientId: appointmentForm.patientId,
        doctorId: appointmentForm.doctorId,
        appointmentDate: appointmentForm.date,
        startTime: appointmentForm.time,
        endTime: endTime,
        type: appointmentForm.type as AppointmentType,
        reason: appointmentForm.reason || t('admin.reception.generalConsultation'),
      });

      toast.success(t('admin.reception.scheduled'), t('admin.reception.scheduledMsg'));
      setShowAppointmentModal(false);
      setAppointmentForm({
        patientId: '',
        doctorId: '',
        date: '',
        time: '',
        type: 'IN_PERSON',
        reason: '',
      });
      fetchData();
    } catch (error) {
      console.error('Failed to create appointment:', error);
      toast.error(t('admin.reception.scheduleFailed'), error instanceof Error ? error.message : t('admin.reception.tryAgain'));
    } finally {
      setSubmittingAppointment(false);
    }
  };

  // Filter appointments
  const scheduledAppointments = appointments.filter(
    a => a.status === 'SCHEDULED' || a.status === 'CONFIRMED'
  );
  const checkedInAppointments = appointments.filter(a => a.status === 'CHECKED_IN');
  const completedAppointments = appointments.filter(a => a.status === 'COMPLETED');

  // Search patients
  const filteredPatients = patients.filter(
    p =>
      p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.phoneNumber && p.phoneNumber.includes(searchTerm))
  );


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CHECKED_IN':
        return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      case 'CONFIRMED':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
      case 'NO_SHOW':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300';
      default:
        return 'bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('admin.reception.loadingDashboard')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-lime-100 dark:bg-lime-900/50 rounded-lg">
              <svg className="w-6 h-6 text-lime-600 dark:text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.reception.todaySAppointments')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{appointments.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.reception.waiting')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{scheduledAppointments.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.reception.checkedIn')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{checkedInAppointments.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.reception.totalPatients')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{patients.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('admin.reception.quickActions')}</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/patients/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            {t('admin.reception.registerNewPatient')}
          </Link>
          <button
            onClick={() => setShowAppointmentModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {t('admin.reception.scheduleAppointment')}
          </button>
          <Link
            href="/dashboard/patients"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {t('admin.reception.viewAllPatients')}
          </Link>
          <Link
            href="/dashboard/appointments"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {t('admin.reception.viewAllAppointments')}
          </Link>
        </div>
      </div>

      {/* Tomorrow: who confirmed (SMS reply, link, portal) and who to call */}
      <TomorrowConfirmations />

      {/* Test tool: a patient's SMS reply, without an operator (never shown in production builds) */}
      {process.env.NODE_ENV !== 'production' && <SimulateSmsReply collapsible onDone={fetchData} />}

      {/* Appointments Ready for Check-in */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.reception.appointmentsReadyForCheckIn')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('admin.reception.patientsScheduledForToday')}</p>
        </div>

        {scheduledAppointments.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">{t('admin.reception.noAppointmentsWaitingForCheckIn')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.reception.time')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.reception.patient')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.reception.phone')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.reception.doctor')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.reception.type')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.reception.status')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.reception.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {scheduledAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {formatTime(apt.startTime)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {apt.patient.firstName} {apt.patient.lastName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{apt.patient.patientId}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {apt.patient.phoneNumber || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      Dr. {apt.doctor.firstName} {apt.doctor.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {tEnum(apt.type)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(apt.status)}`}>
                          {tEnum(apt.status)}
                        </span>
                        <ConfirmationBadge appointment={apt} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCheckIn(apt)}
                          disabled={checkingIn === apt.id}
                          className="px-3 py-1.5 bg-lime-600 text-white text-xs rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors"
                        >
                          {checkingIn === apt.id ? t('admin.reception.checkingIn') : t('admin.reception.checkIn')}
                        </button>
                        <button
                          onClick={() => handleMarkNoShow(apt)}
                          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          {t('admin.reception.noShow')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patient Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.reception.patientSearch')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('admin.reception.searchForPatientsByNameId')}</p>
        </div>

        <div className="p-4">
          <div className="relative mb-4">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('admin.reception.searchPatients')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
            />
          </div>

          {searchTerm && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.reception.patient')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.reception.id')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.reception.phone')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.reception.email')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('admin.reception.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredPatients.slice(0, 10).map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {patient.firstName} {patient.lastName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {patient.patientId}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {patient.phoneNumber || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {patient.email}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setAppointmentForm(prev => ({ ...prev, patientId: patient.id }));
                              setShowAppointmentModal(true);
                            }}
                            className="px-3 py-1.5 bg-lime-600 text-white text-xs rounded-lg hover:bg-lime-700 transition-colors"
                          >
                            {t('admin.reception.bookAppointment')}
                          </button>
                          <Link
                            href={`/dashboard/patients/${patient.id}`}
                            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            {t('admin.reception.viewDetails')}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPatients.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('admin.reception.noPatientsFound')}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Checked In Patients */}
      {checkedInAppointments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-green-200 dark:border-green-800">
          <div className="p-4 border-b border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-t-xl">
            <h2 className="text-lg font-semibold text-green-800 dark:text-green-200">{t('admin.reception.checkedInWaitingForDoctor')}</h2>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">{t('admin.reception.waitingCount', { count: checkedInAppointments.length })}</p>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {checkedInAppointments.map((apt) => (
              <div key={apt.id} className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {apt.patient.firstName[0]}{apt.patient.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {apt.patient.firstName} {apt.patient.lastName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('admin.reception.checkedInAt', { time: apt.startTime ? formatTime(apt.startTime) : '' })}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Dr. {apt.doctor.firstName} {apt.doctor.lastName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Appointment Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.reception.scheduleAppointment')}</h2>
              <button
                onClick={() => setShowAppointmentModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.reception.patient')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={appointmentForm.patientId}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, patientId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  required
                >
                  <option value="">{t('admin.reception.selectPatient')}</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.patientId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.reception.doctor')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={appointmentForm.doctorId}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, doctorId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  required
                >
                  <option value="">{t('admin.reception.selectDoctor')}</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.firstName} {d.lastName} - {d.specializations?.[0] || t('admin.reception.general')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.reception.date')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={appointmentForm.date}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, date: e.target.value }))}
                    min={toLocalDateString()}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.reception.time')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={appointmentForm.time}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.reception.type')}
                </label>
                <select
                  value={appointmentForm.type}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                >
                  <option value="IN_PERSON">{tEnum('IN_PERSON')}</option>
                  <option value="VIDEO">{tEnum('VIDEO')}</option>
                  <option value="PHONE">{tEnum('PHONE')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin.reception.reason')}
                </label>
                <input
                  type="text"
                  value={appointmentForm.reason}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder={t('admin.reception.reasonForVisit')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAppointmentModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t('admin.reception.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingAppointment}
                  className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 transition-colors"
                >
                  {submittingAppointment ? t('admin.reception.scheduling') : t('admin.reception.scheduleAppointment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
