'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { api } from '@/lib/api';
import { AuthShell, PasswordInput, authButtonClass, authErrorClass, authLabelClass, authTitleClass } from '@/components/auth/auth-card';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { user, isLoading: authLoading, mustChangePassword, clearMustChangePassword, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  // Password validation
  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return t('admin.pwd.min8');
    }
    if (!/[A-Z]/.test(password)) {
      return t('admin.pwd.upper');
    }
    if (!/[a-z]/.test(password)) {
      return t('admin.pwd.lower');
    }
    if (!/[0-9]/.test(password)) {
      return t('admin.pwd.number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return t('admin.pwd.special');
    }
    return null;
  };

  // Check password requirements for visual feedback
  const passwordRequirements = [
    { label: t('admin.pwd.req8'), met: newPassword.length >= 8 },
    { label: t('admin.pwd.reqUpper'), met: /[A-Z]/.test(newPassword) },
    { label: t('admin.pwd.reqLower'), met: /[a-z]/.test(newPassword) },
    { label: t('admin.pwd.reqNumber'), met: /[0-9]/.test(newPassword) },
    { label: t('admin.pwd.reqSpecial'), met: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) },
  ];

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand dark:border-lime-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('admin.pwd.loading')}</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    router.push('/login');
    return null;
  }

  // Redirect if password change not required
  if (!mustChangePassword) {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate new password
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      setError(t('admin.pwd.mismatch'));
      return;
    }

    // Check if new password is different from current
    if (currentPassword === newPassword) {
      setError(t('admin.pwd.sameAsOld'));
      return;
    }

    setIsLoading(true);

    try {
      await api.changePassword({
        currentPassword,
        newPassword,
      });

      // Clear the mustChangePassword flag and redirect
      clearMustChangePassword();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.pwd.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className={authTitleClass}>{t('admin.pwd.changeYourPassword')}</h2>
          <p className="text-[15px] leading-relaxed text-ink-muted dark:text-gray-400">{t('admin.pwd.forSecurityReasonsPleaseChangeYour')}</p>
        </div>

        <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-line dark:border-gray-700 rounded-2xl text-sm">
          <span aria-hidden="true" className="w-10 h-10 rounded-full bg-green-100 text-brand font-bold flex items-center justify-center shrink-0">
            {user.email.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 text-ink-muted dark:text-gray-400">
            {t('shell.signedInAs')} <span className="font-semibold text-ink dark:text-white">{user.email}</span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div role="alert" className={authErrorClass}>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="currentPassword" className={authLabelClass}>
              {t('admin.pwd.currentPasswordTemporaryPassword')}
            </label>
            <PasswordInput id="currentPassword" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" placeholder={t('admin.pwd.enterYourTemporaryPassword')} required />
          </div>

          <div>
            <label htmlFor="newPassword" className={authLabelClass}>
              {t('admin.pwd.newPassword')}
            </label>
            <PasswordInput id="newPassword" value={newPassword} onChange={setNewPassword} autoComplete="new-password" placeholder={t('admin.pwd.enterYourNewPassword')} required />
            {newPassword && (
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
                {passwordRequirements.map((req, index) => (
                  <li key={index} className={`flex items-center gap-2 text-[13px] ${req.met ? 'text-green-800 dark:text-green-400' : 'text-ink-muted dark:text-gray-400'}`}>
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      {req.met ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" /> : <circle cx="12" cy="12" r="9" strokeWidth={2} />}
                    </svg>
                    {req.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className={authLabelClass}>
              {t('admin.pwd.confirmNewPassword')}
            </label>
            <PasswordInput id="confirmPassword" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" placeholder={t('admin.pwd.confirmYourNewPassword')} required />
            {confirmPassword && confirmPassword !== newPassword && <p className="mt-1.5 text-[13px] text-red-700 dark:text-red-400">{t('admin.pwd.passwordsDoNotMatch')}</p>}
            {confirmPassword && confirmPassword === newPassword && <p className="mt-1.5 text-[13px] text-green-800 dark:text-green-400">{t('admin.pwd.passwordsMatch')}</p>}
          </div>

          <button type="submit" disabled={isLoading || !passwordRequirements.every((r) => r.met) || newPassword !== confirmPassword} className={authButtonClass}>
            {isLoading ? t('admin.pwd.changingPassword') : t('admin.pwd.change')}
          </button>
        </form>

        <button type="button" onClick={handleLogout} className="self-center text-sm text-ink-muted dark:text-gray-400 hover:text-brand dark:hover:text-lime-400 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          {t('admin.pwd.signOutAndUseADifferent')}
        </button>
      </div>
    </AuthShell>
  );
}
