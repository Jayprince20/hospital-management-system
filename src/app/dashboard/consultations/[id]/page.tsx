'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { useAuth } from '@/context/auth-context';
import { PermissionGate } from '@/components/permission-gate';
import { useLanguage } from '@/context/language-context';
import { NewDocumentDialog } from '@/components/documents';
import { NewImagingOrderDialog } from '@/components/imaging';
import { FollowUpDialog, FollowUpSummary } from '@/components/clinical-safety/follow-up';
import type { FollowUpAppointment } from '@/lib/clinical-safety';

interface ConsultationDetail {
  id: string;
  appointmentId?: string;
  patientId: string;
  patientName: string;
  patientHospitalId: string;
  doctorId: string;
  doctorName: string;
  department: string;
  chiefComplaint: string;
  symptoms: string[];
  examination?: string;
  diagnosis: string[];
  diagnosisCodes: string[];
  treatmentPlan?: string;
  notes?: string;
  followUpDate?: string;
  followUpAppointment?: FollowUpAppointment | null;
  prescriptionCount: number;
  labOrderCount: number;
  createdAt: string;
  patient: {
    id: string;
    hospitalId: string;
    name: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    bloodType?: string;
    allergies: string[];
    chronicConditions: string[];
  };
  doctor: {
    id: string;
    hospitalId: string;
    name: string;
    department: string;
    specializations: string[];
  };
  prescriptions: Array<{
    id: string;
    status: string;
    items: Array<{
      medication: string;
      genericName: string;
      strength: string;
      dosage: string;
      frequency: string;
      duration: string;
    }>;
    createdAt: string;
  }>;
  labOrders: Array<{
    id: string;
    status: string;
    testName: string;
    result?: string;
    createdAt: string;
  }>;
}

