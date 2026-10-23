'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { ThemeToggle } from '@/context/theme-context';
import { LanguageToggle } from '@/context/language-context';

/** The centred card used by the public sign-in pages (login, forgot and reset password) */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-lime-100 dark:from-gray-900 dark:to-gray-800 px-4 py-12 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image src="/images/logo-bbdt.png" alt="BB Diagnostics" width={200} height={70} className="object-contain" priority />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">{children}</div>
      </div>
    </div>
  );
}

export const authInputClass =
  'w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-colors';

export const authButtonClass =
  'w-full py-3 px-4 bg-lime-600 hover:bg-lime-700 disabled:bg-lime-400 text-white font-medium rounded-lg transition-colors';
