'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface ScheduleDay {
  dayOfWeek: number;
  dayName: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
  slotDuration: number;
}

interface DoctorFormData {
  // User Selection or Creation
  createNewUser: boolean;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;

  // Professional Information
  departmentId: string;
  specializations: string[];
  qualifications: string[];
  licenseNumber: string;

  // Consultation Details
  consultationFee: string;
  bio: string;
  languages: string[];

  // Schedule
  schedule: ScheduleDay[];
}

const defaultSchedule: ScheduleDay[] = [
  { dayOfWeek: 0, dayName: 'Sunday', isActive: false, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
  { dayOfWeek: 1, dayName: 'Monday', isActive: false, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
  { dayOfWeek: 2, dayName: 'Tuesday', isActive: false, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
  { dayOfWeek: 3, dayName: 'Wednesday', isActive: false, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
  { dayOfWeek: 4, dayName: 'Thursday', isActive: false, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
  { dayOfWeek: 5, dayName: 'Friday', isActive: false, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
  { dayOfWeek: 6, dayName: 'Saturday', isActive: false, startTime: '09:00', endTime: '17:00', slotDuration: 30 },
];

const initialFormData: DoctorFormData = {
  createNewUser: true,
  userId: '',
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
  departmentId: '',
  specializations: [],
  qualifications: [],
  licenseNumber: '',
  consultationFee: '',
  bio: '',
  languages: [],
  schedule: defaultSchedule,
};

const commonSpecializations = [
  'General Medicine',
  'Internal Medicine',
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Radiology',
  'Rheumatology',
  'Surgery',
  'Urology',
];

const commonQualifications = [
  'MD',
  'MBBS',
  'DO',
  'PhD',
  'MS',
  'DNB',
  'FRCS',
  'MRCP',
  'Board Certified',
];

const commonLanguages = [
  'English',
  'Spanish',
  'French',
  'German',
  'Chinese',
  'Hindi',
  'Arabic',
  'Portuguese',
  'Japanese',
  'Korean',
];

export default function AddDoctorPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<DoctorFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [newSpecialization, setNewSpecialization] = useState('');
  const [newQualification, setNewQualification] = useState('');
  const [newLanguage, setNewLanguage] = useState('');

  const steps = [
    { id: 1, name: 'User Account', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 2, name: 'Professional', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
    { id: 3, name: 'Consultation', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 4, name: 'Schedule', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ];

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await api.getDoctors({ limit: 1 });
      setDepartments(response.departments || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

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

    if (step === 1) {
      if (formData.createNewUser) {
        if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
        if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
        if (!formData.email.trim()) {
          newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = 'Invalid email format';
        }
        if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
        if (!formData.password) {
          newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
          newErrors.password = 'Password must be at least 8 characters';
        }
        if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
      } else {
        if (!formData.userId) newErrors.userId = 'Please select a user';
      }
    }

    if (step === 2) {
      if (!formData.departmentId) newErrors.departmentId = 'Department is required';
      if (formData.specializations.length === 0) newErrors.specializations = 'At least one specialization is required';
      if (formData.qualifications.length === 0) newErrors.qualifications = 'At least one qualification is required';
      if (!formData.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required';
    }

    if (step === 3) {
      if (!formData.consultationFee) {
        newErrors.consultationFee = 'Consultation fee is required';
      } else if (isNaN(parseFloat(formData.consultationFee)) || parseFloat(formData.consultationFee) < 0) {
        newErrors.consultationFee = 'Please enter a valid fee amount';
      }
      if (formData.languages.length === 0) newErrors.languages = 'At least one language is required';
    }

    if (step === 4) {
      const activeDays = formData.schedule.filter((day) => day.isActive);
      if (activeDays.length === 0) {
        newErrors.schedule = 'At least one working day is required';
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

    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);

    try {
      const doctorData = {
        userId: formData.createNewUser ? undefined : formData.userId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        password: formData.createNewUser ? formData.password : undefined,
        departmentId: formData.departmentId,
        specializations: formData.specializations,
        qualifications: formData.qualifications,
        licenseNumber: formData.licenseNumber,
        consultationFee: parseFloat(formData.consultationFee),
        bio: formData.bio || undefined,
        languages: formData.languages,
        schedule: formData.schedule.filter((day) => day.isActive).map((day) => ({
          dayOfWeek: day.dayOfWeek,
          startTime: day.startTime,
          endTime: day.endTime,
          slotDuration: day.slotDuration,
          isActive: day.isActive,
        })),
      };

      await api.createDoctor(doctorData);
      router.push('/dashboard/doctors');
    } catch (error) {
      console.error('Error creating doctor:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to create doctor' });
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/dashboard/doctors"
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Doctor</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Create a new doctor profile with professional details and schedule
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex items-center">
                <button
                  onClick={() => currentStep > step.id && setCurrentStep(step.id)}
                  disabled={currentStep < step.id}
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    currentStep === step.id
                      ? 'bg-lime-600 border-lime-600 text-white'
                      : currentStep > step.id
                      ? 'bg-green-500 border-green-500 text-white cursor-pointer'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
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

      {/* Error Alert */}
      {errors.submit && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {errors.submit}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          {/* Step 1: User Account */}
          {currentStep === 1 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                User Account Information
              </h2>

              <div className="mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="createNewUser"
                    checked={formData.createNewUser}
                    onChange={handleChange}
                    className="w-5 h-5 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Create a new user account for this doctor
                  </span>
                </label>
              </div>

              {formData.createNewUser ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={inputClassName('firstName')}
                      placeholder="Enter first name"
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={inputClassName('lastName')}
                      placeholder="Enter last name"
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={inputClassName('email')}
                      placeholder="Enter email address"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      className={inputClassName('phoneNumber')}
                      placeholder="+1 234-567-8900"
                    />
                    {errors.phoneNumber && (
                      <p className="mt-1 text-sm text-red-500">{errors.phoneNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={inputClassName('password')}
                      placeholder="Enter password"
                    />
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-500">{errors.password}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={inputClassName('confirmPassword')}
                      placeholder="Confirm password"
                    />
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Existing User <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="userId"
                    value={formData.userId}
                    onChange={handleChange}
                    className={inputClassName('userId')}
                  >
                    <option value="">Select a user</option>
                    {/* Users would be fetched from API */}
                  </select>
                  {errors.userId && (
                    <p className="mt-1 text-sm text-red-500">{errors.userId}</p>
                  )}
                  <p className="mt-2 text-sm text-gray-500">
                    Only users with DOCTOR role who don&apos;t have a doctor profile will be shown.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Professional Information */}
          {currentStep === 2 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Professional Information
              </h2>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="departmentId"
                      value={formData.departmentId}
                      onChange={handleChange}
                      className={inputClassName('departmentId')}
                    >
                      <option value="">Select department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                    {errors.departmentId && (
                      <p className="mt-1 text-sm text-red-500">{errors.departmentId}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      License Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={handleChange}
                      className={inputClassName('licenseNumber')}
                      placeholder="Enter medical license number"
                    />
                    {errors.licenseNumber && (
                      <p className="mt-1 text-sm text-red-500">{errors.licenseNumber}</p>
                    )}
                  </div>
                </div>

                {/* Specializations */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Specializations <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2 mb-2">
                    <select
                      value={newSpecialization}
                      onChange={(e) => setNewSpecialization(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">Select or type a specialization</option>
                      {commonSpecializations
                        .filter((s) => !formData.specializations.includes(s))
                        .map((spec) => (
                          <option key={spec} value={spec}>{spec}</option>
                        ))}
                    </select>
                    <input
                      type="text"
                      value={newSpecialization}
                      onChange={(e) => setNewSpecialization(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToList('specializations', newSpecialization);
                        }
                      }}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder="Or type custom"
                    />
                    <button
                      type="button"
                      onClick={() => addToList('specializations', newSpecialization)}
                      className="px-4 py-2.5 bg-lime-600 text-white rounded-lg hover:bg-lime-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.specializations.map((spec) => (
                      <span
                        key={spec}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-lime-100 text-lime-700 rounded-full text-sm"
                      >
                        {spec}
                        <button
                          type="button"
                          onClick={() => removeFromList('specializations', spec)}
                          className="hover:text-lime-900"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  {errors.specializations && (
                    <p className="mt-1 text-sm text-red-500">{errors.specializations}</p>
                  )}
                </div>

                {/* Qualifications */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Qualifications <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2 mb-2">
                    <select
                      value={newQualification}
                      onChange={(e) => setNewQualification(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">Select or type a qualification</option>
                      {commonQualifications
                        .filter((q) => !formData.qualifications.includes(q))
                        .map((qual) => (
                          <option key={qual} value={qual}>{qual}</option>
                        ))}
                    </select>
                    <input
                      type="text"
                      value={newQualification}
                      onChange={(e) => setNewQualification(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToList('qualifications', newQualification);
                        }
                      }}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder="Or type custom"
                    />
                    <button
                      type="button"
                      onClick={() => addToList('qualifications', newQualification)}
                      className="px-4 py-2.5 bg-lime-600 text-white rounded-lg hover:bg-lime-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.qualifications.map((qual) => (
                      <span
                        key={qual}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                      >
                        {qual}
                        <button
                          type="button"
                          onClick={() => removeFromList('qualifications', qual)}
                          className="hover:text-green-900"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
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
                Consultation Details
              </h2>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Consultation Fee (FCFA) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="consultationFee"
                      value={formData.consultationFee}
                      onChange={handleChange}
                      className={inputClassName('consultationFee')}
                      placeholder="Enter fee amount"
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
                    Languages Spoken <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2 mb-2">
                    <select
                      value={newLanguage}
                      onChange={(e) => setNewLanguage(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">Select a language</option>
                      {commonLanguages
                        .filter((l) => !formData.languages.includes(l))
                        .map((lang) => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                    </select>
                    <input
                      type="text"
                      value={newLanguage}
                      onChange={(e) => setNewLanguage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToList('languages', newLanguage);
                        }
                      }}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder="Or type custom"
                    />
                    <button
                      type="button"
                      onClick={() => addToList('languages', newLanguage)}
                      className="px-4 py-2.5 bg-lime-600 text-white rounded-lg hover:bg-lime-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.languages.map((lang) => (
                      <span
                        key={lang}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                      >
                        {lang}
                        <button
                          type="button"
                          onClick={() => removeFromList('languages', lang)}
                          className="hover:text-purple-900"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  {errors.languages && (
                    <p className="mt-1 text-sm text-red-500">{errors.languages}</p>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Professional Bio
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={4}
                    className={inputClassName('bio')}
                    placeholder="Write a brief professional biography..."
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    This will be displayed on the doctor&apos;s public profile
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Schedule */}
          {currentStep === 4 && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Set Availability Schedule
              </h2>

              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Select the days this doctor is available and set working hours for each day.
                Click on a day to enable it, then configure the start time, end time, and appointment slot duration.
              </p>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      schedule: prev.schedule.map((day) => ({
                        ...day,
                        isActive: day.dayOfWeek >= 1 && day.dayOfWeek <= 5,
                      })),
                    }));
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Select Weekdays (Mon-Fri)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      schedule: prev.schedule.map((day) => ({
                        ...day,
                        isActive: false,
                      })),
                    }));
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Clear All
                </button>
              </div>

              {/* Selected Days Summary */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {formData.schedule.filter((d) => d.isActive).length === 0 ? (
                      <span>No days selected. Please select at least one working day.</span>
                    ) : (
                      <span>
                        <strong>{formData.schedule.filter((d) => d.isActive).length}</strong> day(s) selected: {' '}
                        {formData.schedule.filter((d) => d.isActive).map((d) => d.dayName).join(', ')}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {errors.schedule && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {errors.schedule}
                </div>
              )}

              <div className="space-y-3">
                {formData.schedule.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className={`p-4 rounded-lg border transition-all ${
                      day.isActive
                        ? 'border-lime-300 bg-lime-50 dark:border-lime-700 dark:bg-lime-900/20 shadow-sm'
                        : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className={`flex items-center justify-between ${day.isActive ? 'mb-4' : ''}`}>
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={day.isActive}
                          onChange={(e) => handleScheduleChange(day.dayOfWeek, 'isActive', e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
                        />
                        <span className={`text-sm font-medium ${
                          day.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {day.dayName}
                        </span>
                      </label>
                      {day.isActive ? (
                        <span className="text-xs bg-lime-100 dark:bg-lime-800 text-lime-700 dark:text-lime-300 px-2 py-1 rounded-full font-medium">
                          Available
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Click to enable
                        </span>
                      )}
                    </div>

                    {day.isActive && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-lime-200 dark:border-lime-800">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Start Time
                          </label>
                          <input
                            type="time"
                            value={day.startTime}
                            onChange={(e) => handleScheduleChange(day.dayOfWeek, 'startTime', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            End Time
                          </label>
                          <input
                            type="time"
                            value={day.endTime}
                            onChange={(e) => handleScheduleChange(day.dayOfWeek, 'endTime', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Slot Duration
                          </label>
                          <select
                            value={day.slotDuration}
                            onChange={(e) => handleScheduleChange(day.dayOfWeek, 'slotDuration', parseInt(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                          >
                            <option value={15}>15 minutes</option>
                            <option value={20}>20 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={45}>45 minutes</option>
                            <option value={60}>60 minutes</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Help Text */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Tips:</h4>
                <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-disc list-inside">
                  <li>Select only the days the doctor is available for appointments</li>
                  <li>Set accurate working hours to ensure proper appointment scheduling</li>
                  <li>Slot duration determines how long each appointment will be</li>
                  <li>The schedule can be modified later from the doctor&apos;s profile</li>
                </ul>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 rounded-b-xl flex items-center justify-between">
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Previous
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/doctors"
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </Link>
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 bg-lime-600 hover:bg-lime-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Next Step
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-lime-600 hover:bg-lime-700 disabled:bg-lime-400 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating Doctor...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Create Doctor
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