export default function ConsultationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { t, tEnum, formatDate: formatLocaleDate, formatDateTime } = useLanguage();

  const [consultation, setConsultation] = useState<ConsultationDetail | null>(null);
  const [documentDialog, setDocumentDialog] = useState(false);
  const [imagingDialog, setImagingDialog] = useState(false);
  const [followUpDialog, setFollowUpDialog] = useState(false);
  const canIssueDocuments = user?.role === 'DOCTOR' || user?.role === 'ADMIN';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConsultation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getConsultation(params.id as string);
      setConsultation(data as unknown as ConsultationDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clinical.consultationDetail.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [params.id, t]);

  useEffect(() => {
    fetchConsultation();
  }, [fetchConsultation]);

  const formatDate = (dateString: string) =>
    formatLocaleDate(dateString, { year: 'numeric', month: 'long', day: 'numeric' });

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('clinical.consultationDetail.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-600 dark:text-red-400 mb-4">{error || t('clinical.record.notFound')}</p>
          <Link
            href="/dashboard/consultations"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('clinical.consultationNew.back')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/dashboard/consultations"
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('clinical.consultations.details')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {formatDateTime(consultation.createdAt)}
            </p>
          </div>
          {canIssueDocuments && (
            <button
              type="button"
              onClick={() => setDocumentDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('mdoc.new.fromConsultation')}
            </button>
          )}
          {canIssueDocuments && (
            <button
              type="button"
              onClick={() => setImagingDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('img.order.fromConsultation')}
            </button>
          )}
          <PermissionGate permission="laboratory:create_orders">
            <Link
              href={`/dashboard/laboratory/orders/new?consultationId=${consultation.id}&patientId=${consultation.patient.id}${consultation.chiefComplaint ? `&clinicalInfo=${encodeURIComponent(consultation.chiefComplaint)}` : ''}`}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('labw.fromConsultation')}
            </Link>
          </PermissionGate>
          <PermissionGate permission="prescriptions:create">
            <Link
              href={`/dashboard/prescriptions/new?consultationId=${consultation.id}&patientId=${consultation.patient.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('clinical.consultationDetail.addPrescription')}
            </Link>
          </PermissionGate>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chief Complaint & Symptoms */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('clinical.common.chiefComplaint')}</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-900 dark:text-white text-lg">{consultation.chiefComplaint}</p>

              {consultation.symptoms.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('clinical.common.symptoms')}</p>
                  <div className="flex flex-wrap gap-2">
                    {consultation.symptoms.map((symptom, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                        {symptom}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Examination */}
          {consultation.examination && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">{t('clinical.consultations.physicalExam')}</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{consultation.examination}</p>
              </div>
            </div>
          )}

          {/* Diagnosis */}
          {consultation.diagnosis.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">{t('clinical.common.diagnosis')}</h2>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap gap-2">
                  {consultation.diagnosis.map((d, i) => (
                    <span key={i} className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full text-sm">
                      {consultation.diagnosisCodes[i] && <span className="font-mono text-xs font-semibold mr-1.5">{consultation.diagnosisCodes[i]}</span>}
                      {d}
                    </span>
                  ))}
                </div>
                {consultation.diagnosisCodes.length > 0 && (
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    {t('clinical.consultationDetail.icdCodes', { codes: consultation.diagnosisCodes.join(', ') })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Treatment Plan */}
          {consultation.treatmentPlan && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">{t('clinical.common.treatmentPlan')}</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{consultation.treatmentPlan}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          {consultation.notes && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">{t('clinical.common.additionalNotes')}</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{consultation.notes}</p>
              </div>
            </div>
          )}

          {/* Prescriptions */}
          {consultation.prescriptions && consultation.prescriptions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">{t('nav.prescriptions')}</h2>
                <span className="px-2 py-1 bg-lime-100 dark:bg-lime-900/50 text-lime-700 dark:text-lime-300 text-xs rounded-full">
                  {consultation.prescriptions.length}
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {consultation.prescriptions.map((rx) => (
                  <div key={rx.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        rx.status === 'DISPENSED'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                      }`}>
                        {tEnum(rx.status)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(rx.createdAt)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {rx.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-lime-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                          </svg>
                          <div>
                            <p className="text-gray-900 dark:text-white font-medium">
                              {item.medication} {item.strength}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {t('clinical.common.dosageLine', { dosage: item.dosage, frequency: item.frequency, duration: item.duration })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Link
                      href={`/dashboard/prescriptions/${rx.id}`}
                      className="mt-3 inline-flex items-center text-sm text-lime-600 hover:text-lime-700"
                    >
                      {t('clinical.common.viewDetails')}
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lab Orders */}
          {consultation.labOrders && consultation.labOrders.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">{t('clinical.common.labOrders')}</h2>
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                  {consultation.labOrders.length}
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {consultation.labOrders.map((lab) => (
                  <div key={lab.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{lab.testName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDateTime(lab.createdAt)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        lab.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                          : lab.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      }`}>
                        {tEnum(lab.status)}
                      </span>
                    </div>
                    {lab.result && (
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        {t('clinical.consultationDetail.result', { result: lab.result })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Patient Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('clinical.consultationDetail.patientInfo')}</h2>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-lime-100 dark:bg-lime-900/50 flex items-center justify-center">
                  <span className="text-lime-600 dark:text-lime-400 font-bold text-lg">
                    {consultation.patient.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{consultation.patient.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{consultation.patient.hospitalId}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('clinical.common.age')}</span>
                  <span className="text-gray-900 dark:text-white">
                    {t('unit.years', { count: calculateAge(consultation.patient.dateOfBirth) })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('clinical.common.gender')}</span>
                  <span className="text-gray-900 dark:text-white">{tEnum(consultation.patient.gender)}</span>
                </div>
                {consultation.patient.bloodType && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('clinical.common.bloodType')}</span>
                    <span className="text-gray-900 dark:text-white">{tEnum(consultation.patient.bloodType)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('clinical.common.phone')}</span>
                  <span className="text-gray-900 dark:text-white">{consultation.patient.phone || t('clinical.common.na')}</span>
                </div>
              </div>

              {consultation.patient.allergies.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">{t('clinical.common.allergies')}</p>
                  <div className="flex flex-wrap gap-1">
                    {consultation.patient.allergies.map((allergy, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs rounded">
                        {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {consultation.patient.chronicConditions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">{t('clinical.common.chronicConditions')}</p>
                  <div className="flex flex-wrap gap-1">
                    {consultation.patient.chronicConditions.map((condition, i) => (
                      <span key={i} className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-xs rounded">
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Link
                href={`/dashboard/patients/${consultation.patient.id}`}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/30 rounded-lg transition-colors text-sm"
              >
                {t('clinical.common.viewFullProfile')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Doctor Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('clinical.record.attendingPhysician')}</h2>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {consultation.doctor.name.split(' ').filter(n => n !== 'Dr.').slice(-2).map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{consultation.doctor.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{consultation.doctor.department}</p>
                </div>
              </div>
              {consultation.doctor.specializations.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {consultation.doctor.specializations.map((spec, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded">
                      {spec}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Follow-up */}
          {(consultation.followUpDate || consultation.followUpAppointment || canIssueDocuments) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-lime-200 dark:border-lime-800">
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-lime-100 dark:bg-lime-900/50 rounded-lg">
                    <svg className="w-5 h-5 text-lime-600 dark:text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('clinical.common.followUpDate')}</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {consultation.followUpDate ? formatDate(consultation.followUpDate) : '—'}
                    </p>
                  </div>
                </div>
                {(consultation.followUpAppointment || canIssueDocuments) && (
                  <FollowUpSummary appointment={consultation.followUpAppointment} canBook={canIssueDocuments} onBook={() => setFollowUpDialog(true)} />
                )}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('clinical.common.summary')}</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{consultation.prescriptionCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('nav.prescriptions')}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{consultation.labOrderCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('clinical.common.labOrders')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {followUpDialog && (
        <FollowUpDialog
          consultationId={consultation.id}
          doctorId={consultation.doctor.id}
          initialDate={consultation.followUpDate?.slice(0, 10)}
          onClose={() => setFollowUpDialog(false)}
          onBooked={() => {
            setFollowUpDialog(false);
            toast.success(t('cs.followUp.booked'));
            void fetchConsultation();
          }}
        />
      )}
      {imagingDialog && (
        <NewImagingOrderDialog
          patient={{ id: consultation.patient.id, patientId: consultation.patient.hospitalId, name: consultation.patient.name }}
          consultationId={consultation.id}
          prefillClinicalInfo={[
            consultation.chiefComplaint,
            consultation.examination ?? '',
            consultation.diagnosis.length > 0 ? `${t('mdoc.prefill.diagnosis')} : ${consultation.diagnosis.join(', ')}` : '',
          ]
            .filter(Boolean)
            .join('\n')}
          onClose={() => setImagingDialog(false)}
        />
      )}
      {documentDialog && (
        <NewDocumentDialog
          patient={{ id: consultation.patient.id, patientId: consultation.patient.hospitalId, name: consultation.patient.name }}
          consultationId={consultation.id}
          prefill={{
            reason: consultation.diagnosis.length > 0 ? consultation.diagnosis.join(', ') : consultation.chiefComplaint,
            clinicalSummary: [
              consultation.chiefComplaint,
              consultation.symptoms.length > 0 ? consultation.symptoms.join(', ') : '',
              consultation.examination ?? '',
              consultation.diagnosis.length > 0 ? `${t('mdoc.prefill.diagnosis')} : ${consultation.diagnosis.join(', ')}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
            currentTreatment: consultation.treatmentPlan ?? '',
          }}
          onClose={() => setDocumentDialog(false)}
        />
      )}
    </div>
  );
}
