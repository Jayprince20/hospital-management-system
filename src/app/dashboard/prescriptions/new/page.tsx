'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useDebounce } from '@/hooks/use-debounce';
import { PrescriptionSafetyPanel, usePrescriptionSafety } from '@/components/clinical-safety/safety';
import { OVERRIDE_MIN_LENGTH, canSubmitPrescription, safetyAlertsFromError, type SafetyAlert } from '@/lib/clinical-safety';

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
  phoneNumber?: string;
  allergies: string[];
}

const FREQUENCY_KEYS = [
  'onceDaily', 'twiceDaily', 'threeTimesDaily', 'fourTimesDaily',
  'every4h', 'every6h', 'every8h', 'every12h',
  'asNeeded', 'bedtime', 'beforeMeals', 'afterMeals',
];
const DURATION_KEYS = ['3d', '5d', '7d', '10d', '14d', '21d', '1m', '2m', '3m', 'ongoing'];

const toPatient = (p: {
  id: string; patientId: string; firstName: string; lastName: string;
  dateOfBirth: string; gender: string; phoneNumber?: string; allergies?: string[];
}): Patient => ({
  id: p.id,
  patientId: p.patientId,
  firstName: p.firstName,
  lastName: p.lastName,
  dateOfBirth: p.dateOfBirth,
  gender: p.gender,
  phoneNumber: p.phoneNumber,
  allergies: p.allergies || [],
});

// useSearchParams needs a Suspense boundary for static rendering
export default function NewPrescriptionPage() {
  return (
    <Suspense fallback={null}>
      <NewPrescriptionForm />
    </Suspense>
  );
}

function NewPrescriptionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultationId = searchParams.get('consultationId');
  const patientIdParam = searchParams.get('patientId');
  const { user } = useAuth();
  const toast = useToast();
  const { t, tEnum, language } = useLanguage();
  const plural = (key: string, count: number) =>
    t(`${key}_${count === 1 || (language === 'fr' && count === 0) ? 'one' : 'other'}`, { count });
  const dosageFormLabel = (form?: string) => {
    if (!form) return '';
    const key = `ph.form.${form}`;
    const label = t(key);
    return label === key ? form : label;
  };
  const emptyItemForm = useCallback(() => ({
    dosage: '',
    frequency: t('ph.freq.twiceDaily'),
    duration: t('ph.dur.7d'),
    quantity: 1,
    instructions: '',
  }), [t]);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  // Prescribing safety: justification when an alert blocks, and alerts returned by a refused save
  const [safetyOverride, setSafetyOverride] = useState('');
  const [savedAlerts, setSavedAlerts] = useState<SafetyAlert[] | null>(null);

  // Add medication modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);

  // Patient picker (used when the page is opened without ?patientId=)
  const [patientSearch, setPatientSearch] = useState('');
  const debouncedPatientSearch = useDebounce(patientSearch.trim(), 300);
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  // A prescription written from a consultation stays tied to that consultation's patient
  const canChangePatient = !consultationId;

  useEffect(() => {
    if (patient || debouncedPatientSearch.length < 2) {
      setPatientResults([]);
      return;
    }
    let cancelled = false;
    setSearchingPatients(true);
    api.getPatients({ search: debouncedPatientSearch, limit: 8 })
      .then((res) => {
        if (!cancelled) setPatientResults(res.data.filter((p) => !p.anonymizedAt).map(toPatient));
      })
      .catch(() => {
        if (!cancelled) setPatientResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearchingPatients(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedPatientSearch, patient]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch patient if patientId is provided
      if (patientIdParam) {
        const patientData = await api.getPatient(patientIdParam);
        setPatient(toPatient(patientData));
      }

      // Fetch medications
      const medsResponse = await api.getMedications({ isActive: true, limit: 100 });
      setMedications(medsResponse.medications);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ph.new.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [patientIdParam, t]);

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
    if (!selectedMedication) {
      toast.error(t('ph.new.selectMedTitle'), t('ph.new.selectMedDesc'));
      return;
    }
    if (!itemForm.dosage || !itemForm.frequency || !itemForm.duration || itemForm.quantity < 1) {
      toast.error(t('ph.new.fillFieldsTitle'), t('ph.new.fillFieldsDesc'));
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

    const medicationName = selectedMedication.name;

    setItems(prevItems => [...prevItems, newItem]);
    setShowAddModal(false);
    setSelectedMedication(null);
    setSearchQuery('');
    setItemForm(emptyItemForm());
    toast.success(t('ph.new.medAdded'), t('ph.new.medAddedDesc', { name: medicationName }));
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const safety = usePrescriptionSafety(patient?.id, items.map((item) => item.medicationId));
  const rxAllowed = canSubmitPrescription(safety.check, savedAlerts, safetyOverride);
  useEffect(() => {
    setSavedAlerts(null);
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patient) {
      toast.error(t('ph.new.noPatientTitle'), t('ph.new.noPatientDesc'));
      return;
    }

    if (items.length === 0) {
      toast.error(t('ph.new.noMedsTitle'), t('ph.new.noMedsDesc'));
      return;
    }

    if (!rxAllowed) {
      toast.error(t('ph.new.createFailed'), t('cs.safety.overrideRequired', { min: OVERRIDE_MIN_LENGTH }));
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
        ...(safetyOverride.trim() ? { safetyOverride: safetyOverride.trim() } : {}),
        items: items.map(item => ({
          medicationId: item.medicationId,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          quantity: item.quantity,
          instructions: item.instructions || undefined,
        })),
      });

      toast.success(t('ph.new.created'), t('ph.new.createdDesc'));

      if (consultationId) {
        router.push(`/dashboard/consultations/${consultationId}`);
      } else {
        router.push('/dashboard/prescriptions');
      }
    } catch (err) {
      const alerts = safetyAlertsFromError(err);
      if (alerts) {
        setSavedAlerts(alerts);
        toast.error(t('ph.new.createFailed'), err instanceof Error ? err.message : undefined);
        return;
      }
      const message = err instanceof Error ? err.message : t('ph.common.genericError');
      // The API rejects prescriptions from accounts without a doctor profile
      toast.error(
        t('ph.new.createFailed'),
        /doctor profile not found/i.test(message) ? t('ph.new.doctorOnly') : message
      );
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
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('ph.common.loading')}</p>
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
            {t('ph.new.backToList')}
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ph.new.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{t('ph.new.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Patient */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
        {patient ? (
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
                {patient.patientId} | {t('unit.years', { count: calculateAge(patient.dateOfBirth) })} | {tEnum(patient.gender)}
              </p>
            </div>
            {patient.allergies.length > 0 && (
              <div className="text-right">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">{t('ph.new.allergies')}</p>
                <div className="flex flex-wrap gap-1 justify-end">
                  {patient.allergies.map((allergy, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs rounded">
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {canChangePatient && (
              <button
                type="button"
                onClick={() => {
                  setPatient(null);
                  setPatientSearch('');
                }}
                className="px-3 py-1.5 text-sm text-lime-700 dark:text-lime-400 border border-lime-300 dark:border-lime-700 rounded-lg hover:bg-lime-50 dark:hover:bg-lime-900/30 transition-colors"
              >
                {t('ph.new.changePatient')}
              </button>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="patient-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('ph.new.selectPatient')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="patient-search"
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder={t('ph.new.searchPatient')}
                autoComplete="off"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500"
              />
            </div>
            <div className="mt-3">
              {debouncedPatientSearch.length < 2 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.new.typeToSearch')}</p>
              ) : searchingPatients ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.new.searching')}</p>
              ) : patientResults.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('ph.new.noPatients')}</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPatient(p)}
                      className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-lime-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-full bg-lime-100 dark:bg-lime-900/50 flex items-center justify-center text-sm font-semibold text-lime-700 dark:text-lime-300">
                        {p.firstName[0]}{p.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{p.firstName} {p.lastName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {[p.patientId, p.phoneNumber].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Prescription Form */}
      <form onSubmit={handleSubmit}>
        {/* Medications List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('ph.rx.medications')}</h2>
              <span className="px-2 py-0.5 bg-lime-100 dark:bg-lime-900/50 text-lime-700 dark:text-lime-300 text-xs rounded-full">
                {plural('ph.new.added', items.length)}
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
              {t('ph.new.addMedication')}
            </button>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">{t('ph.new.noMedsYet')}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('ph.new.clickAdd')}</p>
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
                        {dosageFormLabel(item.medication?.dosageForm)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {item.medication?.genericName}
                    </p>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">{t('ph.new.dosage')} :</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">{item.dosage}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">{t('ph.new.frequency')} :</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">{item.frequency}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">{t('ph.new.duration')} :</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">{item.duration}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">{t('ph.new.qty')} :</span>{' '}
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
                    title={t('ph.new.removeItem')}
                    aria-label={t('ph.new.removeItem')}
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

        {items.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
            <PrescriptionSafetyPanel
              check={safety.check}
              checking={safety.checking}
              failed={safety.failed}
              savedAlerts={savedAlerts}
              override={safetyOverride}
              onOverrideChange={setSafetyOverride}
              hasItems={items.length > 0}
            />
          </div>
        )}

        {/* Notes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('ph.new.additionalNotes')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('ph.new.notesPlaceholder')}
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
            {t('ph.common.cancel')}
          </Link>
          <button
            type="submit"
            disabled={submitting || items.length === 0 || !patient || !rxAllowed}
            className="px-6 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t('ph.common.creating') : t('ph.new.createPrescription')}
          </button>
        </div>
      </form>

      {/* Add Medication Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ph.new.addMedication')}</h2>
                <p className="text-sm text-gray-500">
                  {selectedMedication ? t('ph.new.step2') : t('ph.new.step1')}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedMedication(null);
                  setSearchQuery('');
                  setItemForm(emptyItemForm());
                }}
                aria-label={t('ph.common.cancel')}
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
                        placeholder={t('ph.new.searchMedications')}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Medications List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredMedications.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('ph.new.noMeds')}</p>
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
                                {med.genericName} | {dosageFormLabel(med.dosageForm)} | {med.strength}
                              </p>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded ${
                              med.stockQuantity > 10
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                : med.stockQuantity > 0
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                            }`}>
                              {t('ph.new.stockLabel', { qty: med.stockQuantity })}
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
                          {selectedMedication.genericName} | {dosageFormLabel(selectedMedication.dosageForm)}
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
                        {t('ph.new.dosage')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={itemForm.dosage}
                        onChange={(e) => setItemForm({ ...itemForm, dosage: e.target.value })}
                        placeholder={t('ph.new.dosagePlaceholder')}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('ph.new.frequency')} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={itemForm.frequency}
                        onChange={(e) => setItemForm({ ...itemForm, frequency: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">{t('ph.new.selectFrequency')}</option>
                        {FREQUENCY_KEYS.map((key) => (
                          <option key={key} value={t(`ph.freq.${key}`)}>{t(`ph.freq.${key}`)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('ph.new.duration')} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={itemForm.duration}
                        onChange={(e) => setItemForm({ ...itemForm, duration: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">{t('ph.new.selectDuration')}</option>
                        {DURATION_KEYS.map((key) => (
                          <option key={key} value={t(`ph.dur.${key}`)}>{t(`ph.dur.${key}`)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('ph.new.quantity')} <span className="text-red-500">*</span>
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
                        {t('ph.new.instructions')}
                      </label>
                      <textarea
                        value={itemForm.instructions}
                        onChange={(e) => setItemForm({ ...itemForm, instructions: e.target.value })}
                        placeholder={t('ph.new.instructionsPlaceholder')}
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
                  {t('ph.new.back')}
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700"
                >
                  {t('ph.new.addToRx')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
