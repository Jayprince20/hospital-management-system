'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, Appointment, Consultation } from '@/lib/api';
import { useToast } from '@/components/toast';
import { useAuth } from '@/context/auth-context';
import { PermissionGate } from '@/components/permission-gate';
import { useLanguage } from '@/context/language-context';
import { DiagnosisPicker, MdoBanner } from '@/components/clinical-safety/diagnosis-picker';
import { AllergyStrip, PrescriptionSafetyPanel, usePrescriptionSafety } from '@/components/clinical-safety/safety';
import { LatestVitalsCard } from '@/components/clinical-safety/vitals';
import { FollowUpDialog, FollowUpSummary } from '@/components/clinical-safety/follow-up';
import { PatientAttachmentsPanel, ProblemListPanel, SaveAsTemplateDialog, TemplatePickerDialog, TemplateSuggestionsPanel, type SuggestedRxItem } from '@/components/clinical-docs';
import { mergeTemplate, type ConsultationTemplate, type TemplateSuggestions } from '@/lib/clinical-docs';
import { todayString } from '@/lib/maternal-child';
import { useOnlineOnly } from '@/components/offline/connectivity-indicator';
import {
  canSubmitPrescription,
  diagnosesFromArrays,
  diagnosesPayload,
  safetyAlertsFromError,
  type DiagnosisEntry,
  type FollowUpAppointment,
  type MdoAlert,
  type SafetyAlert,
} from '@/lib/clinical-safety';

interface ConsultationForm {
  chiefComplaint: string;
  symptoms: string[];
  examination: string;
  diagnoses: DiagnosisEntry[];
  treatmentPlan: string;
  notes: string;
  followUpDate: string;
}

interface PrescriptionItem {
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
}

interface LabOrderItem {
  labTestId: string;
  testName: string;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  notes: string;
}

