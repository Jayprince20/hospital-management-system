'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import {
  BLOOD_GROUPS,
  DELIVERY_MODES,
  DIPSTICK_RESULTS,
  PREGNANCY_OUTCOMES,
  PRESENTATIONS,
  RISK_FACTORS,
  SCREENING_STATUSES,
  numOrUndef,
  todayString,
  type AntenatalVisit,
  type AntenatalVisitInput,
  type DeliveryMode,
  type DipstickResult,
  type PregnancyClose,
  type PregnancyDetail,
  type PregnancyOutcome,
  type Presentation,
  type ScreeningStatus,
} from '@/lib/maternal-child';
import { DialogShell, ErrorBox, Field, TriState, cancelBtn, inputClass, messageOf, primaryBtn } from './ui';

const intOrUndef = (v: string) => {
  const n = numOrUndef(v);
  return n === undefined ? undefined : Math.round(n);
};

function Footer({ busy, onClose, onSave, disabled = false }: { busy: boolean; onClose: () => void; onSave: () => void; disabled?: boolean }) {
  const { t } = useLanguage();
  return (
    <>
      <button type="button" onClick={onClose} className={cancelBtn}>{t('mc.cancel')}</button>
      <button type="button" onClick={onSave} disabled={busy || disabled} className={primaryBtn}>{busy ? t('mc.saving') : t('mc.save')}</button>
    </>
  );
}

