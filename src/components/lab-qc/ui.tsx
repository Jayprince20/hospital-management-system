'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { isBiologistProfile } from '@/lib/lab';
import { qcStatusMeta, testStatusMeta, type LabTestRef, type QcWarning, qcWarningLines } from '@/lib/lab-qc';

export { DialogShell, ErrorBox, cancelBtn, cardClass, dangerBtn, inputClass, labelClass, messageOf, primaryBtn, smallBtn } from '@/components/inpatient/ui';

export const selectClass =
  'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-lime-500 focus:border-transparent';

/**
 * Who may use the QC pages: lab technicians and the administration, and doctors who are
 * biologists (lab/biology department or speciality — the server decides the same way).
 * `ready` is false while a doctor's profile is still being checked.
 */
export function useLabStaff(): { ready: boolean; isTech: boolean; isAdmin: boolean; isBiologist: boolean; canUseQc: boolean } {
  const { user } = useAuth();
  const role = user?.role;
  const doctorId = role === 'DOCTOR' ? user?.doctorId : undefined;
  const [checked, setChecked] = useState<{ doctorId: string; biologist: boolean } | null>(null);
  useEffect(() => {
    if (!doctorId) return;
    let live = true;
    api
      .getDoctor(doctorId)
      .then((d) => live && setChecked({ doctorId, biologist: isBiologistProfile(d.department, d.specializations) }))
      .catch(() => live && setChecked({ doctorId, biologist: false }));
    return () => {
      live = false;
    };
  }, [doctorId]);
  const isAdmin = role === 'ADMIN';
  const isTech = role === 'LAB_TECH';
  const isBiologist = Boolean(doctorId) && checked?.doctorId === doctorId && checked?.biologist === true;
  const ready = Boolean(user) && (!doctorId || checked?.doctorId === doctorId);
  return { ready, isTech, isAdmin, isBiologist, canUseQc: isAdmin || isTech || isBiologist };
}

/** Active lab tests for pickers (id, code, name, unit) */
export function useLabTestOptions(): LabTestRef[] {
  const [tests, setTests] = useState<LabTestRef[]>([]);
  useEffect(() => {
    let live = true;
    api
      .getLabTests({ isActive: true, limit: 500 })
      .then((res) => {
        const list = (res as unknown as { labTests?: LabTestRef[]; data?: LabTestRef[] }).labTests ?? (res as unknown as { data?: LabTestRef[] }).data ?? [];
        if (live) setTests([...list].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
      })
      .catch(() => live && setTests([]));
    return () => {
      live = false;
    };
  }, []);
  return tests;
}

export function QcStatusChip({ status }: { status: string | null | undefined }) {
  const { t } = useLanguage();
  const meta = qcStatusMeta(status);
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.className}`}>{t(meta.labelKey)}</span>;
}

export function TestStatusLabel({ status }: { status: string }) {
  const { t } = useLanguage();
  const meta = testStatusMeta(status);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.colour }} aria-hidden="true" />
      {t(meta.labelKey)}
    </span>
  );
}

/** "Automate" chip on a result that came from an analyser */
export function InstrumentBadge({ code }: { code?: string | null }) {
  const { t } = useLanguage();
  return (
    <span
      title={t('labw.instrument.badgeTitle', { code: code ?? '—' })}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
      {t('labw.instrument.badge')}
      {code ? <span className="font-mono font-normal">{code}</span> : null}
    </span>
  );
}

/** Shown after a validation the server accepted although QC was not in control ('warn' mode) */
export function QcWarningBanner({ warning, onDismiss }: { warning: QcWarning; onDismiss: () => void }) {
  const { t } = useLanguage();
  const lines = qcWarningLines(warning);
  if (lines.length === 0) return null;
  return (
    <div role="alert" className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{t('qc.validate.warningTitle')}</p>
          <p className="mt-0.5">{t('qc.validate.warningBody')}</p>
          <ul className="mt-1 list-disc pl-5">
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={onDismiss} className="text-amber-800 dark:text-amber-200 hover:underline text-xs shrink-0" aria-label={t('common.close')}>
          ✕
        </button>
      </div>
    </div>
  );
}
