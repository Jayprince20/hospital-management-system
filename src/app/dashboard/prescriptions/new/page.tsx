'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { useAuth } from '@/context/auth-context';

interface Medication {
  id: string;
  name: string;
  genericName: string;
  category: string;
  dosageForm: string;
  strength: string;
  stockQuantity: number;
}

interface PrescriptionItem {
  medicationId: string;
  medication?: Medication;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
}

interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  allergies: string[];
}

export default function NewPrescriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultationId = searchParams.get('consultationId');
  const patientIdParam = searchParams.get('patientId');
  const { user } = useAuth();
  const toast = useToast();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PrescriptionItem[]>([]);

  // Add medication modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [itemForm, setItemForm] = useState({
    dosage: '',
    frequency: 'Twice daily',
    duration: '7 days',
    quantity: 1,
    instructions: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch patient if patientId is provided
      if (patientIdParam) {
        const patientData = await api.getPatient(patientIdParam);
        setPatient({
          id: patientData.id,
          patientId: patientData.patientId,
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          dateOfBirth: patientData.dateOfBirth,
          gender: patientData.gender,
          allergies: patientData.allergies || [],
        });
      }

      // Fetch medications
      const medsResponse = await api.getMedications({ isActive: true, limit: 100 });
      setMedications(medsResponse.medications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [patientIdParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredMedications = medications.filter(med =>
    med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    med.genericName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectMedication = (med: Medication) => {
    setSelectedMedication(med);
    // Pre-fill dosage with strength
    setItemForm(prev => ({ ...prev, dosage: med.strength || '' }));
  };

  const handleAddItem = () => {
    console.log('handleAddItem called', { selectedMedication, itemForm });

    if (!selectedMedication) {
      toast.error('Select medication', 'Please select a medication');
      return;
    }
    if (!itemForm.dosage || !itemForm.frequency || !itemForm.duration || itemForm.quantity < 1) {
      toast.error('Fill all fields', 'Please fill in dosage, frequency, duration, and quantity');
      console.log('Validation failed', itemForm);
      return;
    }

    const newItem: PrescriptionItem = {
      medicationId: selectedMedication.id,
      medication: selectedMedication,
      dosage: itemForm.dosage,
      frequency: itemForm.frequency,
      duration: itemForm.duration,
      quantity: itemForm.quantity,
      instructions: itemForm.instructions,
    };

    console.log('Adding item:', newItem);
    const medicationName = selectedMedication.name;

    setItems(prevItems => {
      const updated = [...prevItems, newItem];
      console.log('Items updated:', updated);
      return updated;
    });
    setShowAddModal(false);
    setSelectedMedication(null);
    setSearchQuery('');
    setItemForm({
      dosage: '',
      frequency: 'Twice daily',
      duration: '7 days',
      quantity: 1,
      instructions: '',
    });
    toast.success('Medication added', `${medicationName} added to prescription`);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patient) {
      toast.error('No patient', 'Patient information is required');
      return;
    }

    if (items.length === 0) {
      toast.error('No medications', 'Please add at least one medication');
      return;
    }

    try {
      setSubmitting(true);

      // Get doctor ID from user context or use a placeholder
      const doctorId = user?.id || '';

      await api.createPrescription({
        patientId: patient.id,
        doctorId: doctorId,
        consultationId: consultationId || undefined,
        notes: notes || undefined,
        items: items.map(item => ({
          medicationId: item.medicationId,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          quantity: item.quantity,
          instructions: item.instructions || undefined,
        })),
      });

      toast.success('Prescription created', 'The prescription has been created successfully');

      if (consultationId) {
        router.push(`/dashboard/consultations/${consultationId}`);
      } else {
        router.push('/dashboard/prescriptions');
      }
    } catch (err) {
      toast.error('Failed to create prescription', err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

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
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Link
            href="/dashboard/prescriptions"
            className="inline-flex items-center gap-2 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700"
          >
            Back to Prescriptions
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
            href={consultationId ? `/dashboard/consultations/${consultationId}` : '/dashboard/prescriptions'}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Prescription</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Create a new prescription for the patient</p>
          </div>
        </div>
      </div>

      {/* Patient Info */}
      {patient && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-lime-100 dark:bg-lime-900/50 flex items-center justify-center">
              <span className="text-lime-600 dark:text-lime-400 font-bold text-lg">
                {patient.firstName[0]}{patient.lastName[0]}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {patient.firstName} {patient.lastName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {patient.patientId} | {calculateAge(patient.dateOfBirth)} years | {patient.gender}
              </p>
            </div>
            {patient.allergies.length > 0 && (
              <div className="text-right">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Allergies</p>
                <div className="flex flex-wrap gap-1 justify-end">
                  {patient.allergies.map((allergy, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs rounded">
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prescription Form */}
      <form onSubmit={handleSubmit}>
        {/* Medications List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900 dark:text-white">Medications</h2>
              <span className="px-2 py-0.5 bg-lime-100 dark:bg-lime-900/50 text-lime-700 dark:text-lime-300 text-xs rounded-full">
                {items.length} added
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-lime-600 text-white text-sm rounded-lg hover:bg-lime-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Medication
            </button>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">No medications added yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Click &quot;Add Medication&quot; to start</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((item, index) => (
                <div key={index} className="p-4 flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {item.medication?.name}
                      </p>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                        {item.medication?.dosageForm}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {item.medication?.genericName}
                    </p>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">Dosage:</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">{item.dosage}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Frequency:</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">{item.frequency}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Duration:</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">{item.duration}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Qty:</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">{item.quantity}</span>
                      </div>
                    </div>
                    {item.instructions && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">
                        {item.instructions}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional instructions or notes..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href={consultationId ? `/dashboard/consultations/${consultationId}` : '/dashboard/prescriptions'}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="px-6 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating...' : 'Create Prescription'}
          </button>
        </div>
      </form>

      {/* Add Medication Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Medication</h2>
                <p className="text-sm text-gray-500">
                  {selectedMedication ? 'Step 2: Fill prescription details' : 'Step 1: Select a medication'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedMedication(null);
                  setSearchQuery('');
                  setItemForm({
                    dosage: '',
                    frequency: 'Twice daily',
                    duration: '7 days',
                    quantity: 1,
                    instructions: '',
                  });
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 max-h-[calc(90vh-200px)] overflow-y-auto">
              {!selectedMedication ? (
                <>
                  {/* Search */}
                  <div className="mb-4">
                    <div className="relative">
                      <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search medications..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Medications List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredMedications.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-4">No medications found</p>
                    ) : (
                      filteredMedications.map((med) => (
                        <button
                          key={med.id}
                          type="button"
                          onClick={() => handleSelectMedication(med)}
                          className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{med.name}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {med.genericName} | {med.dosageForm} | {med.strength}
                              </p>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded ${
                              med.stockQuantity > 10
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                : med.stockQuantity > 0
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                            }`}>
                              Stock: {med.stockQuantity}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Selected Medication */}
                  <div className="mb-4 p-3 bg-lime-50 dark:bg-lime-900/30 border border-lime-200 dark:border-lime-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedMedication.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {selectedMedication.genericName} | {selectedMedication.dosageForm}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedMedication(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Prescription Details Form */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Dosage <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={itemForm.dosage}
                        onChange={(e) => setItemForm({ ...itemForm, dosage: e.target.value })}
                        placeholder="e.g., 500mg"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Frequency <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={itemForm.frequency}
                        onChange={(e) => setItemForm({ ...itemForm, frequency: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select frequency</option>
                        <option value="Once daily">Once daily</option>
                        <option value="Twice daily">Twice daily</option>
                        <option value="Three times daily">Three times daily</option>
                        <option value="Four times daily">Four times daily</option>
                        <option value="Every 4 hours">Every 4 hours</option>
                        <option value="Every 6 hours">Every 6 hours</option>
                        <option value="Every 8 hours">Every 8 hours</option>
                        <option value="Every 12 hours">Every 12 hours</option>
                        <option value="As needed">As needed (PRN)</option>
                        <option value="At bedtime">At bedtime</option>
                        <option value="Before meals">Before meals</option>
                        <option value="After meals">After meals</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Duration <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={itemForm.duration}
                        onChange={(e) => setItemForm({ ...itemForm, duration: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select duration</option>
                        <option value="3 days">3 days</option>
                        <option value="5 days">5 days</option>
                        <option value="7 days">7 days</option>
                        <option value="10 days">10 days</option>
                        <option value="14 days">14 days</option>
                        <option value="21 days">21 days</option>
                        <option value="1 month">1 month</option>
                        <option value="2 months">2 months</option>
                        <option value="3 months">3 months</option>
                        <option value="Ongoing">Ongoing</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={itemForm.quantity}
                        onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 1 })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Special Instructions
                      </label>
                      <textarea
                        value={itemForm.instructions}
                        onChange={(e) => setItemForm({ ...itemForm, instructions: e.target.value })}
                        placeholder="e.g., Take with food, avoid alcohol..."
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {selectedMedication && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMedication(null)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700"
                >
                  Add to Prescription
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
