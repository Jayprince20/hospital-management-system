'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type CertificateKind, type CreateMedicalDocumentInput, type MedicalDocument, type MedicalDocumentType, type ReferralUrgency } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import {
  CERTIFICATE_KINDS,
  DOCUMENT_TYPES,
  LEAVE_DAY_CHIPS,
  URGENCIES,
  defaultCertificateValidity,
  formatCode,
  localDay,
  sickLeaveEnd,
  sickLeaveProblem,
} from '@/lib/medical-documents';
import { PatientPicker, type PickedPatient } from '@/components/pharmacy/patient-picker';
import { DialogShell, ErrorBox, PdfButtons, cancelBtn, inputClass, labelClass, messageOf, primaryBtn, useDocumentLabel } from './ui';

export interface DocumentPatient {
  id: string;
  patientId: string;
  name: string;
}

export interface DocumentPrefill {
  reason?: string;
  clinicalSummary?: string;
  investigations?: string;
  currentTreatment?: string;
}

/** Conclusions offered per certificate kind (translation keys); the doctor can edit them */
const CONCLUSION_SUGGESTIONS: Record<CertificateKind, string[]> = {
  GOOD_HEALTH: ['mdoc.cert.suggest.goodHealth'],
  FITNESS: ['mdoc.cert.suggest.fit', 'mdoc.cert.suggest.fitWithLimits', 'mdoc.cert.suggest.unfit'],
  SPORT: ['mdoc.cert.suggest.sportLeisure', 'mdoc.cert.suggest.sportCompetition'],
  INJURY_REPORT: ['mdoc.cert.suggest.injury'],
  OTHER: [],
};