export default function ConsultationPage() {
  const onlineOnly = useOnlineOnly();
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { t, tEnum, formatDate, formatTime } = useLanguage();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [existingConsultation, setExistingConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'consultation' | 'prescription' | 'lab-orders'>('consultation');

  const [consultationForm, setConsultationForm] = useState<ConsultationForm>({
    chiefComplaint: '',
    symptoms: [],
    examination: '',
    diagnoses: [],
    treatmentPlan: '',
    notes: '',
    followUpDate: '',
  });

  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [labOrderItems, setLabOrderItems] = useState<LabOrderItem[]>([]);
  // Files added before the consultation exists: linked to it once saved
  const unlinkedUploads = useRef<string[]>([]);
  const [symptomInput, setSymptomInput] = useState('');
  // Prescribing safety: justification when an alert blocks, and alerts returned by a refused save
  const [safetyOverride, setSafetyOverride] = useState('');
  const [savedAlerts, setSavedAlerts] = useState<SafetyAlert[] | null>(null);
  const [mdoAlerts, setMdoAlerts] = useState<MdoAlert[]>([]);
  const [followUp, setFollowUp] = useState<FollowUpAppointment | null>(null);
  const [bookingFollowUp, setBookingFollowUp] = useState(false);
  // Consultation templates: picker, orders the applied template proposes, save the write-up as a template
  const [pickingTemplate, setPickingTemplate] = useState(false);
  const [suggestions, setSuggestions] = useState<{ name: string; items: TemplateSuggestions } | null>(null);
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);

  const [medications, setMedications] = useState<Array<{ id: string; name: string; dosageForm: string }>>([]);
  const [labTests, setLabTests] = useState<Array<{ id: string; name: string; code: string }>>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const appointmentData = await api.getAppointment(params.id as string);
      setAppointment(appointmentData);

      // Fetch medications and lab tests for dropdowns
      const [medsRes, labsRes] = await Promise.all([
        api.getMedications({ isActive: true, limit: 100 }),
        api.getLabTests({ isActive: true, limit: 100 }),
      ]);

      if (medsRes.medications) {
        setMedications(medsRes.medications.map(m => ({
          id: m.id,
          name: m.name,
          dosageForm: m.dosageForm || '',
        })));
      }

      if (labsRes.labTests) {
        setLabTests(labsRes.labTests.map(t => ({
          id: t.id,
          name: t.name,
          code: t.code,
        })));
      }

      // Check if there's an existing consultation for this appointment
      try {
        const consultationsRes = await api.getConsultations({ patientId: appointmentData.patient.id, limit: 100 });
        // Find consultation for this specific appointment
        const existing = consultationsRes.consultations?.find(
          (c) => c.appointmentId === params.id
        );
        if (existing) {
          setExistingConsultation(existing);
          setConsultationForm({
            chiefComplaint: existing.chiefComplaint || '',
            symptoms: existing.symptoms || [],
            examination: existing.examination || '',
            diagnoses: diagnosesFromArrays(existing.diagnosis, existing.diagnosisCodes),
            treatmentPlan: existing.treatmentPlan || '',
            notes: existing.notes || '',
            followUpDate: existing.followUpDate || '',
          });
          api.getConsultation(existing.id).then((d) => setFollowUp(d.followUpAppointment ?? null)).catch(() => setFollowUp(null));
        }
      } catch {
        // No existing consultation, that's okay
      }
    } catch (err) {
      toast.error(t('common.error'), t('consultationForm.errLoad'));
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [params.id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddSymptom = () => {
    if (symptomInput.trim() && !consultationForm.symptoms.includes(symptomInput.trim())) {
      setConsultationForm(prev => ({
        ...prev,
        symptoms: [...prev.symptoms, symptomInput.trim()],
      }));
      setSymptomInput('');
    }
  };

  const handleRemoveSymptom = (symptom: string) => {
    setConsultationForm(prev => ({
      ...prev,
      symptoms: prev.symptoms.filter(s => s !== symptom),
    }));
  };

  const handleAddPrescriptionItem = () => {
    setPrescriptionItems(prev => [...prev, {
      medicationId: '',
      medicationName: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity: 1,
      instructions: '',
    }]);
  };

  const handleRemovePrescriptionItem = (index: number) => {
    setPrescriptionItems(prev => prev.filter((_, i) => i !== index));
  };

  const handlePrescriptionItemChange = (index: number, field: keyof PrescriptionItem, value: string | number) => {
    setPrescriptionItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      if (field === 'medicationId') {
        const med = medications.find(m => m.id === value);
        return { ...item, medicationId: value as string, medicationName: med?.name || '' };
      }
      return { ...item, [field]: value };
    }));
  };

  const handleAddLabOrderItem = () => {
    setLabOrderItems(prev => [...prev, {
      labTestId: '',
      testName: '',
      priority: 'ROUTINE',
      notes: '',
    }]);
  };

  const handleRemoveLabOrderItem = (index: number) => {
    setLabOrderItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleLabOrderItemChange = (index: number, field: keyof LabOrderItem, value: string) => {
    setLabOrderItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      if (field === 'labTestId') {
        const test = labTests.find(t => t.id === value);
        return { ...item, labTestId: value, testName: test?.name || '' };
      }
      return { ...item, [field]: value };
    }));
  };

  // Text is merged (never overwritten); orders come back as suggestions the doctor confirms
  const applyTemplate = (template: ConsultationTemplate) => {
    const merged = mergeTemplate(consultationForm, template, todayString());
    setConsultationForm((prev) => ({ ...prev, ...merged.form }));
    const hasOrders = merged.suggestions.prescriptionLines.length > 0 || merged.suggestions.labTests.length > 0;
    setSuggestions(hasOrders ? { name: template.name, items: merged.suggestions } : null);
    setPickingTemplate(false);
    setActiveTab('consultation');
    toast.success(t('cdoc.tpl.applied'), t('cdoc.tpl.appliedMessage', { name: template.name }));
  };

  const addSuggestedOrders = (rx: SuggestedRxItem[], lab: Array<{ id: string; name: string }>) => {
    const newRx = rx.filter((item) => !prescriptionItems.some((p) => p.medicationId === item.medicationId));
    const newLab = lab.filter((test) => !labOrderItems.some((l) => l.labTestId === test.id));
    if (newRx.length) setPrescriptionItems((prev) => [...prev, ...newRx.map((item) => ({ ...item, quantity: 1 }))]);
    if (newLab.length) setLabOrderItems((prev) => [...prev, ...newLab.map((test) => ({ labTestId: test.id, testName: test.name, priority: 'ROUTINE' as const, notes: '' }))]);
    setSuggestions(null);
    toast.success(t('cdoc.sugg.added', { rx: newRx.length, lab: newLab.length }));
  };

  const safety = usePrescriptionSafety(appointment?.patient.id, prescriptionItems.map((item) => item.medicationId));
  const hasRxItems = prescriptionItems.some((item) => item.medicationId);
  const rxAllowed = !hasRxItems || canSubmitPrescription(safety.check, savedAlerts, safetyOverride);

  // Alerts from a refused save no longer apply once the medicines change
  useEffect(() => {
    setSavedAlerts(null);
  }, [prescriptionItems]);

  const reloadFollowUp = async (consultationId: string) => {
    try {
      setFollowUp((await api.getConsultation(consultationId)).followUpAppointment ?? null);
    } catch {
      setFollowUp(null);
    }
  };

  const handleSaveConsultation = async () => {
    if (!appointment || !consultationForm.chiefComplaint) {
      toast.error(t('common.error'), t('consultationForm.errComplaint'));
      return;
    }

    if (!rxAllowed) {
      setActiveTab('prescription');
      toast.error(t('common.error'), t('cs.safety.blockedOnSave'));
      return;
    }

    // Check the prescription lines before saving anything (the server refuses lines without these fields)
    const incomplete = prescriptionItems.findIndex((item) => item.medicationId && (!item.dosage.trim() || !item.frequency.trim() || !item.duration.trim()));
    if (incomplete !== -1) {
      setActiveTab('prescription');
      toast.error(t('common.error'), t('cs.rx.incompleteLine', { n: incomplete + 1 }));
      return;
    }

    try {
      setSaving(true);

      // Save or update consultation
      const diagnoses = diagnosesPayload(consultationForm.diagnoses);
      const saved = existingConsultation
        ? await api.updateConsultation(existingConsultation.id, {
            chiefComplaint: consultationForm.chiefComplaint,
            symptoms: consultationForm.symptoms,
            examination: consultationForm.examination,
            diagnoses,
            treatmentPlan: consultationForm.treatmentPlan,
            notes: consultationForm.notes,
            followUpDate: consultationForm.followUpDate || null,
          })
        : await api.createConsultation({
            appointmentId: appointment.id,
            chiefComplaint: consultationForm.chiefComplaint,
            symptoms: consultationForm.symptoms,
            examination: consultationForm.examination,
            diagnoses,
            treatmentPlan: consultationForm.treatmentPlan,
            notes: consultationForm.notes,
            followUpDate: consultationForm.followUpDate,
          });
      // A retry after a refused prescription must update this consultation, not create another
      setExistingConsultation(saved);
      const newMdo = saved.mdoAlerts ?? [];
      if (newMdo.length) setMdoAlerts(newMdo);

      // Create prescription if there are items
      if (prescriptionItems.length > 0 && prescriptionItems.some(item => item.medicationId)) {
        const validItems = prescriptionItems.filter(item => item.medicationId);
        try {
          await api.createPrescription({
            patientId: appointment.patient.id,
            doctorId: appointment.doctor.id,
            consultationId: saved.id,
            ...(safetyOverride.trim() ? { safetyOverride: safetyOverride.trim() } : {}),
            items: validItems.map(item => ({
            medicationId: item.medicationId,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            quantity: item.quantity,
            instructions: item.instructions,
            })),
          });
        } catch (err) {
          const alerts = safetyAlertsFromError(err);
          if (!alerts) throw err;
          setSavedAlerts(alerts);
          setActiveTab('prescription');
          toast.error(t('common.error'), t('cs.safety.blockedOnSave'));
          return;
        }
        // Saved: don't create the same prescription again on a later save
        setPrescriptionItems([]);
        setSafetyOverride('');
      }

      if (unlinkedUploads.current.length > 0) {
        const ids = unlinkedUploads.current;
        unlinkedUploads.current = [];
        await Promise.all(ids.map((id) => api.updateAttachment(id, { consultationId: saved.id }).catch(() => undefined)));
      }

      // Create lab orders if there are items
      if (labOrderItems.length > 0 && labOrderItems.some(item => item.labTestId)) {
        const validItems = labOrderItems.filter(item => item.labTestId);
        await api.createLabOrder({
          patientId: appointment.patient.id,
          doctorId: appointment.doctor.id,
          consultationId: saved.id,
          priority: validItems[0]?.priority || 'ROUTINE',
          notes: validItems.map(item => item.notes).filter(Boolean).join('; '),
          tests: validItems.map(item => ({ labTestId: item.labTestId })),
        });
      }

      // Update appointment status to completed
      await api.updateAppointment(appointment.id, { status: 'COMPLETED' });

      toast.success(t('common.success'), t('consultationForm.saved'));
      // Stay on the page when a notifiable disease must be reported, so the banner is seen
      if (newMdo.length === 0) router.push(`/dashboard/appointments/${appointment.id}`);
    } catch (err) {
      toast.error(t('common.error'), t('consultationForm.errSave'));
      console.error('Error saving consultation:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('appointmentDetail.notFound')}</h2>
        <Link href="/dashboard/appointments" className="text-lime-600 hover:underline mt-4 inline-block">
          {t('appointmentDetail.back')}
        </Link>
      </div>
    );
  }

  return (
    <PermissionGate permission="appointments:start_consultation" fallback={
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('consultationForm.accessDenied')}</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">{t('consultationForm.noPermission')}</p>
      </div>
    }>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href={`/dashboard/appointments/${appointment.id}`}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('consultationForm.backToAppointment')}
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
              {t('consultationForm.title')}
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPickingTemplate(true)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h4" />
            </svg>
            {t('cdoc.tpl.button')}
          </button>
          <button
            type="button"
            onClick={() => setSavingAsTemplate(true)}
            disabled={!existingConsultation}
            title={existingConsultation ? undefined : t('cdoc.tpl.saveAsNeedsSave')}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('cdoc.tpl.saveAs')}
          </button>
          <button
            onClick={handleSaveConsultation}
            disabled={saving || !consultationForm.chiefComplaint || onlineOnly.offline}
            title={onlineOnly.hint}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {t('consultationForm.complete')}
          </button>
          </div>
        </div>

        {/* Patient Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
              {appointment.patient.profileImageUrl ? (
                <img src={appointment.patient.profileImageUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-xl font-semibold text-gray-600 dark:text-gray-300">
                  {appointment.patient.firstName[0]}{appointment.patient.lastName[0]}
                </span>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {appointment.patient.firstName} {appointment.patient.lastName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {appointment.patient.patientId}
                {appointment.patient.gender && ` | ${tEnum(appointment.patient.gender)}`}
                {appointment.patient.dateOfBirth && ` | ${t('unit.years', { count: new Date().getFullYear() - new Date(appointment.patient.dateOfBirth).getFullYear() })}`}
              </p>
              <div className="flex gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                <span>{t('consultationForm.phoneValue', { value: appointment.patient.phoneNumber })}</span>
                <span>{t('consultationForm.emailValue', { value: appointment.patient.email })}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{tEnum(appointment.type)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatDate(appointment.appointmentDate)} {t('appointmentForm.at')} {formatTime(appointment.startTime)}
              </p>
              {appointment.reason && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('consultationForm.reasonValue', { value: appointment.reason })}</p>
              )}
            </div>
          </div>
        </div>

        {mdoAlerts.length > 0 && (
          <div className="mb-6">
            <MdoBanner alerts={mdoAlerts} />
          </div>
        )}

        <div className="mb-6">
          <LatestVitalsCard patientId={appointment.patient.id} />
        </div>

        {suggestions && (
          <div className="mb-6">
            <TemplateSuggestionsPanel
              key={suggestions.name}
              templateName={suggestions.name}
              suggestions={suggestions.items}
              medications={medications}
              onAdd={addSuggestedOrders}
              onDismiss={() => setSuggestions(null)}
            />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <div className="min-w-0">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('consultation')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'consultation'
                ? 'border-lime-600 text-lime-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {t('consultationForm.tabNotes')}
          </button>
          <button
            onClick={() => setActiveTab('prescription')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'prescription'
                ? 'border-lime-600 text-lime-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {t('consultationForm.tabPrescription', { count: prescriptionItems.length })}
          </button>
          <button
            onClick={() => setActiveTab('lab-orders')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'lab-orders'
                ? 'border-lime-600 text-lime-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {t('consultationForm.tabLab', { count: labOrderItems.length })}
          </button>
        </div>

        {/* Consultation Notes Tab */}
        {activeTab === 'consultation' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="space-y-6">
              {/* Chief Complaint */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('consultationForm.chiefComplaint')}
                </label>
                <textarea
                  value={consultationForm.chiefComplaint}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  placeholder={t('consultationForm.complaintPh')}
                />
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('consultationForm.symptoms')}
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={symptomInput}
                    onChange={(e) => setSymptomInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSymptom())}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    placeholder={t('consultationForm.symptomPh')}
                  />
                  <button
                    type="button"
                    onClick={handleAddSymptom}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500"
                  >
                    {t('consultationForm.add')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {consultationForm.symptoms.map((symptom) => (
                    <span
                      key={symptom}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                    >
                      {symptom}
                      <button onClick={() => handleRemoveSymptom(symptom)} className="hover:text-red-500">
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
                  {t('consultationForm.examination')}
                </label>
                <textarea
                  value={consultationForm.examination}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, examination: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  placeholder={t('consultationForm.examinationPh')}
                />
              </div>

              {/* Diagnosis (ICD-10) */}
              <DiagnosisPicker
                value={consultationForm.diagnoses}
                onChange={(diagnoses) => setConsultationForm(prev => ({ ...prev, diagnoses }))}
              />

              {/* Treatment Plan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('consultationForm.treatmentPlan')}
                </label>
                <textarea
                  value={consultationForm.treatmentPlan}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, treatmentPlan: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  placeholder={t('consultationForm.treatmentPh')}
                />
              </div>

              {/* Follow-up Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('consultationForm.followUp')}
                </label>
                <input
                  type="date"
                  value={consultationForm.followUpDate}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, followUpDate: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                />
                <div className="mt-3">
                  <FollowUpSummary
                    appointment={followUp}
                    canBook={Boolean(existingConsultation)}
                    onBook={() => setBookingFollowUp(true)}
                    hint={existingConsultation ? undefined : t('cs.followUp.saveFirst')}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('consultationForm.notes')}
                </label>
                <textarea
                  value={consultationForm.notes}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  placeholder={t('consultationForm.notesPh')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Prescription Tab */}
        {activeTab === 'prescription' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('consultationForm.rxItems')}</h3>
              <button
                onClick={handleAddPrescriptionItem}
                className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('consultationForm.addMedication')}
              </button>
            </div>

            <div className="mb-4">
              <AllergyStrip allergies={appointment.patient.allergies ?? []} />
            </div>

            {prescriptionItems.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                {t('consultationForm.noMedications')}
              </p>
            ) : (
              <div className="space-y-4">
                {prescriptionItems.map((item, index) => (
                  <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">{t('consultationForm.medicationN', { n: index + 1 })}</h4>
                      <button
                        type="button"
                        onClick={() => handleRemovePrescriptionItem(index)}
                        aria-label={t('cs.rx.removeLine', { n: index + 1 })}
                        title={t('cs.rx.removeLine', { n: index + 1 })}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('consultationForm.medication')}</label>
                        <select
                          value={item.medicationId}
                          onChange={(e) => handlePrescriptionItemChange(index, 'medicationId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">{t('consultationForm.selectMedication')}</option>
                          {medications.map(med => (
                            <option key={med.id} value={med.id}>{med.name} ({med.dosageForm})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('consultationForm.dosage')}</label>
                        <input
                          type="text"
                          value={item.dosage}
                          onChange={(e) => handlePrescriptionItemChange(index, 'dosage', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder={t('consultationForm.dosagePh')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('consultationForm.frequency')}</label>
                        <input
                          type="text"
                          value={item.frequency}
                          onChange={(e) => handlePrescriptionItemChange(index, 'frequency', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder={t('consultationForm.frequencyPh')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('consultationForm.duration')}</label>
                        <input
                          type="text"
                          value={item.duration}
                          onChange={(e) => handlePrescriptionItemChange(index, 'duration', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder={t('consultationForm.durationPh')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('consultationForm.quantity')}</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handlePrescriptionItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('consultationForm.instructions')}</label>
                        <input
                          type="text"
                          value={item.instructions}
                          onChange={(e) => handlePrescriptionItemChange(index, 'instructions', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder={t('consultationForm.instructionsPh')}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <PrescriptionSafetyPanel
                check={safety.check}
                checking={safety.checking}
                failed={safety.failed}
                savedAlerts={savedAlerts}
                override={safetyOverride}
                onOverrideChange={setSafetyOverride}
                hasItems={hasRxItems}
              />
            </div>
          </div>
        )}

        {/* Lab Orders Tab */}
        {activeTab === 'lab-orders' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('consultationForm.labOrders')}</h3>
              <button
                onClick={handleAddLabOrderItem}
                className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('consultationForm.addLabTest')}
              </button>
            </div>

            {labOrderItems.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                {t('consultationForm.noLabTests')}
              </p>
            ) : (
              <div className="space-y-4">
                {labOrderItems.map((item, index) => (
                  <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">{t('consultationForm.labTestN', { n: index + 1 })}</h4>
                      <button
                        onClick={() => handleRemoveLabOrderItem(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('consultationForm.labTest')}</label>
                        <select
                          value={item.labTestId}
                          onChange={(e) => handleLabOrderItemChange(index, 'labTestId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">{t('consultationForm.selectTest')}</option>
                          {labTests.map(test => (
                            <option key={test.id} value={test.id}>{test.name} ({test.code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('consultationForm.priority')}</label>
                        <select
                          value={item.priority}
                          onChange={(e) => handleLabOrderItemChange(index, 'priority', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="ROUTINE">{tEnum('ROUTINE')}</option>
                          <option value="URGENT">{tEnum('URGENT')}</option>
                          <option value="STAT">{tEnum('STAT')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{t('consultationForm.notesShort')}</label>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => handleLabOrderItemChange(index, 'notes', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder={t('consultationForm.indicationPh')}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>

        {/* Problem list and files of the consultation, next to the write-up */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <ProblemListPanel
            patientId={appointment.patient.id}
            canEdit={user?.role === 'DOCTOR' || user?.role === 'ADMIN'}
            diagnoses={consultationForm.diagnoses}
            consultationId={existingConsultation?.id}
            compact
          />
          <PatientAttachmentsPanel
            key={existingConsultation?.id ?? 'patient'}
            patientId={appointment.patient.id}
            consultationId={existingConsultation?.id}
            onUploaded={(ids) => {
              if (!existingConsultation) unlinkedUploads.current.push(...ids);
            }}
            title={t('cdoc.att.consultationTitle')}
            compact
          />
        </aside>
        </div>
      </div>
      {pickingTemplate && <TemplatePickerDialog onClose={() => setPickingTemplate(false)} onApply={applyTemplate} />}
      {savingAsTemplate && existingConsultation && <SaveAsTemplateDialog consultationId={existingConsultation.id} onClose={() => setSavingAsTemplate(false)} />}
      {bookingFollowUp && existingConsultation && (
        <FollowUpDialog
          consultationId={existingConsultation.id}
          doctorId={appointment.doctor.id}
          initialDate={consultationForm.followUpDate || undefined}
          onClose={() => setBookingFollowUp(false)}
          onBooked={() => {
            setBookingFollowUp(false);
            toast.success(t('cs.followUp.booked'));
            void reloadFollowUp(existingConsultation.id);
          }}
        />
      )}
    </PermissionGate>
  );
}
