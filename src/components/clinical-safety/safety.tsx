'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { OVERRIDE_MIN_LENGTH, SEVERITY_STYLE, isBlocked, sortAlerts, type PrescriptionCheck, type SafetyAlert } from '@/lib/clinical-safety';
import { inputClass } from '@/components/inpatient/ui';

/**
 * Live safety check of the medications being prescribed (debounced). `check` is null until the first answer;
 * `failed` when the check endpoint is unreachable (the save still runs the check server-side).
 */
export function usePrescriptionSafety(patientId: string | null | undefined, medicationIds: string[]) {
  // The answer is kept with the request it belongs to; a different request means a check is in progress
  const [answer, setAnswer] = useState<{ key: string; check: PrescriptionCheck | null; failed: boolean } | null>(null);
  const seq = useRef(0);
  const ids = [...new Set(medicationIds.filter(Boolean))].sort();
  const key = patientId && ids.length ? `${patientId}|${ids.join(',')}` : '';

  useEffect(() => {
    if (!key) return;
    const [pid, list] = key.split('|');
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      api
        .checkPrescription({ patientId: pid, items: list.split(',').map((medicationId) => ({ medicationId })) })
        .then((check) => mine === seq.current && setAnswer({ key, check, failed: false }))
        .catch(() => mine === seq.current && setAnswer({ key, check: null, failed: true }));
    }, 400);
    return () => clearTimeout(timer);
  }, [key]);

  if (!key) return { check: null, checking: false, failed: false };
  const current = answer?.key === key ? answer : null;
  return { check: current?.check ?? null, checking: !current, failed: Boolean(current?.failed) };
}

export function SafetyAlertItem({ alert }: { alert: SafetyAlert }) {
  const { t } = useLanguage();
  return (
    <li className={`p-3 rounded-lg border text-sm ${SEVERITY_STYLE[alert.severity]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/30 text-[11px] font-semibold uppercase">{t(`cs.safety.severity.${alert.severity}`)}</span>
        <span className="text-xs font-medium opacity-80">{t(`cs.safety.type.${alert.type}`)}</span>
        {alert.withCurrentTreatment && <span className="text-xs italic opacity-80">· {t('cs.safety.withCurrent')}</span>}
      </div>
      <p className="mt-1 font-medium">{alert.message}</p>
      {alert.detail && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs underline">{t('cs.safety.details')}</summary>
          <p className="mt-1 text-xs whitespace-pre-line">{alert.detail}</p>
        </details>
      )}
    </li>
  );
}

export function SafetyAlertList({ alerts }: { alerts: SafetyAlert[] }) {
  return (
    <ul className="space-y-2">
      {sortAlerts(alerts).map((a, i) => (
        <SafetyAlertItem key={`${a.type}-${a.severity}-${i}`} alert={a} />
      ))}
    </ul>
  );
}

/** Allergies always shown above the prescription lines */
export function AllergyStrip({ allergies }: { allergies: string[] }) {
  const { t } = useLanguage();
  return (
    <div className={`p-3 rounded-lg text-sm ${allergies.length ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200' : 'bg-gray-50 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300'}`}>
      <span className="font-semibold">{t('cs.allergies.title')} : </span>
      {allergies.length ? allergies.join(', ') : t('cs.allergies.none')}
    </div>
  );
}

/**
 * Check results for the prescription being written, plus the justification field when an alert blocks.
 * `alerts` overrides the live check (e.g. the alerts returned by a refused save).
 */
export function PrescriptionSafetyPanel({
  check,
  checking,
  failed,
  savedAlerts,
  override,
  onOverrideChange,
  hasItems,
}: {
  check: PrescriptionCheck | null;
  checking: boolean;
  failed: boolean;
  savedAlerts?: SafetyAlert[] | null;
  override: string;
  onOverrideChange: (value: string) => void;
  hasItems: boolean;
}) {
  const { t } = useLanguage();
  if (!hasItems) return null;
  const alerts = savedAlerts ?? check?.alerts ?? [];
  const blocking = isBlocked(check, savedAlerts);
  const tooShort = override.trim().length < OVERRIDE_MIN_LENGTH;
  return (
    <section className="space-y-3" aria-live="polite">
      <div className="flex items-center gap-2">
        <h4 className="font-semibold text-gray-900 dark:text-white">{t('cs.safety.title')}</h4>
        {checking && <span className="text-xs text-gray-500">{t('cs.safety.checking')}</span>}
      </div>
      {failed && !savedAlerts && <p className="text-sm text-amber-700 dark:text-amber-400">{t('cs.safety.failed')}</p>}
      {!failed && !checking && check && alerts.length === 0 && <p className="text-sm text-lime-700 dark:text-lime-400">{t('cs.safety.ok')}</p>}
      {alerts.length > 0 && <SafetyAlertList alerts={alerts} />}
      {blocking && (
        <div>
          <label htmlFor="rx-safety-override" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('cs.safety.overrideLabel')}</label>
          <textarea id="rx-safety-override" rows={2} value={override} onChange={(e) => onOverrideChange(e.target.value)} placeholder={t('cs.safety.overridePh')} className={inputClass} />
          {tooShort && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{t('cs.safety.overrideRequired', { min: OVERRIDE_MIN_LENGTH })}</p>}
        </div>
      )}
    </section>
  );
}

/** For the pharmacist and prescription views: what the doctor was warned about, and their justification */
export function PrescribedSafetyBox({ alerts, override }: { alerts?: SafetyAlert[] | null; override?: string | null }) {
  const { t } = useLanguage();
  const list = alerts ?? [];
  if (list.length === 0 && !override) return null;
  return (
    <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 space-y-2">
      <p className="font-semibold text-amber-900 dark:text-amber-200">{t('cs.safety.pharmacyTitle')}</p>
      {override && <p className="text-sm text-amber-900 dark:text-amber-200">{t('cs.safety.pharmacyOverride', { reason: override })}</p>}
      {list.length > 0 && <SafetyAlertList alerts={list} />}
    </div>
  );
}

/** Loads a prescription's prescribing alerts and override (for screens that only have its id, e.g. the pharmacy till) */
export function PrescriptionSafetyInfo({ prescriptionId }: { prescriptionId: string }) {
  const [info, setInfo] = useState<{ id: string; alerts?: SafetyAlert[] | null; override?: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .getPrescription(prescriptionId)
      .then((rx) => alive && setInfo({ id: prescriptionId, alerts: rx.safetyAlerts, override: rx.safetyOverride }))
      .catch(() => alive && setInfo(null));
    return () => {
      alive = false;
    };
  }, [prescriptionId]);
  if (!info || info.id !== prescriptionId) return null;
  return <PrescribedSafetyBox alerts={info.alerts} override={info.override} />;
}
