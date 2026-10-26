'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { VACCINE_ROUTES, todayString, type ImmunizationCreated, type ScheduleItem, type VaccineRoute } from '@/lib/maternal-child';
import { DialogShell, ErrorBox, Field, cancelBtn, inputClass, messageOf, primaryBtn, useDay } from './ui';

/** Usual route per vaccine (pre-selected, can be changed) */
const DEFAULT_ROUTE: Record<string, VaccineRoute> = { BCG: 'ID', OPV: 'ORAL', ROTA: 'ORAL', MR: 'SC', YF: 'SC' };
export const defaultRoute = (vaccineCode: string): VaccineRoute => DEFAULT_ROUTE[vaccineCode] ?? 'IM';

const SITE_KEYS = ['leftArm', 'rightArm', 'leftThigh', 'rightThigh', 'mouth'] as const;
const itemKey = (i: ScheduleItem) => `${i.vaccineCode}:${i.doseNumber}`;

/**
 * Record one vaccine dose. Opened on a due dose: date (today), lot and route are pre-filled, so a
 * clinician saves in one more click; a dose given elsewhere is transcribed from the child's card.
 */
export function RecordDoseDialog({
  patient,
  items,
  initial,
  onClose,
  onSaved,
}: {
  patient: { id: string; name: string };
  /** Doses that can be recorded (not given) */
  items: ScheduleItem[];
  initial: ScheduleItem;
  onClose: () => void;
  onSaved: (record: ImmunizationCreated) => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const day = useDay();
  const [selected, setSelected] = useState(itemKey(initial));
  const item = items.find((i) => itemKey(i) === selected) ?? initial;
  const [administeredOn, setAdministeredOn] = useState(todayString());
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [site, setSite] = useState('');
  const [route, setRoute] = useState<VaccineRoute>(defaultRoute(initial.vaccineCode));
  const [external, setExternal] = useState(false);
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const changeDose = (key: string) => {
    setSelected(key);
    const next = items.find((i) => itemKey(i) === key);
    if (next) setRoute(defaultRoute(next.vaccineCode));
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const record = await api.recordImmunization(patient.id, {
        vaccineCode: item.vaccineCode,
        doseNumber: item.doseNumber,
        administeredOn,
        lotNumber: lotNumber.trim() || undefined,
        expiryDate: expiryDate || undefined,
        site: site.trim() || undefined,
        route,
        external: external || undefined,
        source: external ? source.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(t('mc.vax.saved'), t('mc.vax.savedFor', { label: record.label || item.label, name: patient.name }));
      for (const warning of record.warnings ?? []) toast.warning(t('mc.vax.warning'), warning);
      onSaved(record);
    } catch (err) {
      setError(messageOf(err, t('mc.vax.loadFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={t('mc.vax.recordTitle')}
      subtitle={`${patient.name} · ${item.label} · ${t('mc.vax.dueOn', { date: day(item.dueOn) })}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtn}>{t('mc.cancel')}</button>
          <button type="button" onClick={save} disabled={busy || !administeredOn} className={primaryBtn}>{busy ? t('mc.saving') : t('mc.save')}</button>
        </>
      }
    >
      <ErrorBox message={error} />
      {items.length > 1 && (
        <Field label={t('mc.vax.chooseDose')}>
          <select value={selected} onChange={(e) => changeDose(e.target.value)} className={inputClass}>
            {items.map((i) => (
              <option key={itemKey(i)} value={itemKey(i)}>
                {i.label} — {t(`mc.vax.status.${i.status}`)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('mc.vax.field.date')}>
          <input type="date" value={administeredOn} max={todayString()} onChange={(e) => setAdministeredOn(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t('mc.vax.field.route')}>
          <select value={route} onChange={(e) => setRoute(e.target.value as VaccineRoute)} className={inputClass}>
            {VACCINE_ROUTES.map((r) => (
              <option key={r} value={r}>{t(`mc.vax.route.${r}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('mc.vax.field.lot')}>
          <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} className={inputClass} autoComplete="off" />
        </Field>
        <Field label={t('mc.vax.field.expiry')}>
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label={t('mc.vax.field.site')}>
        <input value={site} onChange={(e) => setSite(e.target.value)} list="mc-vaccine-sites" className={inputClass} />
        <datalist id="mc-vaccine-sites">
          {SITE_KEYS.map((k) => (
            <option key={k} value={t(`mc.vax.site.${k}`)} />
          ))}
        </datalist>
      </Field>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} className="rounded border-gray-300" />
        {t('mc.vax.field.external')}
      </label>
      {external && (
        <Field label={t('mc.vax.field.source')}>
          <input value={source} onChange={(e) => setSource(e.target.value)} className={inputClass} />
        </Field>
      )}
      <Field label={t('mc.vax.field.notes')}>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </Field>
    </DialogShell>
  );
}
