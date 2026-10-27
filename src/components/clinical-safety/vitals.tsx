'use client';

import { useEffect, useState } from 'react';
import { api, type VitalSign } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { VITAL_FLAG_STYLE, isCriticalFlag, worstFlag, type VitalFlag } from '@/lib/clinical-safety';
import { cardClass } from '@/components/inpatient/ui';

/** Badges for the flags of one reading (critical first) */
export function VitalFlagBadges({ flags }: { flags?: VitalFlag[] }) {
  if (!flags || flags.length === 0) return null;
  const sorted = [...flags].sort((a, b) => Number(isCriticalFlag(b)) - Number(isCriticalFlag(a)));
  return (
    <span className="inline-flex flex-wrap gap-1">
      {sorted.map((f, i) => (
        <span key={`${f.field}-${i}`} className={`px-1.5 py-0.5 rounded text-xs font-medium ${VITAL_FLAG_STYLE[f.level]}`}>
          {f.message}
        </span>
      ))}
    </span>
  );
}

/** Class for a vital value: red when critical, amber when abnormal */
export function vitalValueClass(flags: VitalFlag[] | undefined, field: string): string {
  const flag = worstFlag(flags, field);
  if (!flag) return 'text-gray-900 dark:text-white';
  return isCriticalFlag(flag) ? 'text-red-600 dark:text-red-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-semibold';
}

/** Latest vital signs of a patient with abnormal values highlighted (consultation form) */
export function LatestVitalsCard({ patientId }: { patientId: string }) {
  const { t, formatDate, formatTime } = useLanguage();
  const [reading, setReading] = useState<VitalSign | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    api
      .getVitals({ patientId, limit: 1 })
      .then((res) => alive && setReading(res.vitals[0] ?? null))
      .catch(() => alive && setReading(null));
    return () => {
      alive = false;
    };
  }, [patientId]);

  if (reading === undefined) return null;
  const flags = reading?.flags ?? [];
  const critical = flags.some(isCriticalFlag);
  const items: Array<{ field: string; label: string; value: string | null }> = reading
    ? [
        { field: 'bloodPressure', label: t('cs.vitals.bp'), value: reading.bloodPressureSys != null && reading.bloodPressureDia != null ? `${reading.bloodPressureSys}/${reading.bloodPressureDia} mmHg` : null },
        { field: 'heartRate', label: t('cs.vitals.hr'), value: reading.heartRate != null ? `${reading.heartRate} bpm` : null },
        { field: 'temperature', label: t('cs.vitals.temp'), value: reading.temperature != null ? `${reading.temperature} °C` : null },
        { field: 'respiratoryRate', label: t('cs.vitals.rr'), value: reading.respiratoryRate != null ? `${reading.respiratoryRate} /min` : null },
        { field: 'oxygenSaturation', label: t('cs.vitals.spo2'), value: reading.oxygenSaturation != null ? `${reading.oxygenSaturation} %` : null },
        { field: 'weight', label: t('cs.vitals.weight'), value: reading.weight != null ? `${reading.weight} kg` : null },
      ].filter((i) => i.value)
    : [];

  return (
    <div className={`${cardClass} p-4 ${critical ? 'border-red-300 dark:border-red-800' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">{t('cs.vitals.title')}</h3>
        {reading && <span className="text-xs text-gray-500 dark:text-gray-400">{t('cs.vitals.recordedAt', { date: `${formatDate(reading.recordedAt)} ${formatTime(reading.recordedAt)}` })}</span>}
      </div>
      {!reading && <p className="text-sm text-gray-500 dark:text-gray-400">{t('cs.vitals.none')}</p>}
      {reading && (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {items.map((i) => (
              <div key={i.field}>
                <dt className="text-xs text-gray-500 dark:text-gray-400">{i.label}</dt>
                <dd className={`text-sm tabular-nums ${i.field === 'bloodPressure' ? bpValueClass(flags) : vitalValueClass(flags, i.field)}`}>{i.value}</dd>
              </div>
            ))}
          </dl>
          {flags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`text-xs font-semibold ${critical ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {critical ? t('cs.vitals.critical') : t('cs.vitals.abnormal')}
              </span>
              <VitalFlagBadges flags={flags} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Blood pressure is flagged on its systolic and diastolic fields */
export function bpValueClass(flags: VitalFlag[] | undefined): string {
  const sys = vitalValueClass(flags, 'bloodPressureSys');
  const dia = vitalValueClass(flags, 'bloodPressureDia');
  if (sys.includes('red') || dia.includes('red')) return 'text-red-600 dark:text-red-400 font-bold';
  if (sys.includes('amber') || dia.includes('amber')) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-gray-900 dark:text-white';
}
