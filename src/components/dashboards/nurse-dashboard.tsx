'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { api } from '@/lib/api';
import { LoadingState, ErrorState } from '@/components/ui';
import { formatTime } from '@/lib/formatters';

interface WaitingPatient {
  id: string;
  appointmentId: string;
  name: string;
  patientId: string;
  time: string;
  doctor: string;
  department: string;
  status: string;
  reason?: string;
  checkedInAt?: string;
}

interface NurseStats {
  waitingPatients: number;
  checkedInToday: number;
  vitalsRecordedToday: number;
  pendingVitals: number;
}

export function NurseDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<NurseStats>({
    waitingPatients: 0,
    checkedInToday: 0,
    vitalsRecordedToday: 0,
    pendingVitals: 0,
  });
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [showVitalsModal, setShowVitalsModal] = useState(false);

  // Vitals form state
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressureSys: '',
    bloodPressureDia: '',
    heartRate: '',
    temperature: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: '',
    notes: '',
  });
  const [savingVitals, setSavingVitals] = useState(false);

  const fetchNurseData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];

      // Fetch today's appointments that are checked in or waiting
      const appointmentsRes = await api.getAppointments({
        dateFrom: today,
        dateTo: today,
        limit: 50,
      });

      const allAppointments = appointmentsRes.data || [];

      // Filter for patients who need attention (checked in, waiting for vitals)
      const waiting = allAppointments
        .filter((apt: any) => ['CHECKED_IN', 'CONFIRMED'].includes(apt.status))
        .map((apt: any) => ({
          id: apt.patient?.id || '',
          appointmentId: apt.id,
          name: `${apt.patient?.firstName || ''} ${apt.patient?.lastName || ''}`.trim(),
          patientId: apt.patient?.patientId || '',
          time: apt.startTime || apt.scheduledAt,
          doctor: `Dr. ${apt.doctor?.firstName || ''} ${apt.doctor?.lastName || ''}`.trim(),
          department: apt.doctor?.department?.name || apt.doctor?.department || 'General',
          status: apt.status,
          reason: apt.reason,
          checkedInAt: apt.checkedInAt,
        }));

      setWaitingPatients(waiting);

      const checkedIn = allAppointments.filter((a: any) => a.status === 'CHECKED_IN').length;
      const confirmed = allAppointments.filter((a: any) => a.status === 'CONFIRMED').length;

      setStats({
        waitingPatients: waiting.length,
        checkedInToday: checkedIn,
        vitalsRecordedToday: 0, // Would need separate API call
        pendingVitals: confirmed, // Patients confirmed but not checked in
      });

    } catch (err) {
      setError('Failed to load nurse dashboard');
      console.error('Nurse dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNurseData();
    const interval = setInterval(fetchNurseData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchNurseData]);

  const handleCheckIn = async (appointmentId: string) => {
    try {
      await api.updateAppointment(appointmentId, { status: 'CHECKED_IN' });
      fetchNurseData();
    } catch (err) {
      console.error('Check-in failed:', err);
    }
  };

  const openVitalsModal = (patientId: string) => {
    setSelectedPatient(patientId);
    setVitalsForm({
      bloodPressureSys: '',
      bloodPressureDia: '',
      heartRate: '',
      temperature: '',
      respiratoryRate: '',
      oxygenSaturation: '',
      weight: '',
      height: '',
      notes: '',
    });
    setShowVitalsModal(true);
  };

  const handleSaveVitals = async () => {
    if (!selectedPatient) return;

    try {
      setSavingVitals(true);
      await api.createVitals({
        patientId: selectedPatient,
        bloodPressureSys: vitalsForm.bloodPressureSys ? parseInt(vitalsForm.bloodPressureSys) : undefined,
        bloodPressureDia: vitalsForm.bloodPressureDia ? parseInt(vitalsForm.bloodPressureDia) : undefined,
        heartRate: vitalsForm.heartRate ? parseInt(vitalsForm.heartRate) : undefined,
        temperature: vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : undefined,
        respiratoryRate: vitalsForm.respiratoryRate ? parseInt(vitalsForm.respiratoryRate) : undefined,
        oxygenSaturation: vitalsForm.oxygenSaturation ? parseInt(vitalsForm.oxygenSaturation) : undefined,
        weight: vitalsForm.weight ? parseFloat(vitalsForm.weight) : undefined,
        height: vitalsForm.height ? parseFloat(vitalsForm.height) : undefined,
        notes: vitalsForm.notes || undefined,
        recordedBy: `${user?.firstName} ${user?.lastName}`,
      });
      setShowVitalsModal(false);
      fetchNurseData();
    } catch (err) {
      console.error('Failed to save vitals:', err);
    } finally {
      setSavingVitals(false);
    }
  };

  const statusColors: Record<string, string> = {
    'CONFIRMED': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-400',
    'CHECKED_IN': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-400',
    'IN_PROGRESS': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-400',
  };

  if (loading) {
    return <LoadingState label="Loading nursing station..." minHeight="h-96" />;
  }

  if (error) {
    return <ErrorState title="Error" message={error} onRetry={fetchNurseData} />;
  }

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Nursing Station
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {stats.waitingPatients} patient{stats.waitingPatients !== 1 ? 's' : ''} waiting for assistance
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.waitingPatients}</p>
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
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.checkedInToday}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Checked In Today</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.vitalsRecordedToday}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Vitals Recorded</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingVitals}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Check-in</p>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Queue */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Patient Queue</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Patients waiting for check-in and vitals</p>
          </div>
          <button
            onClick={fetchNurseData}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Refresh
          </button>
        </div>

        {waitingPatients.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">No patients waiting</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Doctor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {waitingPatients.map((patient) => (
                  <tr key={patient.appointmentId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{formatTime(patient.time)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {patient.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <Link
                            href={`/dashboard/patients/${patient.id}`}
                            className="font-medium text-gray-900 dark:text-white hover:text-lime-600 dark:hover:text-lime-400"
                          >
                            {patient.name}
                          </Link>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{patient.patientId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 dark:text-white">{patient.doctor}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{patient.department}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">{patient.reason || 'General'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[patient.status]}`}>
                        {patient.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {patient.status === 'CONFIRMED' && (
                          <button
                            onClick={() => handleCheckIn(patient.appointmentId)}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          >
                            Check In
                          </button>
                        )}
                        {patient.status === 'CHECKED_IN' && (
                          <button
                            onClick={() => openVitalsModal(patient.id)}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                          >
                            Record Vitals
                          </button>
                        )}
                        <Link
                          href={`/dashboard/patients/${patient.id}`}
                          className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-lime-600 dark:hover:text-lime-400"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/dashboard/patients"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 hover:border-lime-500 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">View All Patients</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Search and view patient records</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/appointments"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 hover:border-lime-500 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Today's Appointments</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">View all scheduled appointments</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/records"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 hover:border-lime-500 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Medical Records</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">View consultation records</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Vitals Modal */}
      {showVitalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowVitalsModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Record Vital Signs</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter patient's current vital signs</p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Blood Pressure */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Blood Pressure (mmHg)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Systolic"
                      value={vitalsForm.bloodPressureSys}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressureSys: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <span className="text-gray-500">/</span>
                    <input
                      type="number"
                      placeholder="Diastolic"
                      value={vitalsForm.bloodPressureDia}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressureDia: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Heart Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    placeholder="e.g., 72"
                    value={vitalsForm.heartRate}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 36.5"
                    value={vitalsForm.temperature}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Respiratory Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Respiratory Rate (breaths/min)</label>
                  <input
                    type="number"
                    placeholder="e.g., 16"
                    value={vitalsForm.respiratoryRate}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, respiratoryRate: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Oxygen Saturation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Oxygen Saturation (%)</label>
                  <input
                    type="number"
                    placeholder="e.g., 98"
                    value={vitalsForm.oxygenSaturation}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, oxygenSaturation: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Weight */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 70.5"
                    value={vitalsForm.weight}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, weight: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Height */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 175"
                    value={vitalsForm.height}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, height: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Notes */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Any additional observations..."
                    value={vitalsForm.notes}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowVitalsModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVitals}
                disabled={savingVitals}
                className="px-4 py-2 text-sm font-medium text-white bg-lime-600 hover:bg-lime-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {savingVitals ? 'Saving...' : 'Save Vitals'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
