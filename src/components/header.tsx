'use client';

import { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { ThemeToggle } from '@/context/theme-context';
import { LanguageToggle, useLanguage } from '@/context/language-context';
import { NotificationBell } from '@/components/notifications';
import { GlobalSearch } from '@/components/global-search';
import { ProfileSwitcher } from '@/components/family';
import { OnCallButton } from '@/components/rosters/on-call';
import { useActingPatient } from '@/context/acting-patient-context';

export function Header() {
  const { user, logout } = useAuth();
  const { t, tEnum } = useLanguage();
  const [showDropdown, setShowDropdown] = useState(false);
  // While acting for a relative the account's own pages are out of reach
  const { isActing } = useActingPatient();

  return (
    <header className="sticky top-0 z-30 bg-canvas/85 dark:bg-gray-900/85 backdrop-blur border-b border-line/70 dark:border-gray-800">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 h-[72px]">
        {/* Search */}
        <div className="flex items-center gap-3 flex-1 min-w-0 max-w-lg">
          {/* Mobile: the brand mark stands in for the hidden sidebar */}
          <span aria-hidden="true" className="lg:hidden w-9 h-9 rounded-xl bg-accent text-on-accent font-extrabold text-sm flex items-center justify-center shrink-0">BB</span>
          <div className="flex-1 min-w-0">
            <GlobalSearch />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4">
          {/* Family access: whose record the patient is looking at */}
          <ProfileSwitcher />

          {/* Language and theme: hidden on the narrowest screens to keep the bar on one line */}
          <span className="hidden sm:flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
          </span>

          {/* Who is on call now (staff only) */}
          <OnCallButton />

          {/* Notifications */}
          <NotificationBell />

          {/* User Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              aria-haspopup="menu"
              aria-expanded={showDropdown}
              className="flex items-center gap-3 p-1.5 sm:pr-3 bg-white dark:bg-gray-800 border border-line dark:border-gray-700 hover:border-brand/40 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <span className="text-brand dark:text-lime-400 font-bold text-[13px]">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-ink dark:text-white">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-ink-muted dark:text-gray-400">{tEnum(user?.role)}</p>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  showDropdown ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDropdown(false)}
                />
                <div role="menu" className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-line dark:border-gray-700 p-1.5 z-20">
                  {!isActing && (<>
                  <a
                    href="/dashboard/profile"
                    role="menuitem" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink dark:text-gray-300 hover:bg-canvas dark:hover:bg-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    {t('settings.profile')}
                  </a>
                  <a
                    href="/dashboard/settings"
                    role="menuitem" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink dark:text-gray-300 hover:bg-canvas dark:hover:bg-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {t('nav.settings')}
                  </a>
                  </>)}
                  <hr className="my-1 border-line dark:border-gray-700" />
                  <button
                    onClick={logout}
                    role="menuitem" className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-700 dark:text-red-400 hover:bg-canvas dark:hover:bg-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    {t('auth.logout')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