/** Declare a pregnancy: dating (LMP or ultrasound EDD), obstetric history, screening, risks */
export function OpenPregnancyDialog({ patientId, onClose, onSaved }: { patientId: string; onClose: () => void; onSaved: (p: PregnancyDetail) => void }) {
  const { t } = useLanguage();
  const [lmp, setLmp] = useState('');
  const [eddUs, setEddUs] = useState('');
  const [gravida, setGravida] = useState('1');
  const [para, setPara] = useState('0');
  const [abortions, setAbortions] = useState('0');
  const [living, setLiving] = useState('0');
  const [prevCs, setPrevCs] = useState(false);
  const [bloodGroup, setBloodGroup] = useState('');
  const [hiv, setHiv] = useState<ScreeningStatus | ''>('');
  const [syphilis, setSyphilis] = useState<ScreeningStatus | ''>('');
  const [risks, setRisks] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Age risks are computed by the server
  const selectableRisks = RISK_FACTORS.filter((r) => r !== 'AGE_UNDER_18' && r !== 'AGE_OVER_35');
  const toggleRisk = (r: string) => setRisks((list) => (list.includes(r) ? list.filter((x) => x !== r) : [...list, r]));

  const save = async () => {
    if (!lmp && !eddUs) {
      setError(t('mc.preg.lmpOrEdd'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      onSaved(
        await api.openPregnancy(patientId, {
          lmp: lmp || undefined,
          eddByUltrasound: eddUs || undefined,
          gravida: intOrUndef(gravida) ?? 1,
          para: intOrUndef(para) ?? 0,
          abortions: intOrUndef(abortions),
          livingChildren: intOrUndef(living),
          previousCesarean: prevCs || undefined,
          bloodGroup: bloodGroup || undefined,
          hivStatus: hiv || undefined,
          syphilisStatus: syphilis || undefined,
          riskFactors: risks.length ? risks : undefined,
          notes: notes.trim() || undefined,
        })
      );
    } catch (err) {
      setError(messageOf(err, t('mc.preg.loadFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell title={t('mc.preg.openTitle')} onClose={onClose} wide footer={<Footer busy={busy} onClose={onClose} onSave={save} />}>
      <ErrorBox message={error} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('mc.preg.field.lmp')}>
          <input type="date" value={lmp} max={todayString()} onChange={(e) => setLmp(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('mc.preg.field.eddUs')}>
          <input type="date" value={eddUs} onChange={(e) => setEddUs(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('mc.preg.obstetric')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label={t('mc.preg.field.gravida')}><input type="number" min={1} value={gravida} onChange={(e) => setGravida(e.target.value)} className={inputClass} /></Field>
        <Field label={t('mc.preg.field.para')}><input type="number" min={0} value={para} onChange={(e) => setPara(e.target.value)} className={inputClass} /></Field>
        <Field label={t('mc.preg.field.abortions')}><input type="number" min={0} value={abortions} onChange={(e) => setAbortions(e.target.value)} className={inputClass} /></Field>
        <Field label={t('mc.preg.field.living')}><input type="number" min={0} value={living} onChange={(e) => setLiving(e.target.value)} className={inputClass} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={prevCs} onChange={(e) => setPrevCs(e.target.checked)} className="rounded border-gray-300" />
        {t('mc.preg.field.prevCs')}
      </label>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('mc.preg.screening')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label={t('mc.preg.field.bloodGroup')}>
          <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className={inputClass}>
            <option value="">—</option>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label={t('mc.preg.field.hiv')}>
          <select value={hiv} onChange={(e) => setHiv(e.target.value as ScreeningStatus | '')} className={inputClass}>
            <option value="">—</option>
            {SCREENING_STATUSES.map((s) => <option key={s} value={s}>{t(`mc.screen.${s}`)}</option>)}
          </select>
        </Field>
        <Field label={t('mc.preg.field.syphilis')}>
          <select value={syphilis} onChange={(e) => setSyphilis(e.target.value as ScreeningStatus | '')} className={inputClass}>
            <option value="">—</option>
            {SCREENING_STATUSES.map((s) => <option key={s} value={s}>{t(`mc.screen.${s}`)}</option>)}
          </select>
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('mc.preg.risks')}</legend>
        <div className="flex flex-wrap gap-2">
          {selectableRisks.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={risks.includes(r)}
              onClick={() => toggleRisk(r)}
              className={`px-2.5 py-1 rounded-full border text-xs font-medium ${risks.includes(r) ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}
            >
              {t(`mc.risk.${r}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label={t('mc.preg.field.notes')}>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </Field>
    </DialogShell>
  );
}

/** One antenatal contact: examination, tests and preventive care given */
export function VisitDialog({ pregnancy, onClose, onSaved }: { pregnancy: PregnancyDetail; onClose: () => void; onSaved: (v: AntenatalVisit) => void }) {
  const { t } = useLanguage();
  const [f, setF] = useState({
    visitDate: todayString(),
    weightKg: '',
    bpSystolic: '',
    bpDiastolic: '',
    fundalHeightCm: '',
    fetalHeartRate: '',
    presentation: '' as Presentation | '',
    urineProtein: '' as DipstickResult | '',
    urineGlucose: '' as DipstickResult | '',
    hemoglobin: '',
    iptpDose: pregnancy.iptpDue ? String(pregnancy.iptpDosesGiven + 1) : '',
    tdDose: '',
    complaints: '',
    plan: '',
    nextVisitDate: pregnancy.nextContact?.targetDate?.slice(0, 10) ?? '',
  });
  const [movements, setMovements] = useState<boolean | null>(null);
  const [oedema, setOedema] = useState<boolean | null>(null);
  const [ironFolate, setIronFolate] = useState<boolean | null>(true);
  const [llin, setLlin] = useState<boolean | null>(null);
  const [deworming, setDeworming] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) => setF((prev) => ({ ...prev, [key]: e.target.value }));

  const save = async () => {
    setBusy(true);
    setError('');
    const input: AntenatalVisitInput = {
      visitDate: f.visitDate,
      weightKg: numOrUndef(f.weightKg),
      bpSystolic: intOrUndef(f.bpSystolic),
      bpDiastolic: intOrUndef(f.bpDiastolic),
      fundalHeightCm: numOrUndef(f.fundalHeightCm),
      fetalHeartRate: intOrUndef(f.fetalHeartRate),
      presentation: f.presentation || undefined,
      fetalMovements: movements ?? undefined,
      oedema: oedema ?? undefined,
      urineProtein: f.urineProtein || undefined,
      urineGlucose: f.urineGlucose || undefined,
      hemoglobin: numOrUndef(f.hemoglobin),
      iptpDose: intOrUndef(f.iptpDose),
      tdDose: intOrUndef(f.tdDose),
      ironFolate: ironFolate ?? undefined,
      llin: llin ?? undefined,
      deworming: deworming ?? undefined,
      complaints: f.complaints.trim() || undefined,
      plan: f.plan.trim() || undefined,
      nextVisitDate: f.nextVisitDate || undefined,
    };
    try {
      onSaved(await api.addAntenatalVisit(pregnancy.id, input));
    } catch (err) {
      setError(messageOf(err, t('mc.preg.loadFailed')));
    } finally {
      setBusy(false);
    }
  };

  const doseOptions = (given: number) => Array.from({ length: 5 }, (_, i) => i + 1).filter((n) => n > given - 1);

  return (
    <DialogShell
      title={t('mc.preg.visitTitle')}
      subtitle={pregnancy.nextContact ? t('mc.preg.nextContactValue', { n: pregnancy.nextContact.number, week: pregnancy.nextContact.targetWeek, date: pregnancy.nextContact.targetDate.slice(0, 10) }) : undefined}
      onClose={onClose}
      wide
      footer={<Footer busy={busy} onClose={onClose} onSave={save} disabled={!f.visitDate} />}
    >
      <ErrorBox message={error} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label={t('mc.visit.field.date')}><input type="date" value={f.visitDate} max={todayString()} onChange={set('visitDate')} className={inputClass} /></Field>
        <Field label={t('mc.visit.field.weight')}><input inputMode="decimal" value={f.weightKg} onChange={set('weightKg')} className={inputClass} /></Field>
        <Field label={t('mc.visit.field.hb')}><input inputMode="decimal" value={f.hemoglobin} onChange={set('hemoglobin')} className={inputClass} /></Field>
      </div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('mc.visit.section.exam')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label={t('mc.visit.field.sys')}><input inputMode="numeric" value={f.bpSystolic} onChange={set('bpSystolic')} className={inputClass} aria-describedby="mc-bp-unit" /></Field>
        <Field label={t('mc.visit.field.dia')}><input inputMode="numeric" value={f.bpDiastolic} onChange={set('bpDiastolic')} className={inputClass} aria-describedby="mc-bp-unit" /></Field>
        <Field label={t('mc.visit.field.fh')}><input inputMode="decimal" value={f.fundalHeightCm} onChange={set('fundalHeightCm')} className={inputClass} /></Field>
        <Field label={t('mc.visit.field.fhr')}><input inputMode="numeric" value={f.fetalHeartRate} onChange={set('fetalHeartRate')} className={inputClass} /></Field>
      </div>
      <p id="mc-bp-unit" className="sr-only">{t('mc.visit.field.bp')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label={t('mc.visit.field.presentation')}>
          <select value={f.presentation} onChange={set('presentation')} className={inputClass}>
            <option value="">—</option>
            {PRESENTATIONS.map((p) => <option key={p} value={p}>{t(`mc.pres.${p}`)}</option>)}
          </select>
        </Field>
        <Field label={t('mc.visit.field.protein')}>
          <select value={f.urineProtein} onChange={set('urineProtein')} className={inputClass}>
            <option value="">—</option>
            {DIPSTICK_RESULTS.map((d) => <option key={d} value={d}>{t(`mc.dip.${d}`)}</option>)}
          </select>
        </Field>
        <Field label={t('mc.visit.field.glucose')}>
          <select value={f.urineGlucose} onChange={set('urineGlucose')} className={inputClass}>
            <option value="">—</option>
            {DIPSTICK_RESULTS.map((d) => <option key={d} value={d}>{t(`mc.dip.${d}`)}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TriState label={t('mc.visit.field.movements')} value={movements} onChange={setMovements} />
        <TriState label={t('mc.visit.field.oedema')} value={oedema} onChange={setOedema} />
      </div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('mc.visit.section.prevention')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('mc.visit.field.iptp')} hint={pregnancy.iptpDue ? `${t('mc.preg.iptp')} : ${t('mc.preg.iptpDue')}` : undefined}>
          <select value={f.iptpDose} onChange={set('iptpDose')} className={inputClass}>
            <option value="">{t('mc.visit.none')}</option>
            {doseOptions(pregnancy.iptpDosesGiven + 1).map((n) => <option key={n} value={String(n)}>{t('mc.visit.doseN', { n })}</option>)}
          </select>
        </Field>
        <Field label={t('mc.visit.field.td')}>
          <select value={f.tdDose} onChange={set('tdDose')} className={inputClass}>
            <option value="">{t('mc.visit.none')}</option>
            {doseOptions(pregnancy.tdDosesGiven + 1).map((n) => <option key={n} value={String(n)}>{t('mc.visit.doseN', { n })}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TriState label={t('mc.visit.field.ironFolate')} value={ironFolate} onChange={setIronFolate} />
        <TriState label={t('mc.visit.field.llin')} value={llin} onChange={setLlin} />
        <TriState label={t('mc.visit.field.deworming')} value={deworming} onChange={setDeworming} />
      </div>
      <Field label={t('mc.visit.field.complaints')}><textarea value={f.complaints} onChange={set('complaints')} rows={2} className={inputClass} /></Field>
      <Field label={t('mc.visit.field.plan')}><textarea value={f.plan} onChange={set('plan')} rows={2} className={inputClass} /></Field>
      <Field label={t('mc.visit.field.nextVisit')}><input type="date" value={f.nextVisitDate} onChange={set('nextVisitDate')} className={inputClass} /></Field>
    </DialogShell>
  );
}

/** Close the pregnancy: delivery (with outcome and mode), loss, or transfer */
export function ClosePregnancyDialog({ pregnancy, onClose, onSaved }: { pregnancy: PregnancyDetail; onClose: () => void; onSaved: (p: PregnancyDetail) => void }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<PregnancyClose['status']>('DELIVERED');
  const [outcome, setOutcome] = useState<PregnancyOutcome>('LIVE_BIRTH');
  const [closedOn, setClosedOn] = useState(todayString());
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('VAGINAL');
  const [babyPatientId, setBabyPatientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const delivered = status === 'DELIVERED';

  const changeStatus = (next: PregnancyClose['status']) => {
    setStatus(next);
    setOutcome(next === 'DELIVERED' ? 'LIVE_BIRTH' : next === 'TRANSFERRED' ? 'TRANSFERRED_OUT' : 'MISCARRIAGE');
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      onSaved(
        await api.updatePregnancy(pregnancy.id, {
          status,
          outcome,
          closedOn,
          deliveryDate: delivered ? closedOn : undefined,
          deliveryMode: delivered ? deliveryMode : undefined,
          babyPatientId: delivered && babyPatientId.trim() ? babyPatientId.trim() : undefined,
        })
      );
    } catch (err) {
      setError(messageOf(err, t('mc.preg.loadFailed')));
    } finally {
      setBusy(false);
    }
  };

  const outcomes = PREGNANCY_OUTCOMES.filter((o) => (delivered ? o === 'LIVE_BIRTH' || o === 'STILLBIRTH' : status === 'TRANSFERRED' ? o === 'TRANSFERRED_OUT' : o !== 'LIVE_BIRTH' && o !== 'STILLBIRTH' && o !== 'TRANSFERRED_OUT'));

  return (
    <DialogShell title={t('mc.preg.close')} onClose={onClose} footer={<Footer busy={busy} onClose={onClose} onSave={save} />}>
      <ErrorBox message={error} />
      <Field label={t('mc.preg.field.closeStatus')}>
        <select value={status} onChange={(e) => changeStatus(e.target.value as PregnancyClose['status'])} className={inputClass}>
          {(['DELIVERED', 'ENDED', 'TRANSFERRED'] as const).map((s) => <option key={s} value={s}>{t(`mc.preg.status.${s}`)}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('mc.preg.field.outcome')}>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as PregnancyOutcome)} className={inputClass}>
            {outcomes.map((o) => <option key={o} value={o}>{t(`mc.preg.outcome.${o}`)}</option>)}
          </select>
        </Field>
        <Field label={delivered ? t('mc.preg.field.deliveryDate') : t('mc.preg.field.closedOn')}>
          <input type="date" value={closedOn} max={todayString()} onChange={(e) => setClosedOn(e.target.value)} className={inputClass} />
        </Field>
      </div>
      {delivered && (
        <>
          <Field label={t('mc.preg.field.deliveryMode')}>
            <select value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)} className={inputClass}>
              {DELIVERY_MODES.map((m) => <option key={m} value={m}>{t(`mc.preg.mode.${m}`)}</option>)}
            </select>
          </Field>
          <Field label={t('mc.preg.field.babyPatientId')}>
            <input value={babyPatientId} onChange={(e) => setBabyPatientId(e.target.value)} className={inputClass} />
          </Field>
        </>
      )}
    </DialogShell>
  );
}
