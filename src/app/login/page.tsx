'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { ApiError } from '@/lib/api';
import {
  AuthShell,
  OtpInput,
  PasswordInput,
  authButtonClass,
  authErrorClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authTitleClass,
} from '@/components/auth/auth-card';

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
      <div className="min-h-screen flex items-center justify-center bg-canvas dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand dark:border-lime-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('admin.login.loading')}</p>
        </div>
      </div>
    );
  }

  // Don't render login form if already authenticated (waiting for redirect)
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand dark:border-lime-400 mx-auto"></div>
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
    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  if (mfaToken) {
    return (
      <AuthShell
        variant="mfa"
        topLeft={
          <button type="button" onClick={backToPassword} className="flex items-center gap-2 text-sm font-medium text-[#2A3830] dark:text-gray-300 hover:text-ink dark:hover:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12H5M11 18l-6-6 6-6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('security.login.back')}
          </button>
        }
      >
        <form onSubmit={handleVerify} className="flex flex-col gap-6">
          <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-line dark:border-gray-700 rounded-2xl">
            <span aria-hidden="true" className="w-10 h-10 rounded-full bg-blue-100 text-blue-900 font-bold text-sm flex items-center justify-center shrink-0">
              {email.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <span className="flex-1 min-w-0 text-sm text-ink-muted dark:text-gray-400 truncate">{email}</span>
            <span className="text-xs text-ink-muted dark:text-gray-400 whitespace-nowrap">{t('shell.otp.step')}</span>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className={authTitleClass}>{t('security.login.codeTitle')}</h2>
            <p className="text-[15px] leading-relaxed text-ink-muted dark:text-gray-400">
              {useRecovery ? t('security.login.recoveryHint') : t('security.login.codeSubtitle')}
            </p>
          </div>

          {error && (
            <div role="alert" className={authErrorClass}>
              {error}
            </div>
          )}

          {useRecovery ? (
            <div>
              <label htmlFor="mfa-code" className={authLabelClass}>
                {t('security.login.recoveryLabel')}
              </label>
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
                className={`${authInputClass} font-mono tracking-widest text-center`}
              />
            </div>
          ) : (
            <OtpInput key="totp" value={code} onChange={setCode} autoFocus />
          )}

          <button
            type="submit"
            disabled={isLoading || (!useRecovery && code.length !== 6) || (useRecovery && code.trim().length < 11)}
            className={authButtonClass}
          >
            {isLoading ? (
              <>
                {spinner}
                {t('security.login.verifying')}
              </>
            ) : (
              t('security.login.verify')
            )}
          </button>

          <div className="flex gap-3 items-start p-4 rounded-[14px] bg-[#EEF2EC] dark:bg-gray-800">
            <svg className="w-[18px] h-[18px] mt-0.5 shrink-0 text-[#2A3830] dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex flex-col gap-1 text-[13px] leading-relaxed text-[#2A3830] dark:text-gray-300">
              <span className="font-semibold">{t('shell.otp.lostTitle')}</span>
              <span>{t('shell.otp.lostText')}</span>
              <button
                type="button"
                onClick={() => {
                  setUseRecovery(!useRecovery);
                  setCode('');
                  setError('');
                }}
                className={`self-start ${authLinkClass}`}
              >
                {useRecovery ? t('security.login.useCode') : t('security.login.useRecovery')}
              </button>
            </div>
          </div>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="flex flex-col gap-[22px]">
        <div className="flex flex-col gap-2">
          <h2 className={authTitleClass}>{t('shell.login.title')}</h2>
          <p className="text-[15px] leading-relaxed text-ink-muted dark:text-gray-400">{t('shell.login.subtitle')}</p>
        </div>

        {timedOut && !error && (
          <div role="status" className="rounded-[14px] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-300">
            {t('security.login.timeoutNotice')}
          </div>
        )}

        {error && (
          <div role="alert" className={authErrorClass}>
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className={authLabelClass}>
            {t('auth.email')}
          </label>
          <div className="relative">
            <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-muted dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2" y="4" width="20" height="16" rx="2" strokeWidth={2} />
              <path d="m22 7-10 6L2 7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className={`${authInputClass} pl-11`}
              placeholder={t('admin.login.enterYourEmail')}
            />
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label htmlFor="password" className="text-[13px] font-semibold text-[#2A3830] dark:text-gray-300">
              {t('auth.password')}
            </label>
            <Link href="/forgot-password" className={`text-[13px] ${authLinkClass}`}>
              {t('auth.forgotPassword')}
            </Link>
          </div>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" placeholder={t('admin.login.enterYourPassword')} required />
        </div>

        <label className="flex items-center gap-2.5 text-sm text-[#2A3830] dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-[18px] h-[18px] m-0 accent-[#14532D]" />
          {t('auth.rememberMe')}
        </label>

        <button type="submit" disabled={isLoading} className={authButtonClass}>
          {isLoading ? (
            <>
              {spinner}
              {t('auth.signingIn')}
            </>
          ) : (
            <>
              {t('auth.login')}
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
