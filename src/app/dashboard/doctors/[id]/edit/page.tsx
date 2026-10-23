'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api, Doctor } from '@/lib/api';
import { useLanguage } from '@/context/language-context';

interface ScheduleDay {
  dayOfWeek: number;
  dayName: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
  slotDuration: number;
}

interface DoctorFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  departmentId: string;
  specializations: string[];
  qualifications: string[];
  licenseNumber: string;
  consultationFee: string;
  bio: string;
  languages: string[];
  isAvailable: boolean;
  schedule: ScheduleDay[];
}

const defaultSchedule: ScheduleDay[] = [
  { dayOfWeek: 0, dayName: 'Sunday', isActive: false, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
  { dayOfWeek: 1, dayName: 'Monday', isActive: true, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
  { dayOfWeek: 2, dayName: 'Tuesday', isActive: true, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
  { dayOfWeek: 3, dayName: 'Wednesday', isActive: true, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
  { dayOfWeek: 4, dayName: 'Thursday', isActive: true, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
  { dayOfWeek: 5, dayName: 'Friday', isActive: true, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
  { dayOfWeek: 6, dayName: 'Saturday', isActive: false, startTime: '09:00', endTime: '13:00', slotDuration: 30 },
];

const commonSpecializations = [
  'Médecine générale',
  'Médecine interne',
  'Cardiologie',
  'Dermatologie',
  'Endocrinologie',
  'Gastro-entérologie',
  'Gynécologie',
  'Obstétrique',
  'Maladies tropicales',
  "Médecine d'urgence",
  'Néphrologie',
  'Neurologie',
  'Oncologie',
  'Ophtalmologie',
  'ORL',
  'Orthopédie',
  'Pédiatrie',
  'Néonatologie',
  'Pneumologie',
  'Psychiatrie',
  'Radiologie',
  'Rhumatologie',
  'Chirurgie générale',
  'Urologie',
];

const commonQualifications = [
  'MD',
  'Doctorat en médecine',
  'Certificat de spécialiste',
  'DES',
  'DIU',
  'Master en santé publique',
  'PhD',
  'FRCS',
  'MRCP',
];

const commonLanguages = [
  'Français',
  'Anglais',
  'Pidgin',
  'Fulfuldé',
  'Ewondo',
  'Douala',
  'Bassa',
  'Bamiléké',
  'Bamoun',
  'Arabe',
];

export default function EditDoctorPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  // 7 Jan 2024 was a Sunday, so day N of that week maps to dayOfWeek N
  const dayLabel = (dayOfWeek: number) =>
    new Date(2024, 0, 7 + dayOfWeek).toLocaleDateString(locale, { weekday: 'long' });
  const params = useParams();
  const [originalDoctor, setOriginalDoctor] = useState<Doctor | null>(null);
  const [formData, setFormData] = useState<DoctorFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    departmentId: '',
    specializations: [],
    qualifications: [],
    licenseNumber: '',
    consultationFee: '',
    bio: '',
    languages: [],
    isAvailable: true,
    schedule: defaultSchedule,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [newSpecialization, setNewSpecialization] = useState('');
  const [newQualification, setNewQualification] = useState('');
  const [newLanguage, setNewLanguage] = useState('');

  const steps = [
    { id: 1, name: t('clinical.doctorEdit.step.basic'), icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 2, name: t('clinical.doctorForm.step.professional'), icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
    { id: 3, name: t('clinical.doctorForm.step.consultation'), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 4, name: t('clinical.doctorForm.step.schedule'), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ];

  const fetchDoctor = useCallback(async () => {
    try {
      setLoading(true);
      const doctor = await api.getDoctor(params.id as string);
      setOriginalDoctor(doctor);

      // Convert doctor data to form data
      const scheduleMap = new Map(
        doctor.schedule?.map((s) => [s.dayOfWeek, s]) || []
      );

      const formSchedule = defaultSchedule.map((day) => {
        const existingSchedule = scheduleMap.get(day.dayOfWeek);
        if (existingSchedule) {
          return {
            ...day,
            isActive: existingSchedule.isActive,
            startTime: existingSchedule.startTime,
            endTime: existingSchedule.endTime,
            slotDuration: existingSchedule.slotDuration,
          };
        }
        return day;
      });

      setFormData({
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        email: doctor.email,
        phoneNumber: doctor.phoneNumber,
        departmentId: doctor.departmentId,
        specializations: doctor.specializations || [],
        qualifications: doctor.qualifications || [],
        licenseNumber: doctor.licenseNumber,
        consultationFee: doctor.consultationFee.toString(),
        bio: doctor.bio || '',
        languages: doctor.languages || [],
        isAvailable: doctor.isAvailable,
        schedule: formSchedule,
      });
      setFetchError(null);
    } catch (err) {
      setFetchError(t('clinical.doctorEdit.failedToLoadDoctorData'));
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchDepartments = async () => {
    try {
      const response = await api.getDoctors({ limit: 1 });
      setDepartments(response.departments || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  useEffect(() => {
    fetchDoctor();
    fetchDepartments();
  }, [fetchDoctor]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setFormData((prev) => ({ ...prev, [name]: newValue }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleScheduleChange = (dayOfWeek: number, field: keyof ScheduleDay, value: string | boolean | number) => {
    setFormData((prev) => ({
      ...prev,
      schedule: prev.schedule.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day
      ),
    }));
  };

  const addToList = (field: 'specializations' | 'qualifications' | 'languages', value: string) => {
    if (!value.trim()) return;
    if (formData[field].includes(value.trim())) return;

    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], value.trim()],
    }));

    if (field === 'specializations') setNewSpecialization('');
    if (field === 'qualifications') setNewQualification('');
    if (field === 'languages') setNewLanguage('');
  };

  const removeFromList = (field: 'specializations' | 'qualifications' | 'languages', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((item) => item !== value),
    }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 2) {
      if (!formData.departmentId) newErrors.departmentId = t('clinical.doctorForm.departmentIsRequired');
      if (formData.specializations.length === 0) newErrors.specializations = t('clinical.doctorForm.atLeastOneSpecializationIsRequired');
      if (formData.qualifications.length === 0) newErrors.qualifications = t('clinical.doctorForm.atLeastOneQualificationIsRequired');
      if (!formData.licenseNumber.trim()) newErrors.licenseNumber = t('clinical.doctorForm.licenseNumberIsRequired');
    }

    if (step === 3) {
      if (!formData.consultationFee) {
        newErrors.consultationFee = t('clinical.doctorForm.consultationFeeIsRequired');
      } else if (isNaN(parseFloat(formData.consultationFee)) || parseFloat(formData.consultationFee) < 0) {
        newErrors.consultationFee = t('clinical.doctorForm.pleaseEnterAValidFee');
      }
      if (formData.languages.length === 0) newErrors.languages = t('clinical.doctorForm.atLeastOneLanguageIsRequired');
    }

    if (step === 4) {
      const activeDays = formData.schedule.filter((day) => day.isActive);
      if (activeDays.length === 0) {
        newErrors.schedule = t('clinical.doctorForm.atLeastOneWorkingDayIs');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 4) {
      handleNext();
      return;
    }

    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);

    try {
      const updateData = {
        departmentId: formData.departmentId,
        specializations: formData.specializations,
        qualifications: formData.qualifications,
        licenseNumber: formData.licenseNumber,
        consultationFee: parseFloat(formData.consultationFee),
        bio: formData.bio || undefined,
        languages: formData.languages,
        isAvailable: formData.isAvailable,
        schedule: formData.schedule.filter((day) => day.isActive).map((day) => ({
          dayOfWeek: day.dayOfWeek,
          startTime: day.startTime,
          endTime: day.endTime,
          slotDuration: day.slotDuration,
          isActive: day.isActive,
        })),
      };

      await api.updateDoctor(params.id as string, updateData);
      router.push(`/dashboard/doctors/${params.id}`);
    } catch (error) {
      console.error('Error updating doctor:', error);
      setErrors({ submit: error instanceof Error ? error.message : t('clinical.doctorEdit.failedToUpdateDoctor') });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
      </div>
    );
  }

  if (fetchError || !originalDoctor) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-red-600 mb-4">{fetchError || t('clinical.doctorDetail.notFound')}</p>
        <Link
          href="/dashboard/doctors"
          className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700"
        >
          {t('clinical.doctorDetail.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href={`/dashboard/doctors/${params.id}`}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('clinical.doctorEdit.title', { name: `${originalDoctor.firstName} ${originalDoctor.lastName}` })}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('clinical.doctorEdit.doctorId', { id: originalDoctor.doctorId })}
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    currentStep === step.id
                      ? 'bg-lime-600 border-lime-600 text-white'
                      : currentStep > step.id
                      ? 'bg-green-500 border-green-500 text-white cursor-pointer'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 cursor-pointer hover:border-lime-400'
                  }`}
                >
                  {currentStep > step.id ? (
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
                  currentStep >= step.id ? 'text-gray-900 dark:text-white' : 'text-gray-400'
                }`}>
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  currentStep > step.id ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {errors.submit && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{errors.submit}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          {/* Step 1: Basic Info (Read-only) */}
          {currentStep === 1 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('clinical.doctorEdit.basicInformation')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.doctorForm.firstName')}
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    className={`${inputClassName('firstName')} bg-gray-100 dark:bg-gray-600`}
                    disabled
                  />
                  <p className="mt-1 text-xs text-gray-500">{t('clinical.doctorEdit.nameChangesRequireAdminApproval')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.doctorForm.lastName')}
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    className={`${inputClassName('lastName')} bg-gray-100 dark:bg-gray-600`}
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.common.email')}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    className={`${inputClassName('email')} bg-gray-100 dark:bg-gray-600`}
                    disabled
                  />
                  <p className="mt-1 text-xs text-gray-500">{t('clinical.doctorEdit.emailChangesRequireVerification')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.doctorForm.phoneNumber')}
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    className={`${inputClassName('phoneNumber')} bg-gray-100 dark:bg-gray-600`}
                    disabled
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="isAvailable"
                      checked={formData.isAvailable}
                      onChange={handleChange}
                      className="w-4 h-4 text-lime-600 bg-gray-100 border-gray-300 rounded focus:ring-lime-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('clinical.doctorEdit.availableForAppointments')}
                    </span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500 ml-6">
                    {t('clinical.doctorEdit.toggleThisOffToTemporarilyBlock')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Professional Information */}
          {currentStep === 2 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('clinical.doctorForm.professionalInformation')}
              </h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('clinical.doctorForm.department')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="departmentId"
                      value={formData.departmentId}
                      onChange={handleChange}
                      className={inputClassName('departmentId')}
                    >
                      <option value="">{t('clinical.doctorForm.selectDepartment')}</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                    {errors.departmentId && (
                      <p className="mt-1 text-sm text-red-500">{errors.departmentId}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('clinical.doctorForm.licenseNumber')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={handleChange}
                      className={inputClassName('licenseNumber')}
                      placeholder={t('clinical.doctorEdit.enterLicenseNumber')}
                    />
                    {errors.licenseNumber && (
                      <p className="mt-1 text-sm text-red-500">{errors.licenseNumber}</p>
                    )}
                  </div>
                </div>

                {/* Specializations */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.doctorForm.specializations')} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.specializations.map((spec) => (
                      <span
                        key={spec}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-lime-100 dark:bg-lime-900/50 text-lime-700 dark:text-lime-300 rounded-full text-sm"
                      >
                        {spec}
                        <button
                          type="button"
                          onClick={() => removeFromList('specializations', spec)}
                          className="hover:text-lime-900 dark:hover:text-lime-100"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={newSpecialization}
                      onChange={(e) => setNewSpecialization(e.target.value)}
                      className={inputClassName('specializations')}
                    >
                      <option value="">{t('clinical.doctorEdit.selectSpecialization')}</option>
                      {commonSpecializations
                        .filter((s) => !formData.specializations.includes(s))
                        .map((spec) => (
                          <option key={spec} value={spec}>{spec}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => addToList('specializations', newSpecialization)}
                      className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 text-sm font-medium"
                    >
                      {t('clinical.doctorForm.add')}
                    </button>
                  </div>
                  {errors.specializations && (
                    <p className="mt-1 text-sm text-red-500">{errors.specializations}</p>
                  )}
                </div>

                {/* Qualifications */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.doctorForm.qualifications')} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.qualifications.map((qual) => (
                      <span
                        key={qual}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full text-sm"
                      >
                        {qual}
                        <button
                          type="button"
                          onClick={() => removeFromList('qualifications', qual)}
                          className="hover:text-green-900 dark:hover:text-green-100"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={newQualification}
                      onChange={(e) => setNewQualification(e.target.value)}
                      className={inputClassName('qualifications')}
                    >
                      <option value="">{t('clinical.doctorEdit.selectQualification')}</option>
                      {commonQualifications
                        .filter((q) => !formData.qualifications.includes(q))
                        .map((qual) => (
                          <option key={qual} value={qual}>{qual}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => addToList('qualifications', newQualification)}
                      className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 text-sm font-medium"
                    >
                      {t('clinical.doctorForm.add')}
                    </button>
                  </div>
                  {errors.qualifications && (
                    <p className="mt-1 text-sm text-red-500">{errors.qualifications}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Consultation Details */}
          {currentStep === 3 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('clinical.doctorForm.consultationDetails')}
              </h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('clinical.doctorForm.consultationFeeFcfa')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="consultationFee"
                      value={formData.consultationFee}
                      onChange={handleChange}
                      className={inputClassName('consultationFee')}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                    {errors.consultationFee && (
                      <p className="mt-1 text-sm text-red-500">{errors.consultationFee}</p>
                    )}
                  </div>
                </div>

                {/* Languages */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.doctorDetail.languages')} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.languages.map((lang) => (
                      <span
                        key={lang}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full text-sm"
                      >
                        {lang}
                        <button
                          type="button"
                          onClick={() => removeFromList('languages', lang)}
                          className="hover:text-purple-900 dark:hover:text-purple-100"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={newLanguage}
                      onChange={(e) => setNewLanguage(e.target.value)}
                      className={inputClassName('languages')}
                    >
                      <option value="">{t('clinical.doctorEdit.selectLanguage')}</option>
                      {commonLanguages
                        .filter((l) => !formData.languages.includes(l))
                        .map((lang) => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => addToList('languages', newLanguage)}
                      className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 text-sm font-medium"
                    >
                      {t('clinical.doctorForm.add')}
                    </button>
                  </div>
                  {errors.languages && (
                    <p className="mt-1 text-sm text-red-500">{errors.languages}</p>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('clinical.doctorEdit.bioAbout')}
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={4}
                    className={inputClassName('bio')}
                    placeholder={t('clinical.doctorEdit.writeABriefBioAboutThe')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Schedule */}
          {currentStep === 4 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('clinical.doctorDetail.weeklySchedule')}
              </h2>
              {errors.schedule && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 text-sm">{errors.schedule}</p>
                </div>
              )}
              <div className="space-y-4">
                {formData.schedule.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className={`p-4 rounded-lg border ${
                      day.isActive
                        ? 'border-lime-200 dark:border-lime-800 bg-lime-50 dark:bg-lime-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={day.isActive}
                            onChange={(e) => handleScheduleChange(day.dayOfWeek, 'isActive', e.target.checked)}
                            className="w-4 h-4 text-lime-600 bg-gray-100 border-gray-300 rounded focus:ring-lime-500"
                          />
                          <span className={`ml-2 font-medium ${
                            day.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {dayLabel(day.dayOfWeek)}
                          </span>
                        </label>
                      </div>

                      {day.isActive && (
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600 dark:text-gray-400">{t('clinical.doctorEdit.from')}</label>
                            <input
                              type="time"
                              value={day.startTime}
                              onChange={(e) => handleScheduleChange(day.dayOfWeek, 'startTime', e.target.value)}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600 dark:text-gray-400">{t('clinical.doctorEdit.to')}</label>
                            <input
                              type="time"
                              value={day.endTime}
                              onChange={(e) => handleScheduleChange(day.dayOfWeek, 'endTime', e.target.value)}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600 dark:text-gray-400">{t('clinical.doctorEdit.slot')}</label>
                            <select
                              value={day.slotDuration}
                              onChange={(e) => handleScheduleChange(day.dayOfWeek, 'slotDuration', parseInt(e.target.value))}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                            >
                              <option value={15}>{t('clinical.doctorEdit.15Min')}</option>
                              <option value={20}>{t('clinical.doctorEdit.20Min')}</option>
                              <option value={30}>{t('clinical.doctorEdit.30Min')}</option>
                              <option value={45}>{t('clinical.doctorEdit.45Min')}</option>
                              <option value={60}>{t('clinical.doctorEdit.60Min')}</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form Navigation */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  {t('clinical.common.previous')}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard/doctors/${params.id}`}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {t('clinical.common.cancel')}
              </Link>

              {currentStep < 4 ? (
                <button key="step-next"
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-lime-600 hover:bg-lime-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {t('clinical.common.next')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button key="step-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-lime-600 hover:bg-lime-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('clinical.doctorEdit.savingChanges')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t('clinical.doctorEdit.saveChanges')}
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
