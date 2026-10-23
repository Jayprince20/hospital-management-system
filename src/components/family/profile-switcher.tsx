'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useActingPatient } from '@/context/acting-patient-context';
import { useLanguage } from '@/context/language-context';

/**
 * Header control for patient accounts that may act for relatives: "Mon dossier" or a relative.
 * Hidden for staff and for patients without family links.
 */
export function ProfileSwitcher() {
  const { user } = useAuth();
  const { links, acting, setActing } = useActingPatient();
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (user?.role !== 'PATIENT' || links.length === 0) return null;

  const current = acting ? `${acting.firstName} ${acting.lastName}`.trim() : t('fam.switcher.me');

  const choose = (patientId: string | null) => {
    setOpen(false);
    const link = patientId ? links.find((l) => l.patient.id === patientId) ?? null : null;
    if ((link?.patient.id ?? null) === (acting?.patientId ?? null)) return;
    setActing(link);
    // Owner-only pages make no sense for a relative: land on the portal home
    router.push('/dashboard');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
          acting
            ? 'border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-600 dark:bg-sky-900/30 dark:text-sky-100'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="max-w-[10rem] truncate">{current}</span>
        <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul role="listbox" aria-label={t('fam.switcher.label')} className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <li className="px-3 py-1.5 text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{t('fam.switcher.label')}</li>
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!acting}
                onClick={() => choose(null)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${!acting ? 'font-semibold text-lime-700 dark:text-lime-400' : 'text-gray-700 dark:text-gray-300'}`}
              >
                <span>{t('fam.switcher.me')}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{user.firstName}</span>
              </button>
            </li>
            {links.map((link) => {
              const selected = acting?.patientId === link.patient.id;
              return (
                <li key={link.linkId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => choose(link.patient.id)}
                    className={`flex w-full flex-col px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${selected ? 'font-semibold text-sky-700 dark:text-sky-300' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    <span>
                      {link.patient.firstName} {link.patient.lastName}
                    </span>
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                      {t(`fam.relativeCap.${link.relationship}`)} · {t(`fam.level.${link.accessLevel}`)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
