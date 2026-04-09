'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, Appointment, Consultation } from '@/lib/api';
import { useToast } from '@/components/toast';
import { useAuth } from '@/context/auth-context';
import { PermissionGate } from '@/components/permission-gate';

interface ConsultationForm {
  chiefComplaint: string;
  symptoms: string[];
  examination: string;
  diagnosis: string[];
  diagnosisCodes: string[];
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
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [existingConsultation, setExistingConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'consultation' | 'prescription' | 'lab-orders'>('consultation');

  const [consultationForm, setConsultationForm] = useState<ConsultationForm>({
    chiefComplaint: '',
    symptoms: [],
    examination: '',
    diagnosis: [],
    diagnosisCodes: [],
    treatmentPlan: '',
    notes: '',
    followUpDate: '',
  });

  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [labOrderItems, setLabOrderItems] = useState<LabOrderItem[]>([]);
  const [symptomInput, setSymptomInput] = useState('');
  const [diagnosisInput, setDiagnosisInput] = useState('');

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
        const consultationsRes = await api.getConsultations({ patientId: appointmentData.patient.id, limit: 1 });
        // Find consultation for this specific appointment
        const existing = consultationsRes.consultations?.find(
          (c: any) => c.appointmentId === params.id
        );
        if (existing) {
          setExistingConsultation(existing);
          setConsultationForm({
            chiefComplaint: existing.chiefComplaint || '',
            symptoms: existing.symptoms || [],
            examination: existing.examination || '',
            diagnosis: existing.diagnosis || [],
            diagnosisCodes: existing.diagnosisCodes || [],
            treatmentPlan: existing.treatmentPlan || '',
            notes: existing.notes || '',
            followUpDate: existing.followUpDate || '',
          });
        }
      } catch {
        // No existing consultation, that's okay
      }
    } catch (err) {
      toast.error('Error', 'Failed to load appointment data');
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

  const handleAddDiagnosis = () => {
    if (diagnosisInput.trim() && !consultationForm.diagnosis.includes(diagnosisInput.trim())) {
      setConsultationForm(prev => ({
        ...prev,
        diagnosis: [...prev.diagnosis, diagnosisInput.trim()],
      }));
      setDiagnosisInput('');
    }
  };

  const handleRemoveDiagnosis = (diagnosis: string) => {
    setConsultationForm(prev => ({
      ...prev,
      diagnosis: prev.diagnosis.filter(d => d !== diagnosis),
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

  const handleSaveConsultation = async () => {
    if (!appointment || !consultationForm.chiefComplaint) {
      toast.error('Error', 'Chief complaint is required');
      return;
    }

    try {
      setSaving(true);

      // Save or update consultation
      if (existingConsultation) {
        await api.updateConsultation(existingConsultation.id, {
          chiefComplaint: consultationForm.chiefComplaint,
          symptoms: consultationForm.symptoms,
          examination: consultationForm.examination,
          diagnosis: consultationForm.diagnosis,
          diagnosisCodes: consultationForm.diagnosisCodes,
          treatmentPlan: consultationForm.treatmentPlan,
          notes: consultationForm.notes,
          followUpDate: consultationForm.followUpDate || null,
        });
      } else {
        await api.createConsultation({
          appointmentId: appointment.id,
          chiefComplaint: consultationForm.chiefComplaint,
          symptoms: consultationForm.symptoms,
          examination: consultationForm.examination,
          diagnosis: consultationForm.diagnosis,
          diagnosisCodes: consultationForm.diagnosisCodes,
          treatmentPlan: consultationForm.treatmentPlan,
          notes: consultationForm.notes,
          followUpDate: consultationForm.followUpDate,
        });
      }

      // Create prescription if there are items
      if (prescriptionItems.length > 0 && prescriptionItems.some(item => item.medicationId)) {
        const validItems = prescriptionItems.filter(item => item.medicationId);
        await api.createPrescription({
          patientId: appointment.patient.id,
          doctorId: appointment.doctor.id,
          items: validItems.map(item => ({
            medicationId: item.medicationId,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            quantity: item.quantity,
            instructions: item.instructions,
          })),
        });
      }

      // Create lab orders if there are items
      if (labOrderItems.length > 0 && labOrderItems.some(item => item.labTestId)) {
        const validItems = labOrderItems.filter(item => item.labTestId);
        await api.createLabOrder({
          patientId: appointment.patient.id,
          doctorId: appointment.doctor.id,
          priority: validItems[0]?.priority || 'ROUTINE',
          notes: validItems.map(item => item.notes).filter(Boolean).join('; '),
          tests: validItems.map(item => ({ labTestId: item.labTestId })),
        });
      }

      // Update appointment status to completed
      await api.updateAppointment(appointment.id, { status: 'COMPLETED' });

      toast.success('Success', 'Consultation saved successfully');
      router.push(`/dashboard/appointments/${appointment.id}`);
    } catch (err) {
      toast.error('Error', 'Failed to save consultation');
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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Appointment not found</h2>
        <Link href="/dashboard/appointments" className="text-lime-600 hover:underline mt-4 inline-block">
          Back to Appointments
        </Link>
      </div>
    );
  }

  return (
    <PermissionGate permission="appointments:start_consultation" fallback={
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">You don't have permission to create consultations.</p>
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
              Back to Appointment
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
              Consultation
            </h1>
          </div>
          <button
            onClick={handleSaveConsultation}
            disabled={saving || !consultationForm.chiefComplaint}
            className="bg-lime-600 text-white px-6 py-2 rounded-lg hover:bg-lime-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            Complete Consultation
          </button>
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
                {appointment.patient.gender && ` | ${appointment.patient.gender}`}
                {appointment.patient.dateOfBirth && ` | ${new Date().getFullYear() - new Date(appointment.patient.dateOfBirth).getFullYear()} years`}
              </p>
              <div className="flex gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                <span>Phone: {appointment.patient.phoneNumber}</span>
                <span>Email: {appointment.patient.email}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{appointment.type}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(appointment.appointmentDate).toLocaleDateString()} at {new Date(appointment.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              {appointment.reason && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Reason: {appointment.reason}</p>
              )}
            </div>
          </div>
        </div>

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
            Consultation Notes
          </button>
          <button
            onClick={() => setActiveTab('prescription')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'prescription'
                ? 'border-lime-600 text-lime-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Prescription ({prescriptionItems.length})
          </button>
          <button
            onClick={() => setActiveTab('lab-orders')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'lab-orders'
                ? 'border-lime-600 text-lime-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Lab Orders ({labOrderItems.length})
          </button>
        </div>

        {/* Consultation Notes Tab */}
        {activeTab === 'consultation' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="space-y-6">
              {/* Chief Complaint */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Chief Complaint *
                </label>
                <textarea
                  value={consultationForm.chiefComplaint}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  placeholder="Patient's main complaint..."
                />
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Symptoms
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={symptomInput}
                    onChange={(e) => setSymptomInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSymptom())}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    placeholder="Add symptom..."
                  />
                  <button
                    type="button"
                    onClick={handleAddSymptom}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500"
                  >
                    Add
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
                  Physical Examination
                </label>
                <textarea
                  value={consultationForm.examination}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, examination: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  placeholder="Examination findings..."
                />
              </div>

              {/* Diagnosis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Diagnosis
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={diagnosisInput}
                    onChange={(e) => setDiagnosisInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDiagnosis())}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                    placeholder="Add diagnosis..."
                  />
                  <button
                    type="button"
                    onClick={handleAddDiagnosis}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {consultationForm.diagnosis.map((diagnosis) => (
                    <span
                      key={diagnosis}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                    >
                      {diagnosis}
                      <button onClick={() => handleRemoveDiagnosis(diagnosis)} className="hover:text-red-500">
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
                  Treatment Plan
                </label>
                <textarea
                  value={consultationForm.treatmentPlan}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, treatmentPlan: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  placeholder="Treatment plan and recommendations..."
                />
              </div>

              {/* Follow-up Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Follow-up Date
                </label>
                <input
                  type="date"
                  value={consultationForm.followUpDate}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, followUpDate: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={consultationForm.notes}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Prescription Tab */}
        {activeTab === 'prescription' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Prescription Items</h3>
              <button
                onClick={handleAddPrescriptionItem}
                className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Medication
              </button>
            </div>

            {prescriptionItems.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No medications added. Click "Add Medication" to prescribe medications.
              </p>
            ) : (
              <div className="space-y-4">
                {prescriptionItems.map((item, index) => (
                  <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">Medication #{index + 1}</h4>
                      <button
                        onClick={() => handleRemovePrescriptionItem(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Medication</label>
                        <select
                          value={item.medicationId}
                          onChange={(e) => handlePrescriptionItemChange(index, 'medicationId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">Select medication...</option>
                          {medications.map(med => (
                            <option key={med.id} value={med.id}>{med.name} ({med.dosageForm})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Dosage</label>
                        <input
                          type="text"
                          value={item.dosage}
                          onChange={(e) => handlePrescriptionItemChange(index, 'dosage', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., 500mg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Frequency</label>
                        <input
                          type="text"
                          value={item.frequency}
                          onChange={(e) => handlePrescriptionItemChange(index, 'frequency', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., 3 times daily"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Duration</label>
                        <input
                          type="text"
                          value={item.duration}
                          onChange={(e) => handlePrescriptionItemChange(index, 'duration', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., 7 days"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Quantity</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handlePrescriptionItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Instructions</label>
                        <input
                          type="text"
                          value={item.instructions}
                          onChange={(e) => handlePrescriptionItemChange(index, 'instructions', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., Take with food"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lab Orders Tab */}
        {activeTab === 'lab-orders' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Lab Orders</h3>
              <button
                onClick={handleAddLabOrderItem}
                className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Lab Test
              </button>
            </div>

            {labOrderItems.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No lab tests ordered. Click "Add Lab Test" to order tests.
              </p>
            ) : (
              <div className="space-y-4">
                {labOrderItems.map((item, index) => (
                  <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">Lab Test #{index + 1}</h4>
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
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Lab Test</label>
                        <select
                          value={item.labTestId}
                          onChange={(e) => handleLabOrderItemChange(index, 'labTestId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">Select test...</option>
                          {labTests.map(test => (
                            <option key={test.id} value={test.id}>{test.name} ({test.code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Priority</label>
                        <select
                          value={item.priority}
                          onChange={(e) => handleLabOrderItemChange(index, 'priority', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="ROUTINE">Routine</option>
                          <option value="URGENT">Urgent</option>
                          <option value="STAT">STAT</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Notes</label>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => handleLabOrderItemChange(index, 'notes', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Clinical indication..."
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
    </PermissionGate>
  );
}
