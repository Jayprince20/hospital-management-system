'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api,
  type AdmissionBill,
  type AdmissionCharge,
  type AdmissionDetail,
  type InpatientVitals,
  type MarDay,
  type MarDose,
  type MedicationOrder,
  type ProgressNote,
  type ProgressNoteType,
} from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/toast';
import { assignmentWard, billSplit, isOpenDose, localDay } from '@/lib/inpatient';
import { AddChargeDialog, NewOrderDialog, ReasonDialog, RecordDoseDialog } from './dialogs';
import { DoseBadge, ErrorBox, cardClass, inputClass, primaryBtn, smallBtn } from './ui';

const VITAL_FIELDS: Array<{ key: keyof InpatientVitals; label: string; unit: string }> = [
  { key: 'bloodPressureSys', label: 'inp.vitals.sys', unit: 'mmHg' },
  { key: 'bloodPressureDia', label: 'inp.vitals.dia', unit: 'mmHg' },
  { key: 'heartRate', label: 'inp.vitals.hr', unit: 'bpm' },
  { key: 'temperature', label: 'inp.vitals.temp', unit: '°C' },
  { key: 'respiratoryRate', label: 'inp.vitals.rr', unit: '/min' },
  { key: 'oxygenSaturation', label: 'inp.vitals.spo2', unit: '%' },
  { key: 'weight', label: 'inp.vitals.weight', unit: 'kg' },
];

