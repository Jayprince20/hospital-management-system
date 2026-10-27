'use client';

import Link from 'next/link';
import { useActingPatient } from '@/context/acting-patient-context';
import { useLanguage } from '@/context/language-context';

/** Shown on every portal page while a patient account looks at a relative's record */
export function ActingBanner() {
  const { acting, setActing, canSeeClinical } = useActingPatient();
  const { t } = useLanguage();
  if (!acting) return null;
  const name = `${acting.firstName} ${acting.lastName}`.trim();
  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-3 rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-3 text-sky-900 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-semibold">
          {t('fam.banner.viewing', { name, relationship: t(`fam.relative.${acting.relationship}`) })}
        </p>
        <p className="text-sm opacity-90">{canSeeClinical ? t('fam.banner.full') : t('fam.banner.limited')}</p>
      </div>
      <button
        type="button"
        onClick={() => setActing(null)}
        className="self-start rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 sm:self-auto"
      >
        {t('fam.banner.back')}
      </button>
    </div>
  );
}

/** In place of a page only the record owner may use (profile, security, family, consents) */
export function OwnerOnlyNotice() {
  const { setActing } = useActingPatient();
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('fam.ownerOnly.title')}</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t('fam.ownerOnly.text')}</p>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" onClick={() => setActing(null)} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
          {t('fam.banner.back')}
        </button>
        <Link href="/dashboard" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
          {t('fam.ownerOnly.home')}
        </Link>
      </div>
    </div>
  );
}

/** For a clinical page opened with an appointments-and-billing family access */
export function ClinicalAccessNotice() {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      {t('fam.clinicalHidden')}
    </div>
  );
}