function Textarea({ id, label, value, onChange, rows = 3, required = false, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number; required?: boolean; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

/**
 * Issue a sick leave, a certificate or a referral letter (outgoing), or record a referral received
 * from another facility (incoming). Doctors issue as themselves; an admin picks the doctor.
 */
export function NewDocumentDialog({
  patient: givenPatient = null,
  initialType = 'SICK_LEAVE',
  incoming = false,
  consultationId,
  admissionId,
  prefill,
  onClose,
  onIssued,
}: {
  patient?: DocumentPatient | null;
  initialType?: MedicalDocumentType;
  /** Record a referral received from another facility */
  incoming?: boolean;
  consultationId?: string;
  admissionId?: string;
  prefill?: DocumentPrefill;
  onClose: () => void;
  onIssued?: (doc: MedicalDocument) => void;
}) {
  const { t, formatDate } = useLanguage();
  const { user } = useAuth();
  const label = useDocumentLabel();
  const isAdmin = user?.role === 'ADMIN';
  const today = localDay();

  const [patient, setPatient] = useState<DocumentPatient | null>(givenPatient);
  const [type, setType] = useState<MedicalDocumentType>(incoming ? 'REFERRAL' : initialType);
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>([]);

  // Sick leave
  const [validFrom, setValidFrom] = useState(today);
  const [leaveDays, setLeaveDays] = useState('3');
  const [leaveKind, setLeaveKind] = useState<'INITIAL' | 'EXTENSION'>('INITIAL');
  const [outingsAllowed, setOutingsAllowed] = useState(true);
  const [leaveReason, setLeaveReason] = useState(prefill?.reason ?? '');

  // Certificate
  const [kind, setKind] = useState<CertificateKind>('GOOD_HEALTH');
  const [purpose, setPurpose] = useState('');
  const [findings, setFindings] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [ittDays, setIttDays] = useState('');
  const [certValidUntil, setCertValidUntil] = useState('');

  // Referral
  const [urgency, setUrgency] = useState<ReferralUrgency>('ROUTINE');
  const [toFacility, setToFacility] = useState('');
  const [toSpecialty, setToSpecialty] = useState('');
  const [toDoctor, setToDoctor] = useState('');
  const [fromFacility, setFromFacility] = useState('');
  const [fromDoctor, setFromDoctor] = useState('');
  const [reason, setReason] = useState(prefill?.reason ?? '');
  const [clinicalSummary, setClinicalSummary] = useState(prefill?.clinicalSummary ?? '');
  const [investigations, setInvestigations] = useState(prefill?.investigations ?? '');
  const [currentTreatment, setCurrentTreatment] = useState(prefill?.currentTreatment ?? '');
  const [question, setQuestion] = useState('');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<MedicalDocument | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let live = true;
    api
      .getDoctors({ limit: 100 })
      .then((res) => live && setDoctors(res.data.map((d) => ({ id: d.id, name: `Dr ${d.firstName} ${d.lastName}` }))))
      .catch(() => live && setDoctors([]));
    return () => {
      live = false;
    };
  }, [isAdmin]);

  const days = Number(leaveDays);
  const leaveEnd = sickLeaveEnd(validFrom, days);

  const chooseKind = (next: CertificateKind) => {
    setKind(next);
    setCertValidUntil(defaultCertificateValidity(next, today));
    setConclusion('');
  };

  const suggestions = useMemo(() => CONCLUSION_SUGGESTIONS[kind], [kind]);

  const check = (): string | null => {
    if (!patient) return t('mdoc.form.patientRequired');
    if (isAdmin && !doctorId) return t('mdoc.form.doctorRequired');
    if (type === 'SICK_LEAVE') {
      const problem = sickLeaveProblem(validFrom, days, today);
      if (problem) return t(`mdoc.leave.problem.${problem}`);
    }
    if (type === 'MEDICAL_CERTIFICATE') {
      if (!purpose.trim()) return t('mdoc.cert.purposeRequired');
      if (kind === 'INJURY_REPORT' && !findings.trim()) return t('mdoc.cert.findingsRequired');
      if (!conclusion.trim()) return t('mdoc.cert.conclusionRequired');
      if (ittDays && (!Number.isInteger(Number(ittDays)) || Number(ittDays) < 0)) return t('mdoc.cert.ittInvalid');
    }
    if (type === 'REFERRAL') {
      if (incoming && !fromFacility.trim()) return t('mdoc.ref.fromRequired');
      if (!incoming && !toFacility.trim()) return t('mdoc.ref.toRequired');
      if (!reason.trim()) return t('mdoc.ref.reasonRequired');
      if (!incoming && !clinicalSummary.trim()) return t('mdoc.ref.summaryRequired');
    }
    return null;
  };

  const opt = (v: string) => (v.trim() ? v.trim() : undefined);

  const submit = async () => {
    const problem = check();
    if (problem) return setError(problem);
    setError('');
    setSaving(true);
    const body: CreateMedicalDocumentInput = {
      type,
      patientId: patient!.id,
      ...(isAdmin && doctorId ? { doctorId } : {}),
      ...(consultationId ? { consultationId } : {}),
      ...(admissionId ? { admissionId } : {}),
    };
    if (type === 'SICK_LEAVE') {
      Object.assign(body, { validFrom, leaveDays: days, leaveKind, outingsAllowed, reason: opt(leaveReason) });
    } else if (type === 'MEDICAL_CERTIFICATE') {
      Object.assign(body, {
        certificateKind: kind,
        purpose: purpose.trim(),
        findings: opt(findings),
        conclusion: conclusion.trim(),
        ...(certValidUntil ? { validUntil: certValidUntil } : {}),
        ...(kind === 'INJURY_REPORT' && ittDays ? { leaveDays: Number(ittDays) } : {}),
      });
    } else if (incoming) {
      Object.assign(body, {
        direction: 'INCOMING',
        urgency,
        fromFacility: fromFacility.trim(),
        fromDoctor: opt(fromDoctor),
        reason: reason.trim(),
        clinicalSummary: opt(clinicalSummary),
      });
    } else {
      Object.assign(body, {
        direction: 'OUTGOING',
        urgency,
        toFacility: toFacility.trim(),
        toSpecialty: opt(toSpecialty),
        toDoctor: opt(toDoctor),
        reason: reason.trim(),
        clinicalSummary: clinicalSummary.trim(),
        investigations: opt(investigations),
        currentTreatment: opt(currentTreatment),
        question: opt(question),
      });
    }
    try {
      const doc = await api.createMedicalDocument(body);
      setIssued(doc);
      onIssued?.(doc);
    } catch (err) {
      setError(messageOf(err, t('mdoc.actionFailed')));
    } finally {
      setSaving(false);
    }
  };

  if (issued) {
    return (
      <DialogShell
        title={incoming ? t('mdoc.issued.incomingTitle') : t('mdoc.issued.title', { label: label(issued) })}
        onClose={onClose}
        footer={<button type="button" onClick={onClose} className={primaryBtn}>{t('mdoc.close')}</button>}
      >
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('mdoc.issued.number', { number: issued.number })}</p>
          {!incoming && (
            <>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('mdoc.issued.code')}</p>
              <p className="text-2xl font-mono font-bold text-gray-900 dark:text-white">{formatCode(issued.verificationCode)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('mdoc.issued.codeHelp')}</p>
            </>
          )}
          {issued.type === 'SICK_LEAVE' && issued.validFrom && issued.validUntil && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('mdoc.leave.period', { from: formatDate(issued.validFrom), to: formatDate(issued.validUntil), days: issued.leaveDays ?? 0 })}
            </p>
          )}
          <div className="pt-2 flex justify-center">
            <PdfButtons doc={issued} />
          </div>
        </div>
      </DialogShell>
    );
  }

  const title = incoming ? t('mdoc.new.incomingTitle') : t('mdoc.new.title');

  return (
    <DialogShell
      title={title}
      subtitle={patient ? `${patient.name} · ${patient.patientId}` : undefined}
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('mdoc.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>
            {saving ? t('mdoc.saving') : incoming ? t('mdoc.new.record') : t('mdoc.new.issue')}
          </button>
        </>
      }
    >
      {!givenPatient && (
        <div>
          <span className={labelClass}>{t('mdoc.form.patient')}</span>
          {patient ? (
            <div className="flex items-center justify-between rounded-lg bg-lime-50 dark:bg-lime-900/20 px-3 py-2">
              <span className="text-sm text-gray-900 dark:text-white">{patient.name} · {patient.patientId}</span>
              <button type="button" onClick={() => setPatient(null)} className="text-sm text-lime-700 dark:text-lime-400 hover:underline">{t('mdoc.change')}</button>
            </div>
          ) : (
            <PatientPicker onPick={(p: PickedPatient) => setPatient({ id: p.id, patientId: p.patientId, name: p.name })} />
          )}
        </div>
      )}

      {!incoming && (
        <div role="radiogroup" aria-label={t('mdoc.form.type')} className="grid grid-cols-3 gap-2">
          {DOCUMENT_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => setType(value)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium ${type === value ? 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
            >
              {t(`mdoc.type.${value}`)}
            </button>
          ))}
        </div>
      )}

      {isAdmin && (
        <div>
          <label htmlFor="mdoc-doctor" className={labelClass}>{incoming ? t('mdoc.form.receivingDoctor') : t('mdoc.form.doctor')}<span className="text-red-500"> *</span></label>
          <select id="mdoc-doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass}>
            <option value="">{t('mdoc.form.chooseDoctor')}</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      {type === 'SICK_LEAVE' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="mdoc-from" className={labelClass}>{t('mdoc.leave.start')}</label>
              <input id="mdoc-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="mdoc-days" className={labelClass}>{t('mdoc.leave.days')}</label>
              <input id="mdoc-days" type="number" min={1} max={90} value={leaveDays} onChange={(e) => setLeaveDays(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LEAVE_DAY_CHIPS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLeaveDays(String(n))}
                className={`px-2.5 py-1 rounded-full text-xs border ${days === n ? 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
              >
                {t('mdoc.leave.chip', { count: n })}
              </button>
            ))}
          </div>
          {leaveEnd && (
            <p className="text-sm text-gray-700 dark:text-gray-300">{t('mdoc.leave.until', { date: formatDate(leaveEnd) })}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className={labelClass}>{t('mdoc.leave.kind')}</span>
              <div className="flex gap-2">
                {(['INITIAL', 'EXTENSION'] as const).map((k) => (
                  <label key={k} className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                    <input type="radio" name="mdoc-leave-kind" checked={leaveKind === k} onChange={() => setLeaveKind(k)} />
                    {t(`mdoc.leave.kind.${k}`)}
                  </label>
                ))}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 self-end">
              <input type="checkbox" checked={outingsAllowed} onChange={(e) => setOutingsAllowed(e.target.checked)} />
              {t('mdoc.leave.outings')}
            </label>
          </div>
          <Textarea id="mdoc-leave-reason" label={t('mdoc.leave.reason')} value={leaveReason} onChange={setLeaveReason} rows={2} hint={t('mdoc.leave.reasonHint')} />
        </div>
      )}

      {type === 'MEDICAL_CERTIFICATE' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="mdoc-kind" className={labelClass}>{t('mdoc.cert.kind')}</label>
            <select id="mdoc-kind" value={kind} onChange={(e) => chooseKind(e.target.value as CertificateKind)} className={inputClass}>
              {CERTIFICATE_KINDS.map((k) => (
                <option key={k} value={k}>{t(`mdoc.kind.${k}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mdoc-purpose" className={labelClass}>{t('mdoc.cert.purpose')}<span className="text-red-500"> *</span></label>
            <input id="mdoc-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('mdoc.cert.purposePlaceholder')} className={inputClass} />
          </div>
          <Textarea id="mdoc-findings" label={t('mdoc.cert.findings')} value={findings} onChange={setFindings} required={kind === 'INJURY_REPORT'} />
          <div>
            <Textarea id="mdoc-conclusion" label={t('mdoc.cert.conclusion')} value={conclusion} onChange={setConclusion} rows={2} required />
            {suggestions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestions.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setConclusion(t(key, { days: ittDays || '…' }))}
                    className="px-2 py-1 rounded-md text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                  >
                    {t(key, { days: ittDays || '…' })}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {kind === 'INJURY_REPORT' && (
              <div>
                <label htmlFor="mdoc-itt" className={labelClass}>{t('mdoc.cert.itt')}</label>
                <input id="mdoc-itt" type="number" min={0} value={ittDays} onChange={(e) => setIttDays(e.target.value)} className={inputClass} />
              </div>
            )}
            <div>
              <label htmlFor="mdoc-valid" className={labelClass}>{t('mdoc.cert.validUntil')}</label>
              <input id="mdoc-valid" type="date" value={certValidUntil} min={today} onChange={(e) => setCertValidUntil(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
      )}

      {type === 'REFERRAL' && (
        <div className="space-y-4">
          <div>
            <span className={labelClass}>{t('mdoc.ref.urgency')}</span>
            <div className="flex flex-wrap gap-2">
              {URGENCIES.map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={urgency === u}
                  onClick={() => setUrgency(u)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${urgency === u ? (u === 'EMERGENCY' ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300') : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
                >
                  {t(`mdoc.urgency.${u}`)}
                </button>
              ))}
            </div>
          </div>
          {incoming ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="mdoc-from-facility" className={labelClass}>{t('mdoc.ref.fromFacility')}<span className="text-red-500"> *</span></label>
                <input id="mdoc-from-facility" value={fromFacility} onChange={(e) => setFromFacility(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="mdoc-from-doctor" className={labelClass}>{t('mdoc.ref.fromDoctor')}</label>
                <input id="mdoc-from-doctor" value={fromDoctor} onChange={(e) => setFromDoctor(e.target.value)} className={inputClass} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <label htmlFor="mdoc-to-facility" className={labelClass}>{t('mdoc.ref.toFacility')}<span className="text-red-500"> *</span></label>
                <input id="mdoc-to-facility" value={toFacility} onChange={(e) => setToFacility(e.target.value)} placeholder={t('mdoc.ref.toFacilityPlaceholder')} className={inputClass} />
              </div>
              <div>
                <label htmlFor="mdoc-to-specialty" className={labelClass}>{t('mdoc.ref.toSpecialty')}</label>
                <input id="mdoc-to-specialty" value={toSpecialty} onChange={(e) => setToSpecialty(e.target.value)} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="mdoc-to-doctor" className={labelClass}>{t('mdoc.ref.toDoctor')}</label>
                <input id="mdoc-to-doctor" value={toDoctor} onChange={(e) => setToDoctor(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
          <Textarea id="mdoc-reason" label={t('mdoc.ref.reason')} value={reason} onChange={setReason} rows={2} required />
          <Textarea id="mdoc-summary" label={t('mdoc.ref.summary')} value={clinicalSummary} onChange={setClinicalSummary} rows={4} required={!incoming} />
          {!incoming && (
            <>
              <Textarea id="mdoc-investigations" label={t('mdoc.ref.investigations')} value={investigations} onChange={setInvestigations} rows={2} />
              <Textarea id="mdoc-treatment" label={t('mdoc.ref.treatment')} value={currentTreatment} onChange={setCurrentTreatment} rows={2} />
              <Textarea id="mdoc-question" label={t('mdoc.ref.question')} value={question} onChange={setQuestion} rows={2} />
            </>
          )}
        </div>
      )}

      <ErrorBox message={error} />
    </DialogShell>
  );
}
