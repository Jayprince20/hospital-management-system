'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/language-context';
import { AuthCard, authButtonClass, authErrorClass, authInputClass, authLabelClass, authLinkClass, authTitleClass } from '@/components/auth/auth-card';

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('auth.reset.invalidEmail'));
      return;
    }
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      // Same answer whether or not the address has an account: no way to probe who is registered
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.reset.invalidEmail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard>
      {sent ? (
        <div className="space-y-4 text-center">
          <h1 className={authTitleClass}>{t('auth.reset.sentTitle')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('auth.reset.sentText', { email: email.trim() })}</p>
          <Link href="/login" className={`inline-block text-sm ${authLinkClass}`}>
            {t('auth.reset.backToLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6" noValidate>
          <div>
            <h1 className={authTitleClass}>{t('auth.reset.forgotTitle')}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-muted dark:text-gray-400">{t('auth.reset.forgotText')}</p>
          </div>
          {error && (
            <div role="alert" className={authErrorClass}>
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className={authLabelClass}>
              {t('auth.reset.email')}
            </label>
            <input id="email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={authInputClass} />
          </div>
          <button type="submit" disabled={busy} className={authButtonClass}>
            {busy ? t('auth.reset.sending') : t('auth.reset.send')}
          </button>
          <p className="text-center">
            <Link href="/login" className={`text-sm ${authLinkClass}`}>
              {t('auth.reset.backToLogin')}
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
