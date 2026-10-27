'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { AuthCard, authButtonClass, authErrorClass, authInputClass, authLabelClass, authLinkClass, authTitleClass } from '@/components/auth/auth-card';
import { PASSWORD_RULES, passwordMeetsRules } from '@/lib/password-rules';

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const { t } = useLanguage();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!passwordMeetsRules(password)) {
      setError(t('auth.reset.weak'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.reset.mismatch'));
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword({ token, newPassword: password, confirmPassword: confirm });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.reset.missingToken'));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthCard>
        <div className="space-y-4 text-center">
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('auth.reset.missingToken')}</p>
          <Link href="/forgot-password" className={`inline-block text-sm ${authLinkClass}`}>
            {t('auth.reset.requestNew')}
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard>
        <div className="space-y-4 text-center">
          <h1 className={authTitleClass}>{t('auth.reset.doneTitle')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('auth.reset.doneText')}</p>
          <Link href="/login" className={`${authButtonClass} inline-block`}>
            {t('auth.reset.goLogin')}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <h1 className={authTitleClass}>{t('auth.reset.resetTitle')}</h1>
        {error && (
          <div role="alert" className={authErrorClass}>
            {error}
            {/expir|invalid/i.test(error) && (
              <Link href="/forgot-password" className="ml-1 font-medium underline">
                {t('auth.reset.requestNew')}
              </Link>
            )}
          </div>
        )}
        <div>
          <label htmlFor="password" className={authLabelClass}>
            {t('auth.reset.newPassword')}
          </label>
          <input id="password" type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className={authInputClass} />
        </div>
        <div>
          <label htmlFor="confirm" className={authLabelClass}>
            {t('auth.reset.confirmPassword')}
          </label>
          <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={authInputClass} />
        </div>
        <div className="text-sm">
          <p className="text-gray-600 dark:text-gray-400">{t('auth.reset.rules')}</p>
          <ul className="mt-1 space-y-0.5">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li key={rule.key} className={ok ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
                  <span aria-hidden="true">{ok ? '✓' : '•'}</span> {t(`auth.reset.rule.${rule.key}`)}
                </li>
              );
            })}
          </ul>
        </div>
        <button type="submit" disabled={busy} className={authButtonClass}>
          {busy ? t('auth.reset.saving') : t('auth.reset.submit')}
        </button>
      </form>
    </AuthCard>
  );
}
