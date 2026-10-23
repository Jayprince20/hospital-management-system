'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { ThemeToggle } from '@/context/theme-context';
import { LanguageToggle, useLanguage } from '@/context/language-context';
import { ApiError } from '@/lib/api';

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-colors';

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Second step, when the account has two-factor authentication
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const { login, verifyMfa, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const timedOut = useSearchParams().get('reason') === 'timeout';
  // Signed-in users are sent on by the auth context (dashboard, password change or 2FA setup)

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-lime-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('admin.login.loading')}</p>
        </div>
      </div>
    );
  }

  // Don't render login form if already authenticated (waiting for redirect)
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-lime-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('admin.login.redirectingToDashboard')}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login({ email, password, rememberMe });
      if (result.mfaRequired) {
        setMfaToken(result.mfaToken);
        setCode('');
        setUseRecovery(false);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(t('auth.invalidCredentials'));
      } else {
        setError(err instanceof Error ? err.message : t('auth.loginFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError('');
    setIsLoading(true);
    try {
      await verifyMfa(useRecovery ? { mfaToken, recoveryCode: code.trim() } : { mfaToken, code: code.trim() });
    } catch (err) {
      // An expired or locked challenge sends the user back to the password step
      if (err instanceof ApiError && err.status === 401 && /sign in again|reconnect|expir|trop|too many/i.test(err.message)) {
        setMfaToken(null);
        setPassword('');
      }
      setError(err instanceof Error ? err.message : t('security.login.verifyFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const backToPassword = () => {
    setMfaToken(null);
    setCode('');
    setError('');
  };

  const spinner = (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-lime-100 dark:from-gray-900 dark:to-gray-800 px-4 relative">
      {/* Theme and Language Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/images/logo-bbdt.png"
              alt="BB Diagnostics"
              width={200}
              height={70}
              className="object-contain"
              priority
            />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Centre Médical - {t('auth.loginSubtitle')}
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {timedOut && !error && !mfaToken && (
            <div className="mb-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-lg text-sm">
              {t('security.login.timeoutNotice')}
            </div>
          )}
          {mfaToken ? (
            <form onSubmit={handleVerify} className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('security.login.codeTitle')}</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {useRecovery ? t('security.login.recoveryHint') : t('security.login.codeSubtitle')}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {useRecovery ? t('security.login.recoveryLabel') : t('security.login.codeLabel')}
                </label>
                {useRecovery ? (
                  <input
                    key="recovery"
                    id="mfa-code"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoFocus
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="XXXXX-XXXXX"
                    maxLength={11}
                    className={`${inputClass} font-mono tracking-widest text-center`}
                  />
                ) : (
                  <input
                    key="totp"
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    autoFocus
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className={`${inputClass} font-mono text-2xl tracking-[0.5em] text-center`}
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || (!useRecovery && code.length !== 6) || (useRecovery && code.trim().length < 11)}
                className="w-full py-3 px-4 bg-lime-600 hover:bg-lime-700 disabled:bg-lime-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    {spinner}
                    {t('security.login.verifying')}
                  </span>
                ) : (
                  t('security.login.verify')
                )}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={backToPassword} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  {t('security.login.back')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseRecovery(!useRecovery);
                    setCode('');
                    setError('');
                  }}
                  className="text-lime-600 dark:text-lime-400 hover:text-lime-500"
                >
                  {useRecovery ? t('security.login.useCode') : t('security.login.useRecovery')}
                </button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-colors"
                placeholder={t('admin.login.enterYourEmail')}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-colors"
                placeholder={t('admin.login.enterYourPassword')}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('auth.rememberMe')}
                </span>
              </label>
              <Link
                href="/forgot-password"
                className="text-sm text-lime-600 dark:text-lime-400 hover:text-lime-500"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-lime-600 hover:bg-lime-700 disabled:bg-lime-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  {spinner}
                  {t('auth.signingIn')}
                </span>
              ) : (
                t('auth.login')
              )}
            </button>
          </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          {t('auth.needHelp')}
        </p>
      </div>
    </div>
  );
}
