'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Patient, Doctor, AppointmentType, DoctorAvailability } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useActingPatient } from '@/context/acting-patient-context';

// Local calendar date as YYYY-MM-DD (toISOString would shift to UTC)
const toLocalDateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const isPastDate = (value: string) => !!value && value < toLocalDateString(new Date());

interface AppointmentFormData {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  type: AppointmentType;
  reason: string;
  notes: string;
}

const initialFormData: AppointmentFormData = {
  patientId: '',
  doctorId: '',
  appointmentDate: '',
  startTime: '',
  endTime: '',
  type: 'IN_PERSON',
  reason: '',
  notes: '',
};

export default function NewAppointmentPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  // Family access: booking for the relative being acted for
  const { acting } = useActingPatient();
  const { t, tEnum, formatDate, formatTime, formatCurrency } = useLanguage();
  const getDayName = (dayOfWeek: number) => t(`appointmentForm.dayShort${dayOfWeek}`);
  const [reasonTouched, setReasonTouched] = useState(false);
  const [formData, setFormData] = useState<AppointmentFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if user is a patient - skip step 1 for patients
  const isPatientUser = user?.role === 'PATIENT';
  const [currentStep, setCurrentStep] = useState(1);
  const [isAutoSelectingPatient, setIsAutoSelectingPatient] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize step based on user role (after auth loads)
  useEffect(() => {
    if (!authLoading && user && !initialized) {
      if (user.role === 'PATIENT') {
        setCurrentStep(2);
      }
      setInitialized(true);
    }
  }, [authLoading, user, initialized]);

  // Data for dropdowns
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(!isPatientUser);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [patientSearch, setPatientSearch] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');

  // Selected entities for display
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  // Availability state
  const [availability, setAvailability] = useState<DoctorAvailability | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Doctor availability indicators (for doctor cards)
  const [doctorAvailabilityMap, setDoctorAvailabilityMap] = useState<
    Record<string, { status: 'available_today' | 'available_tomorrow' | 'available_later' | 'unavailable'; nextDate?: string }>
  >({});

  // Steps configuration - show 3 steps for patients (skip patient selection)
  const allSteps = [
    { id: 1, name: t('appointmentForm.stepPatient'), icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 2, name: t('appointmentForm.stepDoctor'), icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 3, name: t('appointmentForm.stepDateTime'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 4, name: t('appointmentForm.stepDetails'), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ];

  // For patients, skip step 1
  const steps = isPatientUser ? allSteps.filter(s => s.id !== 1) : allSteps;

  // Auto-select patient for PATIENT role users
  useEffect(() => {
    const autoSelectPatient = async () => {
      if (!isPatientUser || !user?.email || selectedPatient) return;

      setIsAutoSelectingPatient(true);
      if (acting) {
        try {
          const relative = await api.getPatient(acting.patientId);
          setSelectedPatient(relative);
          setFormData(prev => ({ ...prev, patientId: relative.id }));
        } catch (error) {
          console.error('Failed to load the relative being acted for:', error);
        } finally {
          setIsAutoSelectingPatient(false);
        }
        return;
      }
      try {
        // Search for patient by email
        const response = await api.getPatients({ search: user.email, limit: 1 });
        if (response.data && response.data.length > 0) {
          const patient = response.data[0];
          setSelectedPatient(patient);
          setFormData(prev => ({ ...prev, patientId: patient.id }));
        }
      } catch (error) {
        console.error('Failed to auto-select patient:', error);
        // Create a minimal patient object from user data
        const minimalPatient: Patient = {
          id: user.id,
          patientId: '',
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber || '',
          gender: 'OTHER',
          dateOfBirth: '',
          bloodType: '',
          status: 'Active',
          address: '',
          city: '',
          state: '',
          zipCode: '',
          country: '',
          emergencyName: '',
          emergencyRelation: '',
          emergencyPhone: '',
          allergies: [],
          chronicConditions: [],
          createdAt: '',
        };
        setSelectedPatient(minimalPatient);
        setFormData(prev => ({ ...prev, patientId: user.id }));
      } finally {
        setIsAutoSelectingPatient(false);
      }
    };

    autoSelectPatient();
  }, [isPatientUser, user, selectedPatient, acting]);

  // Pre-select the patient when coming from a patient's page (?patientId=...)
  useEffect(() => {
    if (isPatientUser) return;
    const patientIdParam = new URLSearchParams(window.location.search).get('patientId');
    if (!patientIdParam) return;
    api.getPatient(patientIdParam)
      .then((patient) => {
        setSelectedPatient(patient);
        setFormData(prev => ({ ...prev, patientId: patient.id }));
      })
      .catch((error) => console.error('Failed to preselect patient:', error));
  }, [isPatientUser]);

  // Fetch patients (only for non-patient users)
  const fetchPatients = useCallback(async () => {
    if (isPatientUser) {
      setLoadingPatients(false);
      return;
    }

    try {
      setLoadingPatients(true);
      const response = await api.getPatients({ search: patientSearch, limit: 50 });
      setPatients(response.data.filter((p) => !p.anonymizedAt));
    } catch (error) {
      console.error('Failed to fetch patients:', error);
    } finally {
      setLoadingPatients(false);
    }
  }, [patientSearch, isPatientUser]);

  // Fetch doctors
  const fetchDoctors = useCallback(async () => {
    try {
      setLoadingDoctors(true);
      const response = await api.getDoctors({ search: doctorSearch, available: true, limit: 50 });
      setDoctors(response.data);
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    } finally {
      setLoadingDoctors(false);
    }
  }, [doctorSearch]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Fetch availability indicators for all doctors
  useEffect(() => {
    const fetchDoctorAvailabilityIndicators = async () => {
      if (doctors.length === 0) return;

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayStr = toLocalDateString(today);
      const tomorrowStr = toLocalDateString(tomorrow);

      const availabilityResults: Record<string, { status: 'available_today' | 'available_tomorrow' | 'available_later' | 'unavailable'; nextDate?: string }> = {};

      // Fetch availability for first 10 doctors to avoid too many API calls
      const doctorsToCheck = doctors.slice(0, 10);

      await Promise.all(
        doctorsToCheck.map(async (doctor) => {
          try {
            // Check today
            const todayData = await api.getDoctorAvailability(doctor.id, todayStr);
            if (todayData?.isWorkingDay) {
              const availableToday = todayData.slots.some((s) => s.available);
              if (availableToday) {
                availabilityResults[doctor.id] = { status: 'available_today' };
                return;
              }
            }

            // Check tomorrow
            const tomorrowData = await api.getDoctorAvailability(doctor.id, tomorrowStr);
            if (tomorrowData?.isWorkingDay) {
              const availableTomorrow = tomorrowData.slots.some((s) => s.available);
              if (availableTomorrow) {
                availabilityResults[doctor.id] = { status: 'available_tomorrow' };
                return;
              }
            }

            // Check next 5 days
            for (let i = 2; i <= 6; i++) {
              const futureDate = new Date(today);
              futureDate.setDate(futureDate.getDate() + i);
              const futureDateStr = toLocalDateString(futureDate);

              const futureData = await api.getDoctorAvailability(doctor.id, futureDateStr);
              if (futureData?.isWorkingDay) {
                const hasAvailability = futureData.slots.some((s) => s.available);
                if (hasAvailability) {
                  availabilityResults[doctor.id] = {
                    status: 'available_later',
                    nextDate: formatDate(futureDate, { weekday: 'short', month: 'short', day: 'numeric' }),
                  };
                  return;
                }
              }
            }

            // No availability found
            availabilityResults[doctor.id] = { status: 'unavailable' };
          } catch (error) {
            console.error(`Error fetching availability for doctor ${doctor.id}:`, error);
          }
        })
      );

      setDoctorAvailabilityMap(availabilityResults);
    };

    fetchDoctorAvailabilityIndicators();
  }, [doctors]);

  // Fetch real availability from API
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!selectedDoctor || !formData.appointmentDate) {
        setAvailability(null);
        return;
      }

      // A typed date can bypass the input's min; don't ask the API about past days
      if (isPastDate(formData.appointmentDate)) {
        setAvailability(null);
        setAvailabilityError(null);
        setErrors(prev => ({ ...prev, appointmentDate: t('appointmentForm.errPastDate') }));
        return;
      }

      try {
        setLoadingAvailability(true);
        setAvailabilityError(null);

        const availabilityData = await api.getDoctorAvailability(
          selectedDoctor.id,
          formData.appointmentDate
        );

        setAvailability(availabilityData);

        // If current selected time is no longer available, clear it
        if (formData.startTime) {
          const slot = availabilityData.slots.find(s => s.time === formData.startTime);
          if (!slot || !slot.available) {
            setFormData(prev => ({ ...prev, startTime: '', endTime: '' }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch availability:', error);
        setAvailabilityError(t('appointmentForm.errAvailabilityRetry'));
      } finally {
        setLoadingAvailability(false);
      }
    };

    fetchAvailability();
  }, [selectedDoctor, formData.appointmentDate]);

  // Calculate end time based on start time and availability data
  useEffect(() => {
    if (formData.startTime && availability) {
      // Find the slot and use its endTime
      const slot = availability.slots.find(s => s.time === formData.startTime);
      if (slot) {
        setFormData(prev => ({
          ...prev,
          endTime: slot.endTime,
        }));
      } else {
        // Fallback: calculate based on slotDuration
        const slotDuration = availability.slotDuration || 30;
        const [hours, minutes] = formData.startTime.split(':').map(Number);
        const endMinutes = hours * 60 + minutes + slotDuration;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;

        setFormData(prev => ({
          ...prev,
          endTime: `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`,
        }));
      }
    }
  }, [formData.startTime, availability]);

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setFormData(prev => ({ ...prev, patientId: patient.id }));
    setErrors(prev => ({ ...prev, patientId: '' }));
  };

  const handleDoctorSelect = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setFormData(prev => ({ ...prev, doctorId: doctor.id, startTime: '', endTime: '' }));
    setErrors(prev => ({ ...prev, doctorId: '' }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    // For patient users, step 1 is skipped and patient is auto-selected
    if (step === 1 && !isPatientUser) {
      if (!formData.patientId) newErrors.patientId = t('appointmentForm.errPatient');
    }

    if (step === 2) {
      if (!formData.doctorId) newErrors.doctorId = t('appointmentForm.errDoctor');
      // Also validate patient is selected (for patient users who auto-select)
      if (isPatientUser && !formData.patientId && !isAutoSelectingPatient) {
        newErrors.patientId = t('appointmentForm.errPatientRecord');
      }
    }

    if (step === 3) {
      if (!formData.appointmentDate) newErrors.appointmentDate = t('appointmentForm.errDate');
      if (!formData.startTime) newErrors.startTime = t('appointmentForm.errSlot');

      if (isPastDate(formData.appointmentDate)) {
        newErrors.appointmentDate = t('appointmentForm.errPastDate');
      }
    }

    if (step === 4) {
      if (!formData.reason.trim()) newErrors.reason = t('appointmentForm.errReason');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handlePrevious = () => {
    // For patients, minimum step is 2 (skip patient selection)
    const minStep = isPatientUser ? 2 : 1;
    setCurrentStep(prev => Math.max(prev - 1, minStep));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 4) {
      handleNext();
      return;
    }

    setReasonTouched(true);
    if (isPastDate(formData.appointmentDate)) {
      setErrors({ appointmentDate: t('appointmentForm.errPastDate') });
      setCurrentStep(3);
      return;
    }
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);

    try {
      await api.createAppointment({
        patientId: formData.patientId,
        doctorId: formData.doctorId,
        appointmentDate: formData.appointmentDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        type: formData.type,
        reason: formData.reason,
        notes: formData.notes || undefined,
      });

      router.push('/dashboard/appointments');
    } catch (error) {
      console.error('Error creating appointment:', error);
      setErrors({ submit: error instanceof Error ? error.message : t('appointmentForm.errCreate') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClassName = (fieldName: string) =>
    `w-full px-4 py-2.5 rounded-lg border ${
      errors[fieldName]
        ? 'border-red-500 focus:ring-red-500'
        : 'border-gray-300 dark:border-gray-600 focus:ring-lime-500'
    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:border-transparent text-sm transition-colors`;

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">{t('appointmentForm.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/dashboard/appointments"
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('appointmentForm.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('appointmentForm.subtitle')}
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            // Adjust step completion check for patient users (step 1 is auto-completed)
            const isCompleted = isPatientUser
              ? (step.id === 1 || currentStep > step.id)
              : currentStep > step.id;
            const isCurrent = currentStep === step.id;
            const canNavigateTo = isPatientUser
              ? step.id !== 1 && isCompleted
              : isCompleted;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex items-center">
                  <button
                    onClick={() => canNavigateTo && setCurrentStep(step.id)}
                    disabled={!canNavigateTo && !isCurrent}
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                      isCurrent
                        ? 'bg-brand border-lime-600 text-white'
                        : isCompleted
                        ? 'bg-green-500 border-green-500 text-white cursor-pointer'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                    }`}
                  >
                    {isCompleted && !isCurrent ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={step.icon} />
                      </svg>
                    )}
                  </button>
                  <span className={`ml-3 text-sm font-medium hidden sm:block ${
                    isCurrent || isCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-400'
                  }`}>
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading state while auto-selecting patient */}
      {isAutoSelectingPatient && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-blue-700 dark:text-blue-300">{t('appointmentForm.loadingPatientInfo')}</span>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errors.submit && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {errors.submit}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          {/* Step 1: Select Patient (hidden for patient users) */}
          {currentStep === 1 && !isPatientUser && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('appointmentForm.selectPatient')}
              </h2>

              {/* Search */}
              <div className="mb-6">
                <div className="relative">
                  <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder={t('appointmentForm.searchPatientsPh')}
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
                  />
                </div>
              </div>

              {errors.patientId && (
                <p className="mb-4 text-sm text-red-500">{errors.patientId}</p>
              )}

              {/* Patient List */}
              {loadingPatients ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">{t('appointmentForm.loadingPatients')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {patients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => handlePatientSelect(patient)}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        formData.patientId === patient.id
                          ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-lime-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-lime-100 dark:bg-lime-900 flex items-center justify-center text-lime-600 dark:text-lime-400 font-medium">
                          {patient.firstName[0]}{patient.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {patient.patientId} • {patient.phoneNumber}
                          </p>
                        </div>
                        {formData.patientId === patient.id && (
                          <svg className="w-5 h-5 text-lime-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {patients.length === 0 && !loadingPatients && (
                <div className="text-center py-8 text-gray-500">
                  {t('appointmentForm.noPatients')}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Doctor */}
          {currentStep === 2 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('appointmentForm.selectDoctor')}
              </h2>

              {/* Patient Info Banner for patient users */}
              {isPatientUser && selectedPatient && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600 dark:text-green-400 font-medium">
                      {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        {t('fam.booking.for')} <span className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</span>
                      </p>
                      {selectedPatient.patientId && (
                        <p className="text-xs text-green-600 dark:text-green-400">{t('fam.booking.patientId', { id: selectedPatient.patientId })}</p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="mb-6">
                <div className="relative">
                  <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder={t('appointmentForm.searchDoctorsPh')}
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
                  />
                </div>
              </div>

              {errors.doctorId && (
                <p className="mb-4 text-sm text-red-500">{errors.doctorId}</p>
              )}

              {/* Doctor List */}
              {loadingDoctors ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">{t('appointmentForm.loadingDoctors')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {doctors.map((doctor) => {
                    const availabilityInfo = doctorAvailabilityMap[doctor.id];

                    const renderAvailabilityBadge = () => {
                      if (!availabilityInfo) return null;

                      let bgColor = '';
                      let textColor = '';
                      let text = '';

                      switch (availabilityInfo.status) {
                        case 'available_today':
                          bgColor = 'bg-green-100 dark:bg-green-900/30';
                          textColor = 'text-green-700 dark:text-green-400';
                          text = t('appointmentForm.availableToday');
                          break;
                        case 'available_tomorrow':
                          bgColor = 'bg-blue-100 dark:bg-blue-900/30';
                          textColor = 'text-blue-700 dark:text-blue-400';
                          text = t('appointmentForm.availableTomorrow');
                          break;
                        case 'available_later':
                          bgColor = 'bg-amber-100 dark:bg-amber-900/30';
                          textColor = 'text-amber-700 dark:text-amber-400';
                          text = t('appointmentForm.nextAvailable', { date: availabilityInfo.nextDate || '' });
                          break;
                        case 'unavailable':
                          bgColor = 'bg-gray-100 dark:bg-gray-700';
                          textColor = 'text-gray-500 dark:text-gray-400';
                          text = t('appointmentForm.noSlotsWeek');
                          break;
                        default:
                          return null;
                      }

                      return (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
                          {availabilityInfo.status === 'available_today' && (
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                          {text}
                        </span>
                      );
                    };

                    return (
                      <button
                        key={doctor.id}
                        type="button"
                        onClick={() => handleDoctorSelect(doctor)}
                        className={`p-4 rounded-lg border text-left transition-colors ${
                          formData.doctorId === doctor.id
                            ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-lime-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">
                            {doctor.firstName[0]}{doctor.lastName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white">
                              Dr. {doctor.firstName} {doctor.lastName}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {doctor.department}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {doctor.specializations?.slice(0, 2).join(', ')}
                            </p>
                            <div className="flex items-center flex-wrap gap-2 mt-2">
                              <span className="text-xs text-green-600 dark:text-green-400">
                                {formatCurrency(doctor.consultationFee)}
                              </span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500">
                                {doctor.schedule?.filter(s => s.isActive).map(s => getDayName(s.dayOfWeek)).join(', ')}
                              </span>
                            </div>
                            {renderAvailabilityBadge() && (
                              <div className="mt-2">
                                {renderAvailabilityBadge()}
                              </div>
                            )}
                          </div>
                          {formData.doctorId === doctor.id && (
                            <svg className="w-5 h-5 text-lime-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {doctors.length === 0 && !loadingDoctors && (
                <div className="text-center py-8 text-gray-500">
                  {t('appointmentForm.noDoctors')}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Date & Time */}
          {currentStep === 3 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('appointmentForm.selectDateTime')}
              </h2>

              {/* Selected Doctor Info */}
              {selectedDoctor && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    {t('appointmentForm.schedulingWith')} <span className="font-medium">Dr {selectedDoctor.firstName} {selectedDoctor.lastName}</span>
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {t('appointmentForm.availableDays')} {selectedDoctor.schedule?.filter(s => s.isActive).map(s => getDayName(s.dayOfWeek)).join(', ')}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('appointmentForm.date')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="appointmentDate"
                    value={formData.appointmentDate}
                    onChange={handleChange}
                    min={toLocalDateString(new Date())}
                    className={inputClassName('appointmentDate')}
                  />
                  {errors.appointmentDate && (
                    <p className="mt-1 text-sm text-red-500">{errors.appointmentDate}</p>
                  )}
                </div>

                {/* Appointment Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('appointmentForm.type')}
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className={inputClassName('type')}
                  >
                    <option value="IN_PERSON">{tEnum('IN_PERSON')}</option>
                    <option value="VIDEO">{t('tele.booking.option')}</option>
                    <option value="PHONE">{tEnum('PHONE')}</option>
                  </select>
                  {formData.type === 'VIDEO' && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('tele.booking.hint')}</p>}
                </div>
              </div>

              {/* Time Slots */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('appointmentForm.slots')} <span className="text-red-500">*</span>
                  </label>
                  {availability?.workingHours && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t('appointmentForm.workingHours')} {formatTime(availability.workingHours.start)} - {formatTime(availability.workingHours.end)}
                    </span>
                  )}
                </div>

                {!formData.appointmentDate || isPastDate(formData.appointmentDate) ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    {t('appointmentForm.selectDateFirst')}
                  </div>
                ) : loadingAvailability ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <svg className="animate-spin w-8 h-8 mx-auto text-lime-600 mb-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400">{t('appointmentForm.loadingSlots')}</p>
                  </div>
                ) : availabilityError ? (
                  <div className="text-center py-8 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <svg className="w-12 h-12 mx-auto text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-600 dark:text-red-400">{availabilityError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedDoctor && formData.appointmentDate) {
                          setLoadingAvailability(true);
                          setAvailabilityError(null);
                          api.getDoctorAvailability(selectedDoctor.id, formData.appointmentDate)
                            .then(data => setAvailability(data))
                            .catch(() => setAvailabilityError(t('appointmentForm.errAvailability')))
                            .finally(() => setLoadingAvailability(false));
                        }
                      }}
                      className="mt-3 px-4 py-2 text-sm font-medium text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      {t('appointmentForm.retry')}
                    </button>
                  </div>
                ) : !availability?.isWorkingDay ? (
                  <div className="text-center py-8 text-gray-500 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <svg className="w-12 h-12 mx-auto text-amber-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-amber-700 dark:text-amber-400">{t('appointmentForm.notAvailableDay')}</p>
                    <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">{t('appointmentForm.selectAnotherDate')}</p>
                  </div>
                ) : availability?.slots.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>{t('appointmentForm.noSlotsDate')}</p>
                    <p className="text-sm">{t('appointmentForm.allBooked')}</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                      {availability?.slots.map((slot) => {
                        const isSelected = formData.startTime === slot.time;
                        const isAvailable = slot.available;

                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => {
                              if (isAvailable) {
                                setFormData(prev => ({ ...prev, startTime: slot.time }));
                                setErrors(prev => ({ ...prev, startTime: '' }));
                              }
                            }}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-brand text-white'
                                : isAvailable
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-lime-100 dark:hover:bg-lime-900'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed line-through'
                            }`}
                          >
                            {formatTime(slot.time)}
                          </button>
                        );
                      })}
                    </div>

                    {/* Available slots count */}
                    <div className="mt-3 flex items-center text-sm text-green-600 dark:text-green-400">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('appointmentForm.slotsAvailable', { count: availability?.slots.filter(s => s.available).length ?? 0 })}
                    </div>
                  </>
                )}

                {errors.startTime && (
                  <p className="mt-2 text-sm text-red-500">{errors.startTime}</p>
                )}

                {formData.startTime && formData.endTime && (
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                    {t('appointmentForm.selected')} <span className="font-medium">{formatTime(formData.startTime)} - {formatTime(formData.endTime)}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Details */}
          {currentStep === 4 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('appointmentForm.details')}
              </h2>

              {/* Summary */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('appointmentForm.summary')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('appointmentForm.patient')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedPatient?.firstName} {selectedPatient?.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('appointmentForm.doctor')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Dr {selectedDoctor?.firstName} {selectedDoctor?.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('appointmentForm.dateTime')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formData.appointmentDate && formatDate(`${formData.appointmentDate}T00:00:00`, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {formData.startTime && ` ${t('appointmentForm.at')} ${formatTime(formData.startTime)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('appointmentForm.typeShort')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {tEnum(formData.type)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('appointmentForm.reason')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    onBlur={() => {
                      setReasonTouched(true);
                      if (!formData.reason.trim()) setErrors(prev => ({ ...prev, reason: t('appointmentForm.errReason') }));
                    }}
                    className={reasonTouched ? inputClassName('reason') : inputClassName('')}
                    placeholder={t('appointmentForm.reasonPh')}
                  />
                  {reasonTouched && errors.reason && (
                    <p className="mt-1 text-sm text-red-500">{errors.reason}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('appointmentForm.notes')}
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                    className={inputClassName('notes')}
                    placeholder={t('appointmentForm.notesPh')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 rounded-b-xl flex items-center justify-between">
            <div>
              {/* Show Previous button: for patients only if step > 2, for others if step > 1 */}
              {((isPatientUser && currentStep > 2) || (!isPatientUser && currentStep > 1)) && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {t('appointmentForm.previous')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/appointments"
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {t('appointmentForm.cancel')}
              </Link>
              {currentStep < 4 ? (
                <button key="step-next"
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {t('appointmentForm.nextStep')}
                </button>
              ) : (
                <button key="step-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-brand hover:bg-brand-hover disabled:bg-lime-400 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('appointmentForm.scheduling')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {t('appointmentForm.submit')}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
