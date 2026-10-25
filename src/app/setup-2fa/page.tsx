'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { AuthShell, OtpInput, authButtonClass, authErrorClass } from '@/components/auth/auth-card';
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
  const step = recoveryCodes ? 3 : code.length === 6 ? 2 : 1;
  const card = 'bg-white dark:bg-gray-800 border border-line dark:border-gray-700 rounded-[20px] p-5 sm:p-6';
  const secondary =
    'h-10 px-3.5 text-sm font-semibold rounded-xl border-[1.5px] border-line dark:border-gray-600 text-ink dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-canvas dark:hover:bg-gray-700 inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';
  const steps = [t('shell.mfa.stepScan'), t('shell.mfa.stepVerify'), t('shell.mfa.stepCodes')];

  return (
    <AuthShell
      variant="mfa"
      wide
      topLeft={
        <button type="button" onClick={logout} className="text-sm text-ink-muted dark:text-gray-400 hover:text-ink dark:hover:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          {t('security.setup.logout')}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-ink dark:text-white">{t('security.setup.title')}</h2>
          <p className="text-sm leading-relaxed text-ink-muted dark:text-gray-400">
            {/* The brand panel already explains why on desktop */}
            <span className="lg:hidden">{required ? t('security.setup.introRequired') : t('security.setup.introOptional')} </span>
            {t('security.setup.introApps')}
          </p>
        </div>

        {/* Progress: scan → verify → recovery codes */}
        <ol className="grid grid-cols-3 gap-2" aria-label={t('shell.mfa.progress')}>
          {steps.map((label, index) => {
            const n = index + 1;
            const done = n < step;
            const current = n === step;
            return (
              <li key={label} aria-current={current ? 'step' : undefined} className="flex flex-col gap-2">
                <span aria-hidden="true" className={`h-1.5 rounded-full ${done || current ? 'bg-brand dark:bg-lime-400' : 'bg-line dark:bg-gray-700'}`} />
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${current ? 'text-ink dark:text-white' : 'text-ink-muted dark:text-gray-400'}`}>
                  <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center ${done ? 'bg-brand text-white' : current ? 'bg-accent text-on-accent' : 'bg-line dark:bg-gray-700 text-ink-muted'}`}>
                    {done ? (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : (
                      n
                    )}
                  </span>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        {recoveryCodes ? (
          <div className={`${card} flex flex-col gap-4`}>
            <div>
              <h3 className="text-base font-bold text-ink dark:text-white">{t('security.setup.step3Title')}</h3>
              <p className="mt-1 text-sm text-ink-muted dark:text-gray-400">{t('security.setup.step3Hint')}</p>
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-[13px]">
              {recoveryCodes.map((recovery) => (
                <li key={recovery} className="px-2 py-2 rounded-xl bg-canvas dark:bg-gray-700 text-ink dark:text-white text-center tracking-wide">
                  {recovery}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => copy(recoveryCodes.join('\n'), 'codes')} className={secondary}>
                {copied === 'codes' ? t('security.setup.copied') : t('security.setup.copyCodes')}
              </button>
              <button type="button" onClick={downloadCodes} className={secondary}>
                {t('security.setup.downloadCodes')}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1 border-t border-line dark:border-gray-700">
              <label className="flex-1 flex items-center gap-2.5 pt-3 text-sm text-[#2A3830] dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={savedCodes} onChange={(e) => setSavedCodes(e.target.checked)} className="w-[18px] h-[18px] m-0 accent-[#14532D]" />
                {t('security.setup.savedConfirm')}
              </label>
              <button type="button" onClick={finish} disabled={!savedCodes} className={`${authButtonClass} sm:w-auto sm:px-8 sm:mt-3`}>
                {t('security.setup.continue')}
              </button>
            </div>
          </div>
        ) : (
          <div className={`${card} grid gap-6 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]`}>
            {/* 1. Scan */}
            <div className="flex flex-col items-center md:items-start gap-3">
              <div className="text-center md:text-left">
                <p className="text-sm font-bold text-ink dark:text-white">{t('security.setup.step1Title')}</p>
                <p className="mt-1 text-xs text-ink-muted dark:text-gray-400">{t('security.setup.step1Hint')}</p>
              </div>
              {loadError ? (
                <div className="text-sm text-red-700 dark:text-red-400">
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
                <>
                  {/* A data URL from the API, so next/image optimisation does not apply */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enrollment.qrDataUrl} alt={t('security.setup.qrAlt')} width={184} height={184} className="rounded-2xl bg-white p-2 border border-line" />
                  <details className="w-full group">
                    <summary className="cursor-pointer list-none text-xs font-semibold text-brand dark:text-lime-400 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                      {t('shell.mfa.cantScan')}
                    </summary>
                    <div className="mt-2 flex flex-col gap-2">
                      <code className="px-3 py-2 rounded-xl bg-canvas dark:bg-gray-700 text-ink dark:text-white text-[13px] font-mono leading-relaxed break-normal">{groupedSecret}</code>
                      <button type="button" onClick={() => copy(enrollment.secret, 'secret')} className={`${secondary} self-start`}>
                        {copied === 'secret' ? t('security.setup.copied') : t('security.setup.copy')}
                      </button>
                    </div>
                  </details>
                </>
              ) : (
                <span aria-hidden="true" className="w-[184px] h-[184px] rounded-2xl bg-canvas dark:bg-gray-700 animate-pulse" />
              )}
            </div>

            {/* 2. Verify */}
            <form onSubmit={activate} className="flex flex-col gap-4 md:border-l md:border-line md:dark:border-gray-700 md:pl-6">
              <p className="text-sm font-bold text-ink dark:text-white">{t('security.setup.step2Title')}</p>
              {error && (
                <div role="alert" className={authErrorClass}>
                  {error}
                </div>
              )}
              <OtpInput value={code} onChange={setCode} autoFocus />
              <button type="submit" disabled={!enrollment || code.length !== 6 || isActivating} className={authButtonClass}>
                {isActivating ? t('security.setup.activating') : t('security.setup.activate')}
              </button>
            </form>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
