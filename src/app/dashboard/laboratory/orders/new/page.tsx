'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, Doctor, LabTest, Patient } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { useDebounce } from '@/hooks/use-debounce';
import { calculateAge } from '@/lib/formatters';

type Priority = 'ROUTINE' | 'URGENT' | 'STAT';

const PRIORITIES: { value: Priority; hintKey: string; activeClass: string }[] = [
  { value: 'ROUTINE', hintKey: 'lab.new.priorityRoutineHint', activeClass: 'border-lime-500 bg-lime-50 dark:bg-lime-900/30' },
  { value: 'URGENT', hintKey: 'lab.new.priorityUrgentHint', activeClass: 'border-orange-500 bg-orange-50 dark:bg-orange-900/30' },
  { value: 'STAT', hintKey: 'lab.new.priorityStatHint', activeClass: 'border-red-500 bg-red-50 dark:bg-red-900/30' },
];

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lime-500 focus:border-transparent';

function NewLabOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientIdParam = searchParams.get('patientId');
  const consultationId = searchParams.get('consultationId');

  const { user } = useAuth();
  const { t, tEnum, formatCurrency } = useLanguage();
  const toast = useToast();

  // Doctors order for themselves; other roles (e.g. admin) must pick the ordering doctor
  const ownDoctorId = user?.doctorId;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const debouncedPatientSearch = useDebounce(patientSearch, 300);
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState('');

  const [tests, setTests] = useState<LabTest[]>([]);
  const [testFilter, setTestFilter] = useState('');
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);

  const [priority, setPriority] = useState<Priority>('ROUTINE');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Test catalog
  useEffect(() => {
    api.getLabTests({ isActive: true, limit: 500 })
      .then((response) => setTests(response.labTests.filter((test) => test.isActive)))
      .catch(() => setSubmitError(t('lab.new.loadFailed')))
      .finally(() => setLoadingTests(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Doctor list only when the user is not a doctor
  useEffect(() => {
    if (ownDoctorId || !user) return;
    api.getDoctors({ limit: 100 })
      .then((response) => setDoctors(response.data))
      .catch((err) => console.error('Error fetching doctors:', err));
  }, [ownDoctorId, user]);

  // Prefill patient from ?patientId=
  useEffect(() => {
    if (!patientIdParam) return;
    api.getPatient(patientIdParam)
      .then((p) => setPatient(p as unknown as Patient))
      .catch((err) => console.error('Error fetching patient:', err));
  }, [patientIdParam]);

  // Patient search
  useEffect(() => {
    if (patient || debouncedPatientSearch.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    let cancelled = false;
    setSearchingPatients(true);
    api.getPatients({ search: debouncedPatientSearch.trim(), limit: 8 })
      .then((response) => !cancelled && setPatientResults(response.data))
      .catch(() => !cancelled && setPatientResults([]))
      .finally(() => !cancelled && setSearchingPatients(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedPatientSearch, patient]);

  const categoryLabel = (cat: string) => {
    const key = `lab.category.${cat}`;
    const label = t(key);
    return label === key ? cat : label;
  };

  const testsByCategory = useMemo(() => {
    const filter = testFilter.trim().toLowerCase();
    const groups: Record<string, LabTest[]> = {};
    tests
      .filter((test) => !filter || test.name.toLowerCase().includes(filter) || test.code.toLowerCase().includes(filter))
      .forEach((test) => {
        (groups[test.category] ||= []).push(test);
      });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [tests, testFilter]);

  const selectedTotal = useMemo(
    () => tests.filter((test) => selectedTestIds.includes(test.id)).reduce((sum, test) => sum + Number(test.price || 0), 0),
    [tests, selectedTestIds]
  );

  const toggleTest = (id: string) => {
    setSelectedTestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setErrors((prev) => ({ ...prev, tests: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!patient) nextErrors.patient = t('lab.new.errorPatient');
    const orderingDoctorId = ownDoctorId || doctorId;
    if (!orderingDoctorId) nextErrors.doctor = t('lab.new.errorDoctor');
    if (selectedTestIds.length === 0) nextErrors.tests = t('lab.new.errorTests');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !patient) return;

    const payload = {
      patientId: patient.id,
      doctorId: orderingDoctorId,
      priority,
      notes: notes.trim() || undefined,
      consultationId: consultationId || undefined,
      tests: selectedTestIds.map((labTestId) => ({ labTestId })),
    };

    try {
      setSubmitting(true);
      setSubmitError('');
      const order = await api.createLabOrder(payload);
      toast.success(t('lab.new.success'), t('lab.new.successMsg', { patient: `${patient.firstName} ${patient.lastName}` }));
      router.push(`/dashboard/laboratory/orders/${order.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('lab.new.failed'));
      setSubmitting(false);
    }
  };

  const backHref = consultationId ? `/dashboard/consultations/${consultationId}` : '/dashboard/laboratory';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={backHref}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label={t('lab.detail.back')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('lab.new.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('lab.new.subtitle')}</p>
        </div>
      </div>

      {consultationId && (
        <div className="px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-sm text-blue-700 dark:text-blue-300">
          {t('lab.new.linkedConsultation')}
        </div>
      )}

      {submitError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('lab.new.patient')} *</h2>
          {patient ? (
            <div className="flex items-center justify-between p-4 rounded-lg bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-lime-100 dark:bg-lime-900/50 flex items-center justify-center text-lime-700 dark:text-lime-400 font-semibold">
                  {patient.firstName?.[0]}
                  {patient.lastName?.[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {patient.firstName} {patient.lastName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {[
                      patient.patientId,
                      patient.dateOfBirth ? t('unit.years', { count: calculateAge(patient.dateOfBirth) }) : null,
                      patient.gender ? tEnum(patient.gender) : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                </div>
              </div>
              {!patientIdParam && (
                <button
                  type="button"
                  onClick={() => {
                    setPatient(null);
                    setPatientSearch('');
                  }}
                  className="text-sm font-medium text-lime-700 dark:text-lime-400 hover:underline"
                >
                  {t('lab.new.change')}
                </button>
              )}
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder={t('lab.new.searchPatient')}
                className={inputClass}
                autoFocus
              />
              {debouncedPatientSearch.trim().length >= 2 && (
                <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-64 overflow-y-auto">
                  {searchingPatients && patientResults.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{t('lab.loading')}</p>
                  ) : patientResults.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{t('lab.new.noPatients')}</p>
                  ) : (
                    patientResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPatient(p);
                          setErrors((prev) => ({ ...prev, patient: '' }));
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-lime-50 dark:hover:bg-gray-700"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {[p.patientId, p.phoneNumber].filter(Boolean).join(' • ')}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {errors.patient && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.patient}</p>}

          {!ownDoctorId && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.new.doctor')} *</label>
              <select
                value={doctorId}
                onChange={(e) => {
                  setDoctorId(e.target.value);
                  setErrors((prev) => ({ ...prev, doctor: '' }));
                }}
                className={inputClass}
              >
                <option value="">{t('lab.new.selectDoctor')}</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.firstName} {d.lastName}
                    {d.department ? ` — ${d.department}` : ''}
                  </option>
                ))}
              </select>
              {errors.doctor && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.doctor}</p>}
            </div>
          )}
        </section>

        {/* Tests */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('lab.new.tests')} *
              {selectedTestIds.length > 0 && (
                <span className="ml-2 text-sm font-normal text-lime-700 dark:text-lime-400">
                  {selectedTestIds.length === 1
                    ? t('lab.new.selectedCountOne')
                    : t('lab.new.selectedCount', { count: selectedTestIds.length })}
                </span>
              )}
            </h2>
            <input
              type="text"
              value={testFilter}
              onChange={(e) => setTestFilter(e.target.value)}
              placeholder={t('lab.new.searchTests')}
              className={`${inputClass} sm:max-w-xs`}
            />
          </div>

          {loadingTests ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-600"></div>
            </div>
          ) : tests.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('lab.new.noTestsInCatalog')}</p>
          ) : (
            <div className="space-y-5">
              {testsByCategory.map(([category, categoryTests]) => (
                <div key={category}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                    {categoryLabel(category)}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {categoryTests.map((test) => {
                      const selected = selectedTestIds.includes(test.id);
                      return (
                        <label
                          key={test.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selected
                              ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleTest(test.id)}
                            className="mt-1 w-4 h-4 text-lime-600 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{test.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {test.code} • {t('lab.detail.processingTime', { count: test.processingTime })}
                            </p>
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {formatCurrency(test.price)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {errors.tests && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{errors.tests}</p>}
          {selectedTestIds.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t('lab.new.estimatedTotal')}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedTotal)}</span>
            </div>
          )}
        </section>

        {/* Priority & notes */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('lab.new.priority')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    priority === p.value ? p.activeClass : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{tEnum(p.value)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t(p.hintKey)}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lab.new.notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t('lab.new.notesPlaceholder')}
              className={inputClass}
            />
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Link
            href={backHref}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('lab.new.cancel')}
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {submitting ? t('lab.new.submitting') : t('lab.new.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewLabOrderPage() {
  return (
    <Suspense fallback={null}>
      <NewLabOrderForm />
    </Suspense>
  );
}
