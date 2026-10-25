'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { AuthShell, OtpInput, authButtonClass, authErrorClass, authTitleClass } from '@/components/auth/auth-card';
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
  const card = 'bg-white dark:bg-gray-800 border border-line dark:border-gray-700 rounded-2xl p-5';
  const stepTitle = 'flex items-center gap-2.5 text-base font-bold text-ink dark:text-white';
  const stepNumber = 'w-7 h-7 rounded-full bg-brand text-white text-[13px] font-bold flex items-center justify-center shrink-0';
  const secondary =
    'h-10 px-3.5 text-sm font-semibold rounded-xl border-[1.5px] border-line dark:border-gray-600 text-ink dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-canvas dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

  return (
    <AuthShell variant="mfa">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 className={authTitleClass}>{t('security.setup.title')}</h2>
          <p className="text-[15px] leading-relaxed text-ink-muted dark:text-gray-400">
            {required ? t('security.setup.introRequired') : t('security.setup.introOptional')} {t('security.setup.introApps')}
          </p>
        </div>

        {recoveryCodes ? (
          <div className={card}>
            <h3 className={stepTitle}>
              <span aria-hidden="true" className={stepNumber}>3</span>
              {t('security.setup.step3Title')}
            </h3>
            <p className="mt-1.5 text-sm text-ink-muted dark:text-gray-400">{t('security.setup.step3Hint')}</p>
            <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((recovery) => (
                <li key={recovery} className="px-3 py-2 rounded-xl bg-canvas dark:bg-gray-700 text-ink dark:text-white text-center">
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
            <label className="mt-5 flex items-center gap-2.5 text-sm text-[#2A3830] dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={savedCodes} onChange={(e) => setSavedCodes(e.target.checked)} className="w-[18px] h-[18px] m-0 accent-[#14532D]" />
              {t('security.setup.savedConfirm')}
            </label>
            <button type="button" onClick={finish} disabled={!savedCodes} className={`${authButtonClass} mt-4`}>
              {t('security.setup.continue')}
            </button>
          </div>
        ) : (
          <>
            <div className={card}>
              <h3 className={stepTitle}>
                <span aria-hidden="true" className={stepNumber}>1</span>
                {t('security.setup.step1Title')}
              </h3>
              <p className="mt-1.5 text-sm text-ink-muted dark:text-gray-400">{t('security.setup.step1Hint')}</p>
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
                  <img src={enrollment.qrDataUrl} alt={t('security.setup.qrAlt')} width={200} height={200} className="rounded-xl bg-white p-2 border border-line" />
                  <div className="w-full">
                    <p className="text-xs text-ink-muted dark:text-gray-400">{t('security.setup.manualLabel')}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 rounded-xl bg-canvas dark:bg-gray-700 text-ink dark:text-white text-sm font-mono break-normal">{groupedSecret}</code>
                      <button type="button" onClick={() => copy(enrollment.secret, 'secret')} className={secondary}>
                        {copied === 'secret' ? t('security.setup.copied') : t('security.setup.copy')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink-muted dark:text-gray-400">{t('security.setup.preparing')}</p>
              )}
            </div>

            <form onSubmit={activate} className={`${card} flex flex-col gap-4`}>
              <h3 className={stepTitle}>
                <span aria-hidden="true" className={stepNumber}>2</span>
                {t('security.setup.step2Title')}
              </h3>
              {error && (
                <div role="alert" className={authErrorClass}>
                  {error}
                </div>
              )}
              <OtpInput value={code} onChange={setCode} />
              <button type="submit" disabled={!enrollment || code.length !== 6 || isActivating} className={authButtonClass}>
                {isActivating ? t('security.setup.activating') : t('security.setup.activate')}
              </button>
            </form>
          </>
        )}

        <button type="button" onClick={logout} className="self-center text-sm text-ink-muted dark:text-gray-400 hover:text-ink dark:hover:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          {t('security.setup.logout')}
        </button>
      </div>
    </AuthShell>
  );
}
