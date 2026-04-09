'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ConsultationDetail } from '@/lib/api';

export default function ConsultationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [consultation, setConsultation] = useState<ConsultationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'vitals' | 'history' | 'prescriptions' | 'labs'>('overview');

  useEffect(() => {
    const fetchConsultation = async () => {
      try {
        setLoading(true);
        const data = await api.getConsultation(params.id as string);
        setConsultation(data);
      } catch (error) {
        console.error('Error fetching consultation:', error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchConsultation();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Consultation not found</p>
        <button onClick={() => router.back()} className="mt-4 text-lime-600 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Medical Record</h1>
          <p className="text-gray-600 dark:text-gray-400">{formatDate(consultation.appointmentDate)}</p>
        </div>
      </div>

      {/* Patient & Doctor Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Patient</h3>
          <p className="font-medium text-gray-900 dark:text-white">{consultation.patient.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{consultation.patient.hospitalId}</p>
          <div className="mt-2 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>{consultation.patient.gender}</span>
            <span>{consultation.patient.bloodType}</span>
          </div>
          <Link href={`/dashboard/patients/${consultation.patientId}`} className="text-sm text-lime-600 hover:underline mt-2 inline-block">
            View Patient Profile
          </Link>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Attending Physician</h3>
          <p className="font-medium text-gray-900 dark:text-white">{consultation.doctor.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{consultation.doctor.department}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {consultation.doctor.specializations.map((spec, i) => (
              <span key={i} className="px-2 py-0.5 bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-400 rounded text-xs">
                {spec}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px overflow-x-auto">
            {(['overview', 'vitals', 'history', 'prescriptions', 'labs'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'border-lime-600 text-lime-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Chief Complaint</h3>
                <p className="text-gray-900 dark:text-white">{consultation.chiefComplaint}</p>
              </div>

              {consultation.symptoms.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Symptoms</h3>
                  <div className="flex flex-wrap gap-2">
                    {consultation.symptoms.map((symptom, i) => (
                      <span key={i} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300">
                        {symptom}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {consultation.examination && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Examination</h3>
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{consultation.examination}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Diagnosis</h3>
                <div className="flex flex-wrap gap-2">
                  {consultation.diagnosis.map((d, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400 rounded-full text-sm">
                      {d}
                      {consultation.diagnosisCodes[i] && (
                        <span className="ml-1 opacity-75">({consultation.diagnosisCodes[i]})</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {consultation.treatmentPlan && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Treatment Plan</h3>
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{consultation.treatmentPlan}</p>
                </div>
              )}

              {consultation.followUpDate && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Follow-up Date</h3>
                  <p className="text-gray-900 dark:text-white">{formatDate(consultation.followUpDate)}</p>
                </div>
              )}

              {consultation.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Notes</h3>
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{consultation.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'vitals' && (
            <div>
              {consultation.patient.vitals.length === 0 ? (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">No vital signs recorded</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2">BP</th>
                        <th className="px-4 py-2">HR</th>
                        <th className="px-4 py-2">Temp</th>
                        <th className="px-4 py-2">SpO2</th>
                        <th className="px-4 py-2">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {consultation.patient.vitals.map((vital) => (
                        <tr key={vital.id}>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">
                            {formatDate(vital.recordedAt)}
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                            {vital.bloodPressure || '-'}
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                            {vital.heartRate ? `${vital.heartRate} bpm` : '-'}
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                            {vital.temperature ? `${vital.temperature}°F` : '-'}
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                            {vital.oxygenSaturation ? `${vital.oxygenSaturation}%` : '-'}
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                            {vital.weight ? `${vital.weight} kg` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Allergies</h3>
                {consultation.patient.allergies.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No known allergies</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {consultation.patient.allergies.map((allergy, i) => (
                      <span key={i} className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400 rounded-full text-sm">
                        {allergy}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Chronic Conditions</h3>
                {consultation.patient.chronicConditions.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No chronic conditions</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {consultation.patient.chronicConditions.map((condition, i) => (
                      <span key={i} className="px-3 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400 rounded-full text-sm">
                        {condition}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Medical History</h3>
                {consultation.patient.medicalHistory.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No medical history recorded</p>
                ) : (
                  <div className="space-y-3">
                    {consultation.patient.medicalHistory.map((history) => (
                      <div key={history.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900 dark:text-white">{history.condition}</p>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            history.status === 'active'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                              : history.status === 'resolved'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400'
                          }`}>
                            {history.status}
                          </span>
                        </div>
                        {history.diagnosedAt && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Diagnosed: {formatDate(history.diagnosedAt)}
                          </p>
                        )}
                        {history.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{history.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'prescriptions' && (
            <div>
              {consultation.prescriptions.length === 0 ? (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">No prescriptions</p>
              ) : (
                <div className="space-y-4">
                  {consultation.prescriptions.map((rx) => (
                    <div key={rx.id} className="p-4 border border-gray-100 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          rx.status === 'DISPENSED'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                            : rx.status === 'ACTIVE'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {rx.status}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(rx.createdAt)}</span>
                      </div>
                      <div className="space-y-2">
                        {rx.items.map((item, i) => (
                          <div key={i} className="flex items-start justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {item.medication} {item.strength}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {item.dosage} - {item.frequency} for {item.duration}
                              </p>
                              {item.instructions && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.instructions}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Qty: {item.quantity}</span>
                              {item.isDispensed && (
                                <span className="block text-xs text-green-600">Dispensed</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'labs' && (
            <div>
              {consultation.labOrders.length === 0 ? (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">No lab orders</p>
              ) : (
                <div className="space-y-4">
                  {consultation.labOrders.map((order) => (
                    <div key={order.id} className="p-4 border border-gray-100 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            order.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400'
                              : order.status === 'PROCESSING'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400'
                          }`}>
                            {order.status.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            order.priority === 'STAT'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                              : order.priority === 'URGENT'
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {order.priority}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(order.createdAt)}</span>
                      </div>
                      <div className="space-y-2">
                        {order.tests.map((test, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{test.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{test.code}</p>
                            </div>
                            {test.result ? (
                              <span className={`font-medium ${test.isAbnormal ? 'text-red-600' : 'text-green-600'}`}>
                                {test.result}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">Pending</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
