'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type AdmissionDetail, type AdmissionSource, type Doctor, type Patient, type Ward } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { freeBeds } from '@/lib/inpatient';
import { DialogShell, ErrorBox, cancelBtn, inputClass, labelClass, messageOf, primaryBtn } from './ui';

export const ADMISSION_SOURCES: AdmissionSource[] = ['EMERGENCY', 'OUTPATIENT', 'REFERRAL', 'ELECTIVE', 'BIRTH'];

/** The patient being admitted: from a page (known) or searched in the dialog */
export interface AdmitPatient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
}

function ageFrom(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export function useWards(active = true) {
  const [wards, setWards] = useState<Ward[] | null>(null);
  useEffect(() => {
    let live = true;
    api
      .getWards({ active })
      .then((board) => live && setWards(board.wards))
      .catch(() => live && setWards([]));
    return () => {
      live = false;
    };
  }, [active]);
  return wards;
}

/** Free beds grouped by ward; the ward's gender rule is respected */
export function BedPicker({
  id,
  wards,
  patientGender,
  value,
  onChange,
  excludeBedId,
  patientAge,
}: {
  id: string;
  wards: Ward[] | null;
  patientGender?: string | null;
  patientAge?: number | null;
  value: string;
  onChange: (bedId: string) => void;
  excludeBedId?: string;
}) {
  const { t, formatCurrency } = useLanguage();
  const options = useMemo(() => freeBeds(wards ?? [], patientGender, excludeBedId, patientAge), [wards, patientGender, excludeBedId, patientAge]);
  const byWard = useMemo(() => {
    const groups = new Map<string, { ward: Ward; beds: typeof options }>();
    for (const option of options) {
      const group = groups.get(option.ward.id) ?? { ward: option.ward, beds: [] };
      group.beds.push(option);
      groups.set(option.ward.id, group);
    }
    return [...groups.values()];
  }, [options]);

  if (wards === null) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>;
  if (options.length === 0) return <p className="text-sm text-amber-700 dark:text-amber-300">{t('inp.admit.noFreeBed')}</p>;
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">{t('inp.admit.chooseBed')}</option>
      {byWard.map(({ ward, beds }) => (
        <optgroup key={ward.id} label={`${ward.name} (${ward.code})`}>
          {beds.map(({ bed }) => (
            <option key={bed.id} value={bed.id}>
              {t('inp.bedLabel', { label: bed.label })} · {formatCurrency(bed.dailyRate ?? ward.dailyRate)}
              {t('inp.perDay')}
              {bed.status === 'RESERVED' ? ` · ${t('inp.bed.RESERVED')}` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function PatientSearch({ onPick }: { onPick: (p: Patient) => void }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const seq = useRef(0);
  const query = search.trim();

  useEffect(() => {
    if (query.length < 2) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      api
        .getPatients({ search: query, limit: 8 })
        .then((res) => mine === seq.current && setResults(res.data.filter((p) => !p.anonymizedAt)))
        .catch(() => mine === seq.current && setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative">
      <input
        id="admit-patient"
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('inp.admit.searchPatient')}
        className={inputClass}
      />
      {query.length >= 2 && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p)} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600">
                <span className="text-sm text-gray-900 dark:text-white">{p.firstName} {p.lastName}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{p.patientId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Admit a patient: from the bed board (bed known), the patient page (patient known) or the queue
 * (patient and ticket known). A doctor is the attending doctor by default.
 */
export function AdmissionDialog({
  patient: initialPatient,
  bedId: initialBedId,
  queueTicketId,
  defaultSource = 'OUTPATIENT',
  defaultReason = '',
  onClose,
  onAdmitted,
}: {
  patient?: AdmitPatient | null;
  bedId?: string;
  queueTicketId?: string;
  defaultSource?: AdmissionSource;
  defaultReason?: string;
  onClose: () => void;
  onAdmitted: (admission: AdmissionDetail) => void;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const wards = useWards();
  const [patient, setPatient] = useState<AdmitPatient | null>(initialPatient ?? null);
  const [bedId, setBedId] = useState(initialBedId ?? '');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState(user?.role === 'DOCTOR' && user.doctorId ? user.doctorId : '');
  const [source, setSource] = useState<AdmissionSource>(defaultSource);
  const [reason, setReason] = useState(defaultReason);
  const [diagnosis, setDiagnosis] = useState('');
  const [expected, setExpected] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getDoctors({ limit: 100 })
      .then((res) => setDoctors(res.data))
      .catch(() => setDoctors([]));
  }, []);

  // The patient fixed by the caller (or picked) may not suit a bed chosen on the board
  const preselectedBed = (() => {
    if (!initialBedId || !wards) return null;
    for (const ward of wards) {
      const bed = ward.beds.find((b) => b.id === initialBedId);
      if (bed) return { ward, bed };
    }
    return null;
  })();

  const submit = async () => {
    if (!patient) return setError(t('inp.admit.patientRequired'));
    if (!bedId) return setError(t('inp.admit.bedRequired'));
    if (!doctorId) return setError(t('inp.admit.doctorRequired'));
    if (!reason.trim()) return setError(t('inp.admit.reasonRequired'));
    setSaving(true);
    setError('');
    try {
      const admission = await api.createAdmission({
        patientId: patient.id,
        bedId,
        attendingDoctorId: doctorId,
        source,
        reason: reason.trim(),
        ...(diagnosis.trim() ? { provisionalDiagnosis: diagnosis.trim() } : {}),
        ...(expected ? { expectedDischargeAt: expected } : {}),
        ...(queueTicketId ? { queueTicketId } : {}),
      });
      onAdmitted(admission);
    } catch (err) {
      setError(messageOf(err, t('inp.actionFailed')));
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title={t('inp.admit.title')}
      subtitle={preselectedBed ? `${preselectedBed.ward.name} · ${t('inp.bedLabel', { label: preselectedBed.bed.label })}` : undefined}
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('inp.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('inp.admit.confirm')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="admit-patient">{t('inp.patient')}</label>
        {patient ? (
          <div className="flex items-center justify-between p-3 rounded-lg bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{patient.firstName} {patient.lastName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{patient.patientId}</p>
            </div>
            {!initialPatient && (
              <button type="button" onClick={() => setPatient(null)} className="text-sm text-lime-700 dark:text-lime-400 hover:underline">{t('inp.change')}</button>
            )}
          </div>
        ) : (
          <PatientSearch onPick={(p) => setPatient({ id: p.id, patientId: p.patientId, firstName: p.firstName, lastName: p.lastName, gender: p.gender, dateOfBirth: p.dateOfBirth })} />
        )}
      </div>

      <div>
        <label className={labelClass} htmlFor="admit-bed">{t('inp.bed')}</label>
        <BedPicker id="admit-bed" wards={wards} patientGender={patient?.gender} patientAge={patient?.age ?? ageFrom(patient?.dateOfBirth)} value={bedId} onChange={setBedId} />
        {preselectedBed && bedId === initialBedId && patient?.gender && preselectedBed.ward.gender !== 'ANY' && preselectedBed.ward.gender !== patient.gender && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{t('inp.admit.genderMismatch')}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="admit-doctor">{t('inp.attendingDoctor')}</label>
          <select id="admit-doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass}>
            <option value="">{t('inp.admit.chooseDoctor')}</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>Dr {d.firstName} {d.lastName}{d.department ? ` · ${d.department}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="admit-source">{t('inp.source')}</label>
          <select id="admit-source" value={source} onChange={(e) => setSource(e.target.value as AdmissionSource)} className={inputClass}>
            {ADMISSION_SOURCES.map((s) => (
              <option key={s} value={s}>{t(`inp.source.${s}`)}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="admit-reason">{t('inp.reason')}</label>
        <textarea id="admit-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('inp.admit.reasonPlaceholder')} className={inputClass} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="admit-diagnosis">{t('inp.provisionalDiagnosis')}</label>
          <input id="admit-diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="admit-expected">{t('inp.expectedDischarge')}</label>
          <input id="admit-expected" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} className={inputClass} />
        </div>
      </div>
    </DialogShell>
  );
}
