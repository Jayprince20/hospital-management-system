'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ThemeToggle } from '@/context/theme-context';
import { LanguageToggle, useLanguage } from '@/context/language-context';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';

type Enrollment = { qrDataUrl: string; secret: string };

const MFA_REQUIRED_ROLES = ['ADMIN', 'DOCTOR'];

export default function SetupTwoFactorPage() {
  const { user, isLoading: authLoading, refreshUser, logout } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const router = useRouter();

  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loadError, setLoadError] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [savedCodes, setSavedCodes] = useState(false);
  const [copied, setCopied] = useState<'secret' | 'codes' | null>(null);
  const started = useRef(false);

  const startEnrollment = () => {
    setLoadError('');
    api
      .setupMfa()
      .then((data) => setEnrollment({ qrDataUrl: data.qrDataUrl, secret: data.secret }))
      .catch((err) => setLoadError(err instanceof Error ? err.message : t('security.setup.failed')));
  };

  // One enrolment per visit: a second call would replace the secret behind the QR code
  useEffect(() => {
    if (authLoading || !user || user.mfaEnabled || started.current) return;
    started.current = true;
    startEnrollment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const copy = async (text: string, what: 'secret' | 'codes') => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const activate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsActivating(true);
    try {
      const result = await api.enableMfa(code);
      setRecoveryCodes(result.recoveryCodes);
      toast.success(t('security.setup.enabledToast'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('security.setup.failed'));
    } finally {
      setIsActivating(false);
    }
  };

  const downloadCodes = () => {
    if (!recoveryCodes) return;
    const text = [
      t('security.setup.codesFileHeader', { email: user?.email ?? '' }),
      '',
      ...recoveryCodes,
      '',
      t('security.setup.codesFileFooter'),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bb-diagnostics-codes-de-secours.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const finish = async () => {
    await refreshUser();
    router.push('/dashboard');
  };

  const required = MFA_REQUIRED_ROLES.includes(user?.role ?? '');
  const groupedSecret = enrollment?.secret.match(/.{1,4}/g)?.join(' ') ?? '';
  const card = 'bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6';
  const button =
    'px-4 py-2.5 bg-lime-600 hover:bg-lime-700 disabled:bg-lime-400 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed';
  const secondary =
    'px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-lime-100 dark:from-gray-900 dark:to-gray-800 px-4 py-10 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Image src="/images/logo-bbdt.png" alt="BB Diagnostics" width={180} height={63} className="object-contain" priority />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('security.setup.title')}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {required ? t('security.setup.introRequired') : t('security.setup.introOptional')}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('security.setup.introApps')}</p>
        </div>

        {recoveryCodes ? (
          <div className={card}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('security.setup.step3Title')}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('security.setup.step3Hint')}</p>
            <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((recovery) => (
                <li key={recovery} className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-center">
                  {recovery}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => copy(recoveryCodes.join('\n'), 'codes')} className={secondary}>
                {copied === 'codes' ? t('security.setup.copied') : t('security.setup.copyCodes')}
              </button>
              <button type="button" onClick={downloadCodes} className={secondary}>
                {t('security.setup.downloadCodes')}
              </button>
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={savedCodes}
                onChange={(e) => setSavedCodes(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
              />
              {t('security.setup.savedConfirm')}
            </label>
            <button type="button" onClick={finish} disabled={!savedCodes} className={`${button} mt-4 w-full`}>
              {t('security.setup.continue')}
            </button>
          </div>
        ) : (
          <>
            <div className={card}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('security.setup.step1Title')}</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('security.setup.step1Hint')}</p>
              {loadError ? (
                <div className="mt-4 text-sm text-red-700 dark:text-red-400">
                  <p>{loadError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      started.current = true;
                      startEnrollment();
                    }}
                    className={`${secondary} mt-3`}
                  >
                    {t('security.setup.retry')}
                  </button>
                </div>
              ) : enrollment ? (
                <div className="mt-4 flex flex-col items-center gap-4">
                  {/* A data URL from the API, so next/image optimisation does not apply */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enrollment.qrDataUrl} alt={t('security.setup.qrAlt')} width={220} height={220} className="rounded-lg bg-white p-2" />
                  <div className="w-full">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('security.setup.manualLabel')}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono break-all">
                        {groupedSecret}
                      </code>
                      <button type="button" onClick={() => copy(enrollment.secret, 'secret')} className={secondary}>
                        {copied === 'secret' ? t('security.setup.copied') : t('security.setup.copy')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t('security.setup.preparing')}</p>
              )}
            </div>

            <form onSubmit={activate} className={card}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('security.setup.step2Title')}</h2>
              {error && (
                <div className="mt-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="mt-4 flex gap-3">
                <input
                  aria-label={t('security.login.codeLabel')}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  disabled={!enrollment}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xl tracking-[0.4em] text-center focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                />
                <button type="submit" disabled={!enrollment || code.length !== 6 || isActivating} className={button}>
                  {isActivating ? t('security.setup.activating') : t('security.setup.activate')}
                </button>
              </div>
            </form>
          </>
        )}

        <p className="text-center">
          <button type="button" onClick={logout} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            {t('security.setup.logout')}
          </button>
        </p>
      </div>
    </div>
  );
}
