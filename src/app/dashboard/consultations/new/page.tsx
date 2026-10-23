'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, Appointment } from '@/lib/api';
import { useToast } from '@/components/toast';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { toLocalDateString } from '@/lib/formatters';

interface ConsultationFormData {
  chiefComplaint: string;
  symptoms: string[];
  examination: string;
  diagnosis: string[];
  diagnosisCodes: string[];
  treatmentPlan: string;
  notes: string;
  followUpDate: string;
}

const initialFormData: ConsultationFormData = {
  chiefComplaint: '',
  symptoms: [],
  examination: '',
  diagnosis: [],
  diagnosisCodes: [],
  treatmentPlan: '',
  notes: '',
  followUpDate: '',
};

export default function NewConsultationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get('appointmentId');
  const { user } = useAuth();
  const toast = useToast();
  const { t, tEnum, formatDate: formatLocaleDate, formatTime } = useLanguage();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<ConsultationFormData>(initialFormData);
  const [symptomInput, setSymptomInput] = useState('');
  const [diagnosisInput, setDiagnosisInput] = useState('');

  const fetchAppointment = useCallback(async () => {
    if (!appointmentId) {
      setError(t('clinical.consultationNew.noAppointmentId'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await api.getAppointment(appointmentId);
      setAppointment(data);

      // Pre-fill chief complaint with appointment reason
      if (data.reason) {
        setFormData(prev => ({ ...prev, chiefComplaint: data.reason }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clinical.consultationNew.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [appointmentId, t]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appointment) {
      toast.error(t('clinical.consultationNew.noAppointment'), t('clinical.consultationNew.selectValid'));
      return;
    }

    if (!formData.chiefComplaint.trim()) {
      toast.error(t('clinical.consultations.complaintRequired'), t('clinical.consultations.enterComplaint'));
      return;
    }

    try {
      setSubmitting(true);

      await api.createConsultation({
        appointmentId: appointment.id,
        chiefComplaint: formData.chiefComplaint,
        symptoms: formData.symptoms.length > 0 ? formData.symptoms : undefined,
        examination: formData.examination || undefined,
        diagnosis: formData.diagnosis.length > 0 ? formData.diagnosis : undefined,
        diagnosisCodes: formData.diagnosisCodes.length > 0 ? formData.diagnosisCodes : undefined,
        treatmentPlan: formData.treatmentPlan || undefined,
        notes: formData.notes || undefined,
        followUpDate: formData.followUpDate || undefined,
      });

      toast.success(t('clinical.consultations.created'), t('clinical.consultations.createdMessage', { name: `${appointment.patient.firstName} ${appointment.patient.lastName}` }));
      router.push('/dashboard/consultations');
    } catch (err) {
      toast.error(t('clinical.consultations.createFailed'), err instanceof Error ? err.message : t('clinical.common.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const addSymptom = () => {
    if (symptomInput.trim() && !formData.symptoms.includes(symptomInput.trim())) {
      setFormData({ ...formData, symptoms: [...formData.symptoms, symptomInput.trim()] });
      setSymptomInput('');
    }
  };

  const removeSymptom = (symptom: string) => {
    setFormData({ ...formData, symptoms: formData.symptoms.filter(s => s !== symptom) });
  };

  const addDiagnosis = () => {
    if (diagnosisInput.trim() && !formData.diagnosis.includes(diagnosisInput.trim())) {
      setFormData({ ...formData, diagnosis: [...formData.diagnosis, diagnosisInput.trim()] });
      setDiagnosisInput('');
    }
  };

  const removeDiagnosis = (diagnosis: string) => {
    setFormData({ ...formData, diagnosis: formData.diagnosis.filter(d => d !== diagnosis) });
  };

  const formatDate = (dateString: string) =>
    formatLocaleDate(dateString, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('clinical.consultationNew.loading')}</p>
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
          <p className="text-red-600 dark:text-red-400 mb-4">{error || t('clinical.consultationNew.notFound')}</p>
          <Link
            href="/dashboard/consultations"
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700"
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
    <div className="max-w-4xl mx-auto">
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
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('clinical.consultationNew.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{t('clinical.consultationNew.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Patient & Appointment Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-lime-100 dark:bg-lime-900/50 flex items-center justify-center">
            <span className="text-lime-600 dark:text-lime-400 font-bold text-xl">
              {appointment.patient.firstName[0]}{appointment.patient.lastName[0]}
            </span>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {appointment.patient.firstName} {appointment.patient.lastName}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">{appointment.patient.patientId}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(appointment.appointmentDate)}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTime(appointment.startTime)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-sm rounded-full">
              {tEnum(appointment.status)}
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{appointment.reason}</p>
          </div>
        </div>
      </div>

      {/* Consultation Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-6 space-y-6">
          {/* Chief Complaint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('clinical.common.chiefComplaint')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.chiefComplaint}
              onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
              placeholder={t('clinical.consultations.complaintPlaceholder')}
              rows={2}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
            />
          </div>

          {/* Symptoms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('clinical.common.symptoms')}
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={symptomInput}
                onChange={(e) => setSymptomInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSymptom())}
                placeholder={t('clinical.consultations.addSymptom')}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={addSymptom}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {t('clinical.common.add')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.symptoms.map((symptom, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                  {symptom}
                  <button type="button" onClick={() => removeSymptom(symptom)} className="hover:text-blue-900 dark:hover:text-blue-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Examination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('clinical.consultations.physicalExam')}
            </label>
            <textarea
              value={formData.examination}
              onChange={(e) => setFormData({ ...formData, examination: e.target.value })}
              placeholder={t('clinical.consultations.examPlaceholder')}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
            />
          </div>

          {/* Diagnosis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('clinical.common.diagnosis')}
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={diagnosisInput}
                onChange={(e) => setDiagnosisInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDiagnosis())}
                placeholder={t('clinical.consultations.addDiagnosis')}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={addDiagnosis}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {t('clinical.common.add')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.diagnosis.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full text-sm">
                  {d}
                  <button type="button" onClick={() => removeDiagnosis(d)} className="hover:text-green-900 dark:hover:text-green-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Treatment Plan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('clinical.common.treatmentPlan')}
            </label>
            <textarea
              value={formData.treatmentPlan}
              onChange={(e) => setFormData({ ...formData, treatmentPlan: e.target.value })}
              placeholder={t('clinical.consultations.treatmentPlaceholder')}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
            />
          </div>

          {/* Follow-up Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('clinical.common.followUpDate')}
            </label>
            <input
              type="date"
              value={formData.followUpDate}
              onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              min={toLocalDateString()}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('clinical.common.additionalNotes')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={t('clinical.common.notesPlaceholder')}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <Link
            href="/dashboard/consultations"
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('clinical.common.cancel')}
          </Link>
          <button
            type="submit"
            disabled={submitting || !formData.chiefComplaint.trim()}
            className="px-6 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t('clinical.common.creating') : t('clinical.consultations.complete')}
          </button>
        </div>
      </form>
    </div>
  );
}
