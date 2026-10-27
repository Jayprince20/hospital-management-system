'use client';

import type { ReactNode } from 'react';
import { useLanguage } from '@/context/language-context';

/** Frame for the public pages opened from an SMS link (survey, appointment confirmation): no login, phone first */
export function PublicShell({ title, children }: { title: string; children: ReactNode }) {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-bold text-lime-700 dark:text-lime-400">BB Diagnostics</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          </div>
          <button
            type="button"
            onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300"
          >
            {language === 'fr' ? 'EN' : 'FR'}
          </button>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