export function VitalsSummary({ vitals }: { vitals: InpatientVitals | null }) {
  const { t, formatDateTime } = useLanguage();
  if (!vitals) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('inp.vitals.none')}</p>;
  const bp = vitals.bloodPressureSys && vitals.bloodPressureDia ? `${vitals.bloodPressureSys}/${vitals.bloodPressureDia} mmHg` : null;
  const items = [
    bp && { label: t('inp.vitals.bp'), value: bp },
    vitals.heartRate != null && { label: t('inp.vitals.hr'), value: `${vitals.heartRate} bpm` },
    vitals.temperature != null && { label: t('inp.vitals.temp'), value: `${vitals.temperature} °C` },
    vitals.respiratoryRate != null && { label: t('inp.vitals.rr'), value: `${vitals.respiratoryRate} /min` },
    vitals.oxygenSaturation != null && { label: t('inp.vitals.spo2'), value: `${vitals.oxygenSaturation} %` },
    vitals.weight != null && { label: t('inp.vitals.weight'), value: `${vitals.weight} kg` },
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  return (
    <div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className="font-semibold text-gray-900 dark:text-white tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
      {vitals.recordedAt && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('inp.vitals.recordedAt', { date: formatDateTime(vitals.recordedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</p>}
    </div>
  );
}

function OrderLine({ order }: { order: MedicationOrder }) {
  const { t } = useLanguage();
  return (
    <div>
      <p className="font-medium text-gray-900 dark:text-white">
        {order.medication ? `${order.medication.name} ${order.medication.strength}` : order.drugName}
        <span className="font-normal text-gray-600 dark:text-gray-300"> · {order.dose} · {t(`inp.route.${order.route}`)}</span>
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {order.asNeeded ? t('inp.order.prn') : order.times.join(' · ')}
        {order.instructions ? ` · ${order.instructions}` : ''}
      </p>
      {order.allergyWarning && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{order.allergyWarning}</p>}
    </div>
  );
}

const NOTE_STYLE: Record<ProgressNoteType, string> = {
  DOCTOR_ROUND: 'border-l-blue-500',
  NURSING: 'border-l-lime-500',
  HANDOVER: 'border-l-purple-500',
};

function NoteItem({ note }: { note: ProgressNote }) {
  const { t, formatDateTime } = useLanguage();
  return (
    <li className={`border-l-4 ${NOTE_STYLE[note.type]} pl-3 py-1`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        <span className="font-semibold text-gray-700 dark:text-gray-200">{t(`inp.noteType.${note.type}`)}</span> · {note.author.name} ·{' '}
        {formatDateTime(note.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="text-sm text-gray-900 dark:text-white whitespace-pre-line">{note.note}</p>
      {note.vitals && (
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
          <VitalsSummary vitals={{ ...note.vitals, recordedAt: undefined }} />
        </div>
      )}
    </li>
  );
}

export function OverviewTab({ admission, onTab }: { admission: AdmissionDetail; onTab: (tab: 'notes' | 'orders') => void }) {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<MedicationOrder[] | null>(null);
  const [notes, setNotes] = useState<ProgressNote[] | null>(null);

  useEffect(() => {
    api.getMedicationOrders(admission.id, 'ACTIVE').then(setOrders).catch(() => setOrders([]));
    api.getAdmissionNotes(admission.id).then(setNotes).catch(() => setNotes([]));
  }, [admission.id]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className={`${cardClass} p-5 space-y-4`}>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{t('inp.detail.reason')}</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">{admission.reason}</p>
          {admission.provisionalDiagnosis && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('inp.detail.provisional', { diagnosis: admission.provisionalDiagnosis })}</p>}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('inp.detail.latestVitals')}</h3>
          <VitalsSummary vitals={admission.latestVitals} />
        </div>
        {admission.status === 'DISCHARGED' && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1 text-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('inp.detail.dischargeSummary')}</h3>
            {admission.finalDiagnosis && <p className="text-gray-700 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">{t('inp.discharge.finalDiagnosis')} :</span> {admission.finalDiagnosis}{admission.diagnosisCodes.length ? ` (${admission.diagnosisCodes.join(', ')})` : ''}</p>}
            {admission.hospitalCourse && <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{admission.hospitalCourse}</p>}
            {admission.dischargeMedications && <p className="text-gray-700 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">{t('inp.discharge.medications')} :</span> {admission.dischargeMedications}</p>}
            {admission.dischargeInstructions && <p className="text-gray-700 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">{t('inp.discharge.instructions')} :</span> {admission.dischargeInstructions}</p>}
          </div>
        )}
      </section>
      <div className="space-y-6">
        <section className={`${cardClass} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('inp.detail.activeOrders')}</h3>
            <button type="button" onClick={() => onTab('orders')} className="text-sm text-lime-700 dark:text-lime-400 hover:underline">{t('inp.detail.seeAll')}</button>
          </div>
          {orders === null ? (
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('inp.order.none')}</p>
          ) : (
            <ul className="space-y-2">{orders.map((o) => <li key={o.id}><OrderLine order={o} /></li>)}</ul>
          )}
        </section>
        <section className={`${cardClass} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('inp.detail.recentNotes')}</h3>
            <button type="button" onClick={() => onTab('notes')} className="text-sm text-lime-700 dark:text-lime-400 hover:underline">{t('inp.detail.seeAll')}</button>
          </div>
          {notes === null ? (
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('inp.note.none')}</p>
          ) : (
            <ul className="space-y-3">{notes.slice(0, 3).map((n) => <NoteItem key={n.id} note={n} />)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function NotesTab({ admission }: { admission: AdmissionDetail }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const isDoctor = user?.role === 'DOCTOR' || user?.role === 'ADMIN';
  const canWrite = admission.status === 'ADMITTED' && (isDoctor || user?.role === 'NURSE');
  const [notes, setNotes] = useState<ProgressNote[] | null>(null);
  const [filter, setFilter] = useState<ProgressNoteType | ''>('');
  const [type, setType] = useState<ProgressNoteType>(user?.role === 'DOCTOR' ? 'DOCTOR_ROUND' : 'NURSING');
  const [text, setText] = useState('');
  const [withVitals, setWithVitals] = useState(false);
  const [vitals, setVitals] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.getAdmissionNotes(admission.id, filter || undefined).then(setNotes).catch((err) => {
      setNotes([]);
      setError(err instanceof Error ? err.message : t('inp.loadFailed'));
    });
  }, [admission.id, filter, t]);
  useEffect(() => {
    load();
  }, [load]);

  const types: ProgressNoteType[] = isDoctor ? ['DOCTOR_ROUND', 'NURSING', 'HANDOVER'] : ['NURSING', 'HANDOVER'];

  const submit = async () => {
    if (!text.trim()) return setError(t('inp.note.textRequired'));
    const parsed: InpatientVitals = {};
    if (withVitals) {
      for (const field of VITAL_FIELDS) {
        const raw = (vitals[field.key] ?? '').replace(',', '.').trim();
        if (raw === '') continue;
        const value = Number(raw);
        if (!Number.isFinite(value)) return setError(t('inp.note.badVital', { name: t(field.label) }));
        (parsed as Record<string, number>)[field.key] = value;
      }
    }
    setSaving(true);
    setError('');
    try {
      await api.addAdmissionNote(admission.id, { type, note: text.trim(), ...(Object.keys(parsed).length ? { vitals: parsed } : {}) });
      setText('');
      setVitals({});
      setWithVitals(false);
      toast.success(t('inp.note.saved'));
      load();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('inp.actionFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {canWrite && (
        <section className={`${cardClass} p-5 space-y-3 lg:col-span-1 h-fit`}>
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('inp.note.new')}</h3>
          <ErrorBox message={error} />
          <div className="flex flex-wrap gap-2">
            {types.map((x) => (
              <button key={x} type="button" onClick={() => setType(x)} aria-pressed={type === x} className={`px-2.5 py-1 text-xs rounded-md border ${type === x ? 'border-lime-500 bg-lime-50 text-lime-800 dark:bg-lime-900/30 dark:text-lime-200' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                {t(`inp.noteType.${x}`)}
              </button>
            ))}
          </div>
          <textarea aria-label={t('inp.note.text')} rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={t(`inp.note.placeholder.${type}`)} className={inputClass} />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={withVitals} onChange={(e) => setWithVitals(e.target.checked)} />
            {t('inp.note.withVitals')}
          </label>
          {withVitals && (
            <div className="grid grid-cols-2 gap-2">
              {VITAL_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-600 dark:text-gray-400" htmlFor={`note-${field.key}`}>{t(field.label)} ({field.unit})</label>
                  <input id={`note-${field.key}`} inputMode="decimal" value={vitals[field.key] ?? ''} onChange={(e) => setVitals((v) => ({ ...v, [field.key]: e.target.value }))} className={inputClass} />
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={submit} disabled={saving} className={`${primaryBtn} w-full`}>{t('inp.note.save')}</button>
        </section>
      )}
      <section className={`${cardClass} p-5 ${canWrite ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
        <div className="flex items-center justify-between mb-4 gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('inp.note.timeline')}</h3>
          <select aria-label={t('inp.note.filter')} value={filter} onChange={(e) => setFilter(e.target.value as ProgressNoteType | '')} className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">{t('inp.note.all')}</option>
            {(['DOCTOR_ROUND', 'NURSING', 'HANDOVER'] as ProgressNoteType[]).map((x) => <option key={x} value={x}>{t(`inp.noteType.${x}`)}</option>)}
          </select>
        </div>
        {!canWrite && error && <ErrorBox message={error} />}
        {notes === null ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('inp.note.none')}</p>
        ) : (
          <ul className="space-y-4">{notes.map((n) => <NoteItem key={n.id} note={n} />)}</ul>
        )}
      </section>
    </div>
  );
}

export function OrdersTab({ admission }: { admission: AdmissionDetail }) {
  const { t, formatDateTime } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const canPrescribe = admission.status === 'ADMITTED' && (user?.role === 'DOCTOR' || user?.role === 'ADMIN');
  const [orders, setOrders] = useState<MedicationOrder[] | null>(null);
  const [dialog, setDialog] = useState<{ kind: 'new' } | { kind: 'stop'; order: MedicationOrder } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.getMedicationOrders(admission.id).then(setOrders).catch((err) => {
      setOrders([]);
      setError(err instanceof Error ? err.message : t('inp.loadFailed'));
    });
  }, [admission.id, t]);
  useEffect(() => {
    load();
  }, [load]);

  const active = (orders ?? []).filter((o) => o.status === 'ACTIVE');
  const past = (orders ?? []).filter((o) => o.status !== 'ACTIVE');
  const when = (iso: string) => formatDateTime(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <ErrorBox message={error} />
      <section className={`${cardClass} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('inp.order.active')}</h3>
          {canPrescribe && <button type="button" onClick={() => setDialog({ kind: 'new' })} className={primaryBtn}>+ {t('inp.order.new')}</button>}
        </div>
        {orders === null ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('inp.order.none')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {active.map((o) => (
              <li key={o.id} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <OrderLine order={o} />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('inp.order.prescribedBy', { name: o.prescribedByName ?? '—', date: when(o.startAt) })}
                    {o.endAt ? ` · ${t('inp.order.until', { date: when(o.endAt) })}` : ''}
                  </p>
                  {o.lastGiven && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                      {t('inp.order.lastGiven', { status: t(`inp.admin.${o.lastGiven.status}`), date: when(o.lastGiven.at), name: o.lastGiven.byName })}
                    </p>
                  )}
                </div>
                {canPrescribe && <button type="button" onClick={() => setDialog({ kind: 'stop', order: o })} className={`${smallBtn} text-red-600 dark:text-red-400 shrink-0`}>{t('inp.order.stop')}</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {past.length > 0 && (
        <section className={`${cardClass} p-5`}>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('inp.order.past')}</h3>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {past.map((o) => (
              <li key={o.id} className="py-3 opacity-80">
                <OrderLine order={o} />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t(`inp.orderStatus.${o.status}`)}
                  {o.stoppedAt ? ` · ${when(o.stoppedAt)}` : ''}
                  {o.stoppedByName ? ` · ${o.stoppedByName}` : ''}
                  {o.stopReason ? ` · ${o.stopReason}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {dialog?.kind === 'new' && (
        <NewOrderDialog
          admission={admission}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            toast.success(t('inp.order.saved'));
            load();
          }}
        />
      )}
      {dialog?.kind === 'stop' && (
        <ReasonDialog
          title={t('inp.order.stopTitle', { drug: dialog.order.drugName })}
          label={t('inp.order.stopReason')}
          confirmLabel={t('inp.order.stop')}
          danger
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            await api.stopMedicationOrder(admission.id, dialog.order.id, reason);
            setDialog(null);
            toast.success(t('inp.order.stopped'));
            load();
          }}
        />
      )}
    </div>
  );
}

type DoseTarget = { order: MedicationOrder; dose: MarDose | null };

export function MarTab({ admission }: { admission: AdmissionDetail }) {
  const { t, formatDateTime } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const canRecord = admission.status === 'ADMITTED' && (user?.role === 'NURSE' || user?.role === 'DOCTOR' || user?.role === 'ADMIN');
  const [date, setDate] = useState(localDay());
  const [mar, setMar] = useState<MarDay | null>(null);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<DoseTarget | null>(null);

  const load = useCallback(() => {
    api
      .getMar(admission.id, date)
      .then((d) => {
        setMar(d);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('inp.loadFailed')));
  }, [admission.id, date, t]);
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const shift = (days: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    setDate(localDay(d));
  };
  const at = (iso: string) => formatDateTime(iso, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => shift(-1)} className={smallBtn} aria-label={t('inp.mar.previousDay')}>←</button>
        <input type="date" aria-label={t('inp.mar.day')} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
        <button type="button" onClick={() => shift(1)} className={smallBtn} aria-label={t('inp.mar.nextDay')}>→</button>
        {date !== localDay() && <button type="button" onClick={() => setDate(localDay())} className={smallBtn}>{t('inp.mar.today')}</button>}
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">{t('inp.mar.legend')}</span>
      </div>
      <ErrorBox message={error} />
      <section className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 w-1/3">{t('inp.mar.medication')}</th>
              <th className="px-4 py-3">{t('inp.mar.doses')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {mar === null && !error && <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-500">{t('common.loading')}</td></tr>}
            {mar && mar.rows.length === 0 && <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">{t('inp.mar.noScheduled')}</td></tr>}
            {mar?.rows.map(({ order, doses }) => (
              <tr key={order.id}>
                <td className="px-4 py-3 align-top"><OrderLine order={order} /></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {doses.map((dose) => {
                      const open = isOpenDose(dose.status) && canRecord && dose.status !== 'UPCOMING';
                      const title = dose.administration
                        ? `${t(`inp.admin.${dose.administration.status}`)} · ${at(dose.administration.recordedAt)}${dose.administration.givenByName ? ` · ${dose.administration.givenByName}` : ''}${dose.administration.reason ? ` · ${dose.administration.reason}` : ''}`
                        : t(`inp.dose.${dose.status}`);
                      return (
                        <button
                          key={dose.scheduledAt}
                          type="button"
                          title={title}
                          disabled={!open && !(canRecord && dose.status === 'UPCOMING')}
                          onClick={() => setTarget({ order, dose })}
                          className="disabled:cursor-default"
                        >
                          <DoseBadge status={dose.status} label={`${dose.time} · ${t(`inp.dose.${dose.status}`)}`} />
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {mar && mar.prn.length > 0 && (
        <section className={`${cardClass} p-5`}>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('inp.mar.prn')}</h3>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {mar.prn.map(({ order, administrations }) => (
              <li key={order.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <OrderLine order={order} />
                  {administrations.length > 0 && (
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {administrations.map((a) => `${at(a.recordedAt)} ${t(`inp.admin.${a.status}`)}${a.givenByName ? ` (${a.givenByName})` : ''}`).join(' · ')}
                    </p>
                  )}
                </div>
                {canRecord && order.status === 'ACTIVE' && date === localDay() && (
                  <button type="button" onClick={() => setTarget({ order, dose: null })} className={primaryBtn}>{t('inp.mar.give')}</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {target && (
        <RecordDoseDialog
          title={target.dose ? t('inp.mar.recordTitle', { drug: target.order.drugName, time: target.dose.time }) : t('inp.mar.prnTitle', { drug: target.order.drugName })}
          subtitle={`${target.order.dose} · ${t(`inp.route.${target.order.route}`)}`}
          defaultDose={target.order.dose}
          onClose={() => setTarget(null)}
          onConfirm={async (data) => {
            await api.recordAdministration(admission.id, { orderId: target.order.id, scheduledAt: target.dose?.scheduledAt ?? null, ...data });
            setTarget(null);
            toast.success(t('inp.mar.saved'));
            load();
          }}
        />
      )}
    </div>
  );
}

export function BillingTab({ admission }: { admission: AdmissionDetail }) {
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const role = user?.role;
  const canCharge = role === 'ADMIN' || role === 'DOCTOR' || role === 'NURSE' || role === 'RECEPTIONIST';
  const canSeeBill = role === 'ADMIN' || role === 'RECEPTIONIST' || role === 'DOCTOR';
  const billed = Boolean(admission.invoice);
  const open = !billed && (admission.status === 'ADMITTED' || admission.status === 'DISCHARGED');
  const [charges, setCharges] = useState<{ charges: AdmissionCharge[]; total: number } | null>(null);
  const [bill, setBill] = useState<AdmissionBill | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.getAdmissionCharges(admission.id).then(setCharges).catch((err) => setError(err instanceof Error ? err.message : t('inp.loadFailed')));
    if (canSeeBill) api.getAdmissionBill(admission.id).then(setBill).catch(() => setBill(null));
  }, [admission.id, canSeeBill, t]);
  useEffect(() => {
    load();
  }, [load]);

  const remove = async (charge: AdmissionCharge) => {
    try {
      await api.deleteAdmissionCharge(admission.id, charge.id);
      toast.success(t('inp.charge.deleted'));
      load();
    } catch (err) {
      toast.error(t('inp.actionFailed'), err instanceof Error ? err.message : undefined);
    }
  };

  const split = bill ? billSplit(bill) : null;

  return (
    <div className="space-y-6">
      <ErrorBox message={error} />
      {admission.invoice && (
        <div className={`${cardClass} p-4 flex flex-wrap items-center justify-between gap-3`}>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {t('inp.bill.invoiced', { number: admission.invoice.invoiceNumber, total: formatCurrency(admission.invoice.total) })}
          </p>
          {(role === 'ADMIN' || role === 'RECEPTIONIST') && (
            <Link href={`/dashboard/billing/${admission.invoice.id}`} className={primaryBtn}>{t('inp.bill.openInvoice')}</Link>
          )}
        </div>
      )}
      {admission.coverageWarning === 'PRE_AUTH_REQUIRED' && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm">{t('inp.bill.preAuthWarning')}</div>
      )}
      {canSeeBill && bill && (
        <section className={`${cardClass} p-5`}>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{billed ? t('inp.bill.title') : t('inp.bill.previewTitle')}</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="py-2">{t('inp.charge.description')}</th>
                <th className="py-2 text-right">{t('inp.charge.quantity')}</th>
                <th className="py-2 text-right">{t('inp.charge.unitPrice')}</th>
                <th className="py-2 text-right">{t('inp.charge.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {bill.lines.map((line, i) => (
                <tr key={line.chargeId ?? `${line.source}-${i}`}>
                  <td className="py-2 text-gray-900 dark:text-white">{line.description}</td>
                  <td className="py-2 text-right tabular-nums">{line.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(line.unitPrice)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(line.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr className="border-t border-gray-200 dark:border-gray-700">
                <td colSpan={3} className="pt-3 font-semibold text-gray-900 dark:text-white">{t('inp.bill.total')}</td>
                <td className="pt-3 text-right font-semibold tabular-nums">{formatCurrency(bill.subtotal)}</td>
              </tr>
              {split && split.insurerShare > 0 && (
                <>
                  <tr>
                    <td colSpan={3} className="pt-1 text-blue-700 dark:text-blue-300">{t('inp.bill.insurerShare', { payer: split.payerName ?? t('inp.bill.insurer') })}</td>
                    <td className="pt-1 text-right tabular-nums text-blue-700 dark:text-blue-300">{formatCurrency(split.insurerShare)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="pt-1 text-gray-700 dark:text-gray-300">{t('inp.bill.patientShare')}</td>
                    <td className="pt-1 text-right tabular-nums">{formatCurrency(split.patientShare)}</td>
                  </tr>
                </>
              )}
            </tfoot>
          </table>
          {!billed && <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{t('inp.bill.previewHint')}</p>}
        </section>
      )}
      <section className={`${cardClass} p-5`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('inp.charge.list')}</h3>
          {canCharge && open && <button type="button" onClick={() => setAdding(true)} className={primaryBtn}>+ {t('inp.charge.add')}</button>}
        </div>
        {charges === null ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : charges.charges.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('inp.charge.none')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {charges.charges.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">{c.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t(`inp.chargeCategory.${c.category}`)} · {c.quantity} × {formatCurrency(c.unitPrice)} ·{' '}
                    {formatDateTime(c.chargedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {c.addedByName ? ` · ${c.addedByName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm tabular-nums font-medium">{formatCurrency(c.total)}</span>
                  {canCharge && !c.invoiced && c.category !== 'MEDICATION' && open && (
                    <button type="button" onClick={() => remove(c)} className="text-xs text-red-600 dark:text-red-400 hover:underline">{t('inp.charge.delete')}</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{t('inp.charge.bedDaysHint')}</p>
      </section>
      {adding && (
        <AddChargeDialog
          admissionId={admission.id}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            toast.success(t('inp.charge.saved'));
            load();
          }}
        />
      )}
    </div>
  );
}

export function HistoryTab({ admission }: { admission: AdmissionDetail }) {
  const { t, formatDateTime } = useLanguage();
  const when = (iso: string) => formatDateTime(iso, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <section className={`${cardClass} p-5`}>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{t('inp.history.title')}</h3>
      {admission.assignments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('inp.history.none')}</p>
      ) : (
        <ol className="space-y-3">
          {admission.assignments.map((a, i) => (
            <li key={`${a.startAt}-${i}`} className="border-l-4 border-l-blue-400 pl-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{assignmentWard(a)} · {t('inp.bedLabel', { label: a.bed.label })}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {when(a.startAt)} → {a.endAt ? when(a.endAt) : t('inp.history.current')}
                {a.movedByName ? ` · ${a.movedByName}` : ''}
              </p>
              {a.reason && <p className="text-xs text-gray-600 dark:text-gray-300">{a.reason}</p>}
            </li>
          ))}
        </ol>
      )}
      {admission.queueTicket && <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">{t('inp.history.fromQueue', { number: admission.queueTicket.number })}</p>}
      {admission.cancelReason && <p className="text-sm text-red-600 dark:text-red-400 mt-4">{t('inp.history.cancelled', { reason: admission.cancelReason })}</p>}
    </section>
  );
}
