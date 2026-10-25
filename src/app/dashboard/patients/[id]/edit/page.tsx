'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api, PatientDetail, type Patient } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { toLocalDateString } from '@/lib/formatters';

interface PatientFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  allergies: string;
  chronicConditions: string;
  notes: string;
  hasInsurance: boolean;
  insuranceProvider: string;
  policyNumber: string;
  groupNumber: string;
  insuranceValidFrom: string;
  insuranceValidUntil: string;
  coverageType: string;
}

const initialFormData: PatientFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  dateOfBirth: '',
  gender: '',
  bloodType: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  emergencyName: '',
  emergencyRelation: '',
  emergencyPhone: '',
  allergies: '',
  chronicConditions: '',
  notes: '',
  hasInsurance: false,
  insuranceProvider: '',
  policyNumber: '',
  groupNumber: '',
  insuranceValidFrom: '',
  insuranceValidUntil: '',
  coverageType: '',
};

export default function EditPatientPage() {
  const router = useRouter();
  const params = useParams();
  const { t, tEnum } = useLanguage();
  const [formData, setFormData] = useState<PatientFormData>(initialFormData);
  const [originalPatient, setOriginalPatient] = useState<PatientDetail | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof PatientFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  const fetchPatient = useCallback(async () => {
    try {
      setLoading(true);
      const patient = await api.getPatient(params.id as string);
      setOriginalPatient(patient);

      // Convert patient data to form data
      setFormData({
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phoneNumber: patient.phoneNumber,
        dateOfBirth: patient.dateOfBirth.split('T')[0],
        gender: patient.gender,
        bloodType: patient.bloodType || '',
        address: patient.address,
        city: patient.city,
        state: patient.state,
        zipCode: patient.zipCode,
        country: patient.country,
        emergencyName: patient.emergencyName,
        emergencyRelation: patient.emergencyRelation,
        emergencyPhone: patient.emergencyPhone,
        allergies: patient.allergies?.join(', ') || '',
        chronicConditions: patient.chronicConditions?.join(', ') || '',
        notes: patient.notes || '',
        hasInsurance: !!patient.insurance,
        insuranceProvider: patient.insurance?.provider || '',
        policyNumber: patient.insurance?.policyNumber || '',
        groupNumber: patient.insurance?.groupNumber || '',
        insuranceValidFrom: patient.insurance?.validFrom?.split('T')[0] || '',
        insuranceValidUntil: patient.insurance?.validUntil?.split('T')[0] || '',
        coverageType: patient.insurance?.coverageType || '',
      });
      setFetchError(null);
    } catch (err) {
      setFetchError(t('patientForm.errLoad'));
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  const steps = [
    { id: 1, name: t('patientForm.stepPersonal'), icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 2, name: t('patientForm.stepContact'), icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 3, name: t('patientForm.stepMedical'), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 4, name: t('patientForm.stepInsurance'), icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  ];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setFormData((prev) => ({ ...prev, [name]: newValue }));

    if (errors[name as keyof PatientFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof PatientFormData, string>> = {};

    if (step === 1) {
      if (!formData.firstName.trim()) newErrors.firstName = t('patientForm.errFirstName');
      if (!formData.lastName.trim()) newErrors.lastName = t('patientForm.errLastName');
      if (!formData.email.trim()) {
        newErrors.email = t('patientForm.errEmail');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = t('patientForm.errEmailFormat');
      }
      if (!formData.phoneNumber.trim()) newErrors.phoneNumber = t('patientForm.errPhone');
      if (!formData.dateOfBirth) newErrors.dateOfBirth = t('patientForm.errDob');
      if (!formData.gender) newErrors.gender = t('patientForm.errGender');
    }

    if (step === 2) {
      if (!formData.address.trim()) newErrors.address = t('patientForm.errAddress');
      if (!formData.city.trim()) newErrors.city = t('patientForm.errCity');
      if (!formData.state.trim()) newErrors.state = t('patientForm.errState');
      if (!formData.country.trim()) newErrors.country = t('patientForm.errCountry');
      if (!formData.emergencyName.trim()) newErrors.emergencyName = t('patientForm.errEmergencyName');
      if (!formData.emergencyRelation.trim()) newErrors.emergencyRelation = t('patientForm.errRelation');
      if (!formData.emergencyPhone.trim()) newErrors.emergencyPhone = t('patientForm.errEmergencyPhone');
    }

    if (step === 4 && formData.hasInsurance) {
      if (!formData.insuranceProvider.trim()) newErrors.insuranceProvider = t('patientForm.errProvider');
      if (!formData.policyNumber.trim()) newErrors.policyNumber = t('patientForm.errPolicy');
      if (!formData.insuranceValidFrom) newErrors.insuranceValidFrom = t('patientForm.errValidFrom');
      if (!formData.insuranceValidUntil) newErrors.insuranceValidUntil = t('patientForm.errValidUntil');
      if (!formData.coverageType) newErrors.coverageType = t('patientForm.errCoverage');
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
      // Prepare update data
      const updateData: Parameters<typeof api.updatePatient>[1] = {
        dateOfBirth: new Date(formData.dateOfBirth).toISOString(),
        gender: formData.gender as Patient['gender'],
        bloodType: formData.bloodType || undefined,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        country: formData.country,
        emergencyName: formData.emergencyName,
        emergencyRelation: formData.emergencyRelation,
        emergencyPhone: formData.emergencyPhone,
        allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
        chronicConditions: formData.chronicConditions ? formData.chronicConditions.split(',').map(c => c.trim()).filter(Boolean) : [],
        notes: formData.notes || undefined,
      };

      await api.updatePatient(params.id as string, updateData);
      router.push(`/dashboard/patients/${params.id}`);
    } catch (error) {
      console.error('Error updating patient:', error);
      setErrors({ firstName: t('patientForm.errUpdate') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClassName = (fieldName: keyof PatientFormData) =>
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

  if (fetchError || !originalPatient) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-red-600 mb-4">{fetchError || t('patientForm.notFound')}</p>
        <Link
          href="/dashboard/patients"
          className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
        >
          {t('patientForm.backToPatients')}
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
            href={`/dashboard/patients/${params.id}`}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('patientForm.titleEdit', { name: `${originalPatient.firstName} ${originalPatient.lastName}` })}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('patientForm.patientIdValue', { id: originalPatient.patientId })}
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
                      ? 'bg-brand border-lime-600 text-white'
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

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('patientForm.personalInfo')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.firstName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={inputClassName('firstName')}
                    placeholder={t('patientForm.firstNamePh')}
                    disabled
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">{t('patientForm.nameChangeHelp')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.lastName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={inputClassName('lastName')}
                    placeholder={t('patientForm.lastNamePh')}
                    disabled
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.emailShort')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={inputClassName('email')}
                    placeholder={t('patientForm.emailPh')}
                    disabled
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">{t('patientForm.emailChangeHelp')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.phone')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    className={inputClassName('phoneNumber')}
                    placeholder={t('patientForm.phonePh')}
                    disabled
                  />
                  {errors.phoneNumber && (
                    <p className="mt-1 text-sm text-red-500">{errors.phoneNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.dob')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className={inputClassName('dateOfBirth')}
                    max={toLocalDateString()}
                  />
                  {errors.dateOfBirth && (
                    <p className="mt-1 text-sm text-red-500">{errors.dateOfBirth}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.gender')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className={inputClassName('gender')}
                  >
                    <option value="">{t('patientForm.selectGender')}</option>
                    <option value="MALE">{tEnum('MALE')}</option>
                    <option value="FEMALE">{tEnum('FEMALE')}</option>
                    <option value="OTHER">{tEnum('OTHER')}</option>
                  </select>
                  {errors.gender && (
                    <p className="mt-1 text-sm text-red-500">{errors.gender}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.bloodType')}
                  </label>
                  <select
                    name="bloodType"
                    value={formData.bloodType}
                    onChange={handleChange}
                    className={inputClassName('bloodType')}
                  >
                    <option value="">{t('patientForm.selectBloodType')}</option>
                    <option value="A_POSITIVE">A+</option>
                    <option value="A_NEGATIVE">A-</option>
                    <option value="B_POSITIVE">B+</option>
                    <option value="B_NEGATIVE">B-</option>
                    <option value="AB_POSITIVE">AB+</option>
                    <option value="AB_NEGATIVE">AB-</option>
                    <option value="O_POSITIVE">O+</option>
                    <option value="O_NEGATIVE">O-</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact & Address */}
          {currentStep === 2 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('patientForm.addressInfo')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.street')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className={inputClassName('address')}
                    placeholder={t('patientForm.streetPh')}
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-500">{errors.address}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.city')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className={inputClassName('city')}
                    placeholder={t('patientForm.cityPh')}
                  />
                  {errors.city && (
                    <p className="mt-1 text-sm text-red-500">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.state')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className={inputClassName('state')}
                    placeholder={t('patientForm.statePh')}
                  />
                  {errors.state && (
                    <p className="mt-1 text-sm text-red-500">{errors.state}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.zipCode')} <span className="text-gray-400 font-normal">({t('patientForm.optional')})</span>
                  </label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    className={inputClassName('zipCode')}
                    placeholder={t('patientForm.zipPh')}
                  />
                  {errors.zipCode && (
                    <p className="mt-1 text-sm text-red-500">{errors.zipCode}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.country')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className={inputClassName('country')}
                    placeholder={t('patientForm.countryPh')}
                  />
                  {errors.country && (
                    <p className="mt-1 text-sm text-red-500">{errors.country}</p>
                  )}
                </div>
              </div>

              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('patientForm.emergency')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.contactName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="emergencyName"
                    value={formData.emergencyName}
                    onChange={handleChange}
                    className={inputClassName('emergencyName')}
                    placeholder={t('patientForm.contactNamePh')}
                  />
                  {errors.emergencyName && (
                    <p className="mt-1 text-sm text-red-500">{errors.emergencyName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.relationship')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="emergencyRelation"
                    value={formData.emergencyRelation}
                    onChange={handleChange}
                    className={inputClassName('emergencyRelation')}
                    placeholder={t('patientForm.relationPh')}
                  />
                  {errors.emergencyRelation && (
                    <p className="mt-1 text-sm text-red-500">{errors.emergencyRelation}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.phone')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={handleChange}
                    className={inputClassName('emergencyPhone')}
                    placeholder={t('patientForm.phonePh')}
                  />
                  {errors.emergencyPhone && (
                    <p className="mt-1 text-sm text-red-500">{errors.emergencyPhone}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Medical Information */}
          {currentStep === 3 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('patientForm.medicalInfo')}
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.allergies')}
                  </label>
                  <textarea
                    name="allergies"
                    value={formData.allergies}
                    onChange={handleChange}
                    rows={3}
                    className={inputClassName('allergies')}
                    placeholder={t('patientForm.allergiesPh')}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('patientForm.allergiesHelp')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.chronic')}
                  </label>
                  <textarea
                    name="chronicConditions"
                    value={formData.chronicConditions}
                    onChange={handleChange}
                    rows={3}
                    className={inputClassName('chronicConditions')}
                    placeholder={t('patientForm.chronicPh')}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('patientForm.chronicHelp')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('patientForm.notes')}
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                    className={inputClassName('notes')}
                    placeholder={t('patientForm.notesPh')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Insurance */}
          {currentStep === 4 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                {t('patientForm.insuranceInfo')}
              </h2>

              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="hasInsurance"
                    checked={formData.hasInsurance}
                    onChange={handleChange}
                    className="w-4 h-4 text-lime-600 bg-gray-100 border-gray-300 rounded focus:ring-lime-500 dark:focus:ring-lime-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('patientForm.hasCoverage')}
                  </span>
                </label>
              </div>

              {formData.hasInsurance && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('patientForm.provider')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="insuranceProvider"
                      value={formData.insuranceProvider}
                      onChange={handleChange}
                      className={inputClassName('insuranceProvider')}
                      placeholder={t('patientForm.providerPh')}
                    />
                    {errors.insuranceProvider && (
                      <p className="mt-1 text-sm text-red-500">{errors.insuranceProvider}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('patientForm.policy')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="policyNumber"
                      value={formData.policyNumber}
                      onChange={handleChange}
                      className={inputClassName('policyNumber')}
                      placeholder={t('patientForm.policyPh')}
                    />
                    {errors.policyNumber && (
                      <p className="mt-1 text-sm text-red-500">{errors.policyNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('patientForm.group')}
                    </label>
                    <input
                      type="text"
                      name="groupNumber"
                      value={formData.groupNumber}
                      onChange={handleChange}
                      className={inputClassName('groupNumber')}
                      placeholder={t('patientForm.groupPh')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('patientForm.validFrom')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="insuranceValidFrom"
                      value={formData.insuranceValidFrom}
                      onChange={handleChange}
                      className={inputClassName('insuranceValidFrom')}
                    />
                    {errors.insuranceValidFrom && (
                      <p className="mt-1 text-sm text-red-500">{errors.insuranceValidFrom}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('patientForm.validUntil')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="insuranceValidUntil"
                      value={formData.insuranceValidUntil}
                      onChange={handleChange}
                      className={inputClassName('insuranceValidUntil')}
                    />
                    {errors.insuranceValidUntil && (
                      <p className="mt-1 text-sm text-red-500">{errors.insuranceValidUntil}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('patientForm.coverage')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="coverageType"
                      value={formData.coverageType}
                      onChange={handleChange}
                      className={inputClassName('coverageType')}
                    >
                      <option value="">{t('patientForm.selectCoverage')}</option>
                      <option value="Full Coverage">{t('patientForm.coverageFULL')}</option>
                      <option value="Partial Coverage">{t('patientForm.coveragePARTIAL')}</option>
                      <option value="Basic">{t('patientForm.coverageBASIC')}</option>
                      <option value="Premium">{t('patientForm.coveragePREMIUM')}</option>
                    </select>
                    {errors.coverageType && (
                      <p className="mt-1 text-sm text-red-500">{errors.coverageType}</p>
                    )}
                  </div>
                </div>
              )}

              {!formData.hasInsurance && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p>{t('patientForm.noInsurance')}</p>
                  <p className="text-sm mt-1">{t('patientForm.checkCoverage')}</p>
                </div>
              )}
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
                  {t('patientForm.previous')}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard/patients/${params.id}`}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {t('patientForm.cancel')}
              </Link>

              {currentStep < 4 ? (
                <button key="step-next"
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {t('patientForm.next')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button key="step-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('patientForm.saving')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t('patientForm.save')}
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
