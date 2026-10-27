'use client';

import { useEffect, useRef, useState } from 'react';
import {
  api,
  ApiError,
  type AdministrationStatus,
  type AdmissionDetail,
  type ChargeCategory,
  type Department,
  type DischargeType,
  type Medication,
  type MedicationOrder,
  type MedicationRoute,
  type Ward,
  type WardGender,
  type WardType,
} from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { ADMINISTRATION_STATUSES, MAX_TIMES, MEDICATION_ROUTES, TIME_PRESETS, addTime, localDay, needsReason, parseBedLabels, parseTime } from '@/lib/inpatient';
import { BedPicker, useWards } from './admission-dialog';
import { DialogShell, ErrorBox, cancelBtn, dangerBtn, inputClass, labelClass, messageOf, primaryBtn } from './ui';

function useSaving() {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const run = async (fn: () => Promise<void>, fallback: string) => {
    setSaving(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(messageOf(err, fallback));
      setSaving(false);
    }
  };
  return { error, setError, saving, setSaving, run };
}

export function TransferDialog({ admission, onClose, onDone }: { admission: AdmissionDetail; onClose: () => void; onDone: (a: AdmissionDetail) => void }) {
  const { t } = useLanguage();
  const wards = useWards();
  const [bedId, setBedId] = useState('');
  const [reason, setReason] = useState('');
  const { error, setError, saving, run } = useSaving();

  const submit = () => {
    if (!bedId) return setError(t('inp.admit.bedRequired'));
    if (!reason.trim()) return setError(t('inp.transfer.reasonRequired'));
    run(async () => onDone(await api.transferAdmission(admission.id, { bedId, reason: reason.trim() })), t('inp.actionFailed'));
  };

  return (
    <DialogShell
      title={t('inp.transfer.title')}
      subtitle={`${admission.ward.name}${admission.bed ? ` · ${t('inp.bedLabel', { label: admission.bed.label })}` : ''}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('inp.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('inp.transfer.confirm')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="transfer-bed">{t('inp.transfer.newBed')}</label>
        <BedPicker id="transfer-bed" wards={wards} patientGender={admission.patient.gender} patientAge={admission.patient.age} value={bedId} onChange={setBedId} excludeBedId={admission.bed?.id} />
      </div>
      <div>
        <label className={labelClass} htmlFor="transfer-reason">{t('inp.transfer.reason')}</label>
        <textarea id="transfer-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('inp.transfer.hint')}</p>
    </DialogShell>
  );
}

export const DISCHARGE_TYPES: DischargeType[] = ['HOME', 'TRANSFER', 'AGAINST_ADVICE', 'DECEASED'];

export function DischargeDialog({ admission, onClose, onDone }: { admission: AdmissionDetail; onClose: () => void; onDone: (a: AdmissionDetail) => void }) {
  const { t } = useLanguage();
  const [type, setType] = useState<DischargeType>('HOME');
  const [finalDiagnosis, setFinalDiagnosis] = useState(admission.provisionalDiagnosis ?? '');
  const [codes, setCodes] = useState('');
  const [course, setCourse] = useState('');
  const [medications, setMedications] = useState('');
  const [instructions, setInstructions] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [destination, setDestination] = useState('');
  const { error, setError, saving, run } = useSaving();

  const submit = () => {
    if (!finalDiagnosis.trim()) return setError(t('inp.discharge.diagnosisRequired'));
    if (!course.trim()) return setError(t('inp.discharge.courseRequired'));
    if (type === 'TRANSFER' && !destination.trim()) return setError(t('inp.discharge.destinationRequired'));
    const diagnosisCodes = codes.split(/[,;\s]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
    run(
      async () =>
        onDone(
          await api.dischargeAdmission(admission.id, {
            dischargeType: type,
            finalDiagnosis: finalDiagnosis.trim(),
            hospitalCourse: course.trim(),
            ...(diagnosisCodes.length ? { diagnosisCodes } : {}),
            ...(medications.trim() ? { dischargeMedications: medications.trim() } : {}),
            ...(instructions.trim() ? { dischargeInstructions: instructions.trim() } : {}),
            ...(followUp ? { followUpDate: followUp } : {}),
            ...(type === 'TRANSFER' ? { transferDestination: destination.trim() } : {}),
          })
        ),
      t('inp.actionFailed')
    );
  };

  return (
    <DialogShell
      title={t('inp.discharge.title')}
      subtitle={`${admission.patient.firstName} ${admission.patient.lastName} · ${admission.number}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('inp.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('inp.discharge.confirm')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <fieldset>
        <legend className={labelClass}>{t('inp.discharge.type')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {DISCHARGE_TYPES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setType(d)}
              aria-pressed={type === d}
              className={`px-3 py-2 rounded-lg border text-sm ${type === d ? 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-200' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
            >
              {t(`inp.dischargeType.${d}`)}
            </button>
          ))}
        </div>
      </fieldset>
      {type === 'TRANSFER' && (
        <div>
          <label className={labelClass} htmlFor="dis-destination">{t('inp.discharge.destination')}</label>
          <input id="dis-destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={t('inp.discharge.destinationPlaceholder')} className={inputClass} />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="dis-diagnosis">{t('inp.discharge.finalDiagnosis')}</label>
          <input id="dis-diagnosis" value={finalDiagnosis} onChange={(e) => setFinalDiagnosis(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="dis-codes">{t('inp.discharge.codes')}</label>
          <input id="dis-codes" value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="J18.9, E11" className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="dis-course">{t('inp.discharge.course')}</label>
        <textarea id="dis-course" rows={4} value={course} onChange={(e) => setCourse(e.target.value)} placeholder={t('inp.discharge.coursePlaceholder')} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="dis-meds">{t('inp.discharge.medications')}</label>
        <textarea id="dis-meds" rows={2} value={medications} onChange={(e) => setMedications(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="dis-instructions">{t('inp.discharge.instructions')}</label>
        <textarea id="dis-instructions" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} className={inputClass} />
      </div>
      {type !== 'DECEASED' && (
        <div className="sm:w-1/2">
          <label className={labelClass} htmlFor="dis-followup">{t('inp.discharge.followUp')}</label>
          <input id="dis-followup" type="date" min={localDay()} value={followUp} onChange={(e) => setFollowUp(e.target.value)} className={inputClass} />
        </div>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('inp.discharge.hint')}</p>
    </DialogShell>
  );
}

/** One free-text reason: cancel an admission, stop an order */
export function ReasonDialog({
  title,
  label,
  confirmLabel,
  danger = false,
  onClose,
  onConfirm,
}: {
  title: string;
  label: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const { error, setError, saving, run } = useSaving();
  const submit = () => {
    if (!reason.trim()) return setError(t('inp.reasonRequired'));
    run(() => onConfirm(reason.trim()), t('inp.actionFailed'));
  };
  return (
    <DialogShell
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('inp.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={danger ? dangerBtn : primaryBtn}>{confirmLabel}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="reason-text">{label}</label>
        <textarea id="reason-text" autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}

/** Record one dose: given, refused, held or not given (a reason unless given) */
export function RecordDoseDialog({
  title,
  subtitle,
  defaultDose,
  initialStatus = 'GIVEN',
  onClose,
  onConfirm,
}: {
  title: string;
  subtitle?: string;
  defaultDose: string;
  initialStatus?: AdministrationStatus;
  onClose: () => void;
  onConfirm: (data: { status: AdministrationStatus; doseGiven?: string; reason?: string }) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<AdministrationStatus>(initialStatus);
  const [dose, setDose] = useState(defaultDose);
  const [reason, setReason] = useState('');
  const { error, setError, saving, run } = useSaving();

  const submit = () => {
    if (needsReason(status) && !reason.trim()) return setError(t('inp.mar.reasonRequired'));
    run(
      () =>
        onConfirm({
          status,
          ...(status === 'GIVEN' && dose.trim() ? { doseGiven: dose.trim() } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      t('inp.actionFailed')
    );
  };

  return (
    <DialogShell
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('inp.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('inp.mar.save')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="grid grid-cols-2 gap-2">
        {ADMINISTRATION_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={`px-3 py-2 rounded-lg border text-sm font-medium ${status === s ? 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-200' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
          >
            {t(`inp.admin.${s}`)}
          </button>
        ))}
      </div>
      {status === 'GIVEN' ? (
        <div>
          <label className={labelClass} htmlFor="dose-given">{t('inp.mar.doseGiven')}</label>
          <input id="dose-given" value={dose} onChange={(e) => setDose(e.target.value)} className={inputClass} />
        </div>
      ) : null}
      <div>
        <label className={labelClass} htmlFor="dose-reason">{needsReason(status) ? t('inp.mar.reason') : t('inp.mar.comment')}</label>
        <textarea id="dose-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}

function MedicationSearch({ onPick }: { onPick: (m: Medication) => void }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Medication[]>([]);
  const seq = useRef(0);
  const query = search.trim();

  useEffect(() => {
    if (query.length < 2) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      api
        .getMedications({ search: query, isActive: true, limit: 8 })
        .then((res) => mine === seq.current && setResults(res.medications))
        .catch(() => mine === seq.current && setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative">
      <input id="order-med-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('inp.order.searchCatalogue')} className={inputClass} />
      {query.length >= 2 && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(m);
                  setSearch('');
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <span className="text-sm text-gray-900 dark:text-white">{m.name} {m.strength}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{m.genericName} · {m.dosageForm}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A doctor prescribes a ward medication: catalogue drug or free text, dose, route, schedule */
export function NewOrderDialog({ admission, onClose, onDone }: { admission: AdmissionDetail; onClose: () => void; onDone: (o: MedicationOrder) => void }) {
  const { t } = useLanguage();
  const [medication, setMedication] = useState<Medication | null>(null);
  const [drugName, setDrugName] = useState('');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState<MedicationRoute>('PO');
  const [times, setTimes] = useState<string[]>(['08:00', '20:00']);
  const [timeInput, setTimeInput] = useState('');
  const [asNeeded, setAsNeeded] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [instructions, setInstructions] = useState('');
  const [allergy, setAllergy] = useState<string | null>(null);
  const [allergyReason, setAllergyReason] = useState('');
  const { error, setError, saving, setSaving, run } = useSaving();

  const addTypedTime = () => {
    const parsed = parseTime(timeInput);
    if (!parsed) return setError(t('inp.order.badTime'));
    if (times.length >= MAX_TIMES) return setError(t('inp.order.tooManyTimes', { max: MAX_TIMES }));
    setError('');
    setTimes((prev) => addTime(prev, parsed));
    setTimeInput('');
  };

  const submit = () => {
    if (!medication && !drugName.trim()) return setError(t('inp.order.drugRequired'));
    if (!dose.trim()) return setError(t('inp.order.doseRequired'));
    if (!asNeeded && times.length === 0) return setError(t('inp.order.timesRequired'));
    if (allergy && !allergyReason.trim()) return setError(t('inp.order.allergyReasonRequired'));
    run(async () => {
      try {
        const order = await api.createMedicationOrder(admission.id, {
          ...(medication ? { medicationId: medication.id } : { drugName: drugName.trim() }),
          dose: dose.trim(),
          route,
          asNeeded,
          ...(asNeeded ? {} : { times }),
          ...(startAt ? { startAt: new Date(startAt).toISOString() } : {}),
          ...(endAt ? { endAt: new Date(endAt).toISOString() } : {}),
          ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
          ...(allergy ? { overrideAllergy: true, allergyOverrideReason: allergyReason.trim() } : {}),
        });
        onDone(order);
      } catch (err) {
        // The server refuses a drug the patient is allergic to unless the doctor confirms with a reason
        if (err instanceof ApiError && err.status === 409 && /allerg/i.test(err.message) && !allergy) {
          // The red confirmation box says it all: no second error line
          setAllergy(err.message);
          setSaving(false);
          return;
        }
        throw err;
      }
    }, t('inp.actionFailed'));
  };

  return (
    <DialogShell
      title={t('inp.order.title')}
      subtitle={admission.patient.allergies.length ? t('inp.allergiesList', { list: admission.patient.allergies.join(', ') }) : t('inp.noKnownAllergy')}
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('inp.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={allergy ? dangerBtn : primaryBtn}>
            {allergy ? t('inp.order.confirmDespiteAllergy') : t('inp.order.confirm')}
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      {allergy && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/30 dark:border-red-700 space-y-2">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{allergy}</p>
          <label className={labelClass} htmlFor="order-allergy-reason">{t('inp.order.allergyReason')}</label>
          <textarea id="order-allergy-reason" rows={2} value={allergyReason} onChange={(e) => setAllergyReason(e.target.value)} className={inputClass} />
        </div>
      )}
      <div>
        <label className={labelClass} htmlFor="order-med-search">{t('inp.order.drug')}</label>
        {medication ? (
          <div className="flex items-center justify-between p-3 rounded-lg bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{medication.name} {medication.strength}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{medication.genericName} · {t('inp.order.inStock', { count: medication.stockQuantity })}</p>
            </div>
            <button type="button" onClick={() => { setMedication(null); setAllergy(null); }} className="text-sm text-lime-700 dark:text-lime-400 hover:underline">{t('inp.change')}</button>
          </div>
        ) : (
          <div className="space-y-2">
            <MedicationSearch onPick={(m) => { setMedication(m); setAllergy(null); }} />
            <input
              aria-label={t('inp.order.freeText')}
              value={drugName}
              onChange={(e) => { setDrugName(e.target.value); setAllergy(null); }}
              placeholder={t('inp.order.freeText')}
              className={inputClass}
            />
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="order-dose">{t('inp.order.dose')}</label>
          <input id="order-dose" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="1 g" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="order-route">{t('inp.order.route')}</label>
          <select id="order-route" value={route} onChange={(e) => setRoute(e.target.value as MedicationRoute)} className={inputClass}>
            {MEDICATION_ROUTES.map((r) => (
              <option key={r} value={r}>{t(`inp.route.${r}`)}</option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={asNeeded} onChange={(e) => setAsNeeded(e.target.checked)} />
        {t('inp.order.asNeeded')}
      </label>
      {!asNeeded && (
        <div>
          <span className={labelClass}>{t('inp.order.times')}</span>
          <div className="flex flex-wrap gap-2 mb-2">
            {TIME_PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => setTimes([...p.times].sort())} className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                {t(`inp.order.preset.${p.key}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {times.map((time) => (
              <span key={time} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 text-sm tabular-nums">
                {time}
                <button type="button" aria-label={t('inp.order.removeTime', { time })} onClick={() => setTimes((prev) => prev.filter((x) => x !== time))} className="ml-0.5 hover:text-red-600">×</button>
              </span>
            ))}
            <input
              aria-label={t('inp.order.addTime')}
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTypedTime();
                }
              }}
              placeholder="14:00"
              className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
            <button type="button" onClick={addTypedTime} className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{t('inp.order.addTime')}</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="order-start">{t('inp.order.start')}</label>
          <input id="order-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={inputClass} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('inp.order.startHint')}</p>
        </div>
        <div>
          <label className={labelClass} htmlFor="order-end">{t('inp.order.end')}</label>
          <input id="order-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="order-instructions">{t('inp.order.instructions')}</label>
        <textarea id="order-instructions" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}

export const CHARGE_CATEGORIES: Array<Exclude<ChargeCategory, 'BED'>> = ['PROCEDURE', 'MEDICATION', 'LAB', 'CONSUMABLE', 'OTHER'];

export function AddChargeDialog({ admissionId, onClose, onDone }: { admissionId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<Exclude<ChargeCategory, 'BED'>>('PROCEDURE');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const { error, setError, saving, run } = useSaving();

  const submit = () => {
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!description.trim()) return setError(t('inp.charge.descriptionRequired'));
    if (!Number.isInteger(qty) || qty < 1) return setError(t('inp.charge.badQuantity'));
    if (!Number.isFinite(price) || price <= 0) return setError(t('inp.charge.badPrice'));
    run(async () => {
      await api.addAdmissionCharge(admissionId, { category, description: description.trim(), quantity: qty, unitPrice: price });
      onDone();
    }, t('inp.actionFailed'));
  };

  return (
    <DialogShell
      title={t('inp.charge.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('inp.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('inp.charge.confirm')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="charge-category">{t('inp.charge.category')}</label>
        <select id="charge-category" value={category} onChange={(e) => setCategory(e.target.value as Exclude<ChargeCategory, 'BED'>)} className={inputClass}>
          {CHARGE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(`inp.chargeCategory.${c}`)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="charge-description">{t('inp.charge.description')}</label>
        <input id="charge-description" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="charge-qty">{t('inp.charge.quantity')}</label>
          <input id="charge-qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="charge-price">{t('inp.charge.unitPrice')}</label>
          <input id="charge-price" type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={inputClass} />
        </div>
      </div>
    </DialogShell>
  );
}

export const WARD_TYPES: WardType[] = ['GENERAL', 'SURGICAL', 'MATERNITY', 'PAEDIATRIC', 'ICU', 'ISOLATION'];
export const WARD_GENDERS: WardGender[] = ['ANY', 'MALE', 'FEMALE'];

/** Admin: create a ward (with its first beds) or edit one */
export function WardDialog({ ward, onClose, onDone }: { ward: Ward | null; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState(ward?.name ?? '');
  const [code, setCode] = useState(ward?.code ?? '');
  const [type, setType] = useState<WardType>(ward?.type ?? 'GENERAL');
  const [gender, setGender] = useState<WardGender>(ward?.gender ?? 'ANY');
  const [departmentId, setDepartmentId] = useState(ward?.department?.id ?? '');
  const [floor, setFloor] = useState(ward?.floor ?? '');
  const [dailyRate, setDailyRate] = useState(ward ? String(ward.dailyRate) : '');
  const [beds, setBeds] = useState('');
  const [notes, setNotes] = useState(ward?.notes ?? '');
  const { error, setError, saving, run } = useSaving();

  useEffect(() => {
    api
      .getDepartments({ isActive: true, limit: 100 })
      .then((res) => setDepartments(res.departments))
      .catch(() => setDepartments([]));
  }, []);

  const submit = () => {
    const rate = Number(dailyRate);
    if (!name.trim() || !code.trim()) return setError(t('inp.ward.nameRequired'));
    if (!Number.isFinite(rate) || rate < 0 || dailyRate === '') return setError(t('inp.ward.rateRequired'));
    const data = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      type,
      gender,
      departmentId: departmentId || null,
      floor: floor.trim() || null,
      dailyRate: rate,
      notes: notes.trim() || null,
    };
    run(async () => {
      if (ward) {
        await api.updateWard(ward.id, data);
      } else {
        const labels = parseBedLabels(beds);
        await api.createWard({ ...data, ...(labels.length ? { beds: labels } : {}) });
      }
      onDone();
    }, t('inp.actionFailed'));
  };

  return (
    <DialogShell
      title={ward ? t('inp.ward.editTitle', { name: ward.name }) : t('inp.ward.newTitle')}
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('inp.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('inp.save')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="ward-name">{t('inp.ward.name')}</label>
          <input id="ward-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ward-code">{t('inp.ward.code')}</label>
          <input id="ward-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="MED-H" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass} htmlFor="ward-type">{t('inp.ward.type')}</label>
          <select id="ward-type" value={type} onChange={(e) => setType(e.target.value as WardType)} className={inputClass}>
            {WARD_TYPES.map((w) => <option key={w} value={w}>{t(`inp.wardType.${w}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="ward-gender">{t('inp.ward.gender')}</label>
          <select id="ward-gender" value={gender} onChange={(e) => setGender(e.target.value as WardGender)} className={inputClass}>
            {WARD_GENDERS.map((g) => <option key={g} value={g}>{t(`inp.wardGender.${g}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="ward-rate">{t('inp.ward.dailyRate')}</label>
          <input id="ward-rate" type="number" min={0} value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="ward-dept">{t('inp.ward.department')}</label>
          <select id="ward-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputClass}>
            <option value="">{t('inp.ward.noDepartment')}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="ward-floor">{t('inp.ward.floor')}</label>
          <input id="ward-floor" value={floor} onChange={(e) => setFloor(e.target.value)} className={inputClass} />
        </div>
      </div>
      {!ward && (
        <div>
          <label className={labelClass} htmlFor="ward-beds">{t('inp.ward.beds')}</label>
          <input id="ward-beds" value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="1-8" className={inputClass} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('inp.ward.bedsHint')}</p>
        </div>
      )}
      <div>
        <label className={labelClass} htmlFor="ward-notes">{t('inp.ward.notes')}</label>
        <textarea id="ward-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </div>
    </DialogShell>
  );
}

export function AddBedsDialog({ ward, onClose, onDone }: { ward: Ward; onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage();
  const [labels, setLabels] = useState('');
  const [rate, setRate] = useState('');
  const { error, setError, saving, run } = useSaving();

  const submit = () => {
    const parsed = parseBedLabels(labels);
    if (parsed.length === 0) return setError(t('inp.ward.bedsRequired'));
    const dailyRate = rate === '' ? undefined : Number(rate);
    if (dailyRate !== undefined && (!Number.isFinite(dailyRate) || dailyRate < 0)) return setError(t('inp.ward.rateRequired'));
    run(async () => {
      await api.addBeds(ward.id, { labels: parsed, ...(dailyRate !== undefined ? { dailyRate } : {}) });
      onDone();
    }, t('inp.actionFailed'));
  };

  return (
    <DialogShell
      title={t('inp.ward.addBedsTitle', { name: ward.name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('inp.cancel')}</button>
          <button type="button" onClick={submit} disabled={saving} className={primaryBtn}>{t('inp.ward.addBeds')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} htmlFor="beds-labels">{t('inp.ward.beds')}</label>
        <input id="beds-labels" autoFocus value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="9-12, 12-A" className={inputClass} />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('inp.ward.bedsHint')}</p>
      </div>
      <div>
        <label className={labelClass} htmlFor="beds-rate">{t('inp.ward.bedRate')}</label>
        <input id="beds-rate" type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} placeholder={String(ward.dailyRate)} className={inputClass} />
      </div>
    </DialogShell>
  );
}
