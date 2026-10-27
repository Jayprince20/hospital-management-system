'use client';

import { useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { ThemeToggle } from '@/context/theme-context';
import { useLanguage } from '@/context/language-context';

const benefitIcons = {
  security: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  pay: 'M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zM12 18h.01',
  tele: 'M15 10l5-3v10l-5-3M4 6h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z',
};

/** FR / EN segmented switch wired to the language context */
export function LanguageSwitch({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { language, setLanguage, t } = useLanguage();
  const option = (lang: 'fr' | 'en', label: string) => {
    const active = language === lang;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setLanguage(lang)}
        className={`px-3.5 py-1.5 rounded-full text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          active
            ? tone === 'dark'
              ? 'bg-white/15 text-white'
              : 'bg-white dark:bg-gray-700 text-ink dark:text-white shadow-sm'
            : tone === 'dark'
              ? 'text-rail-text'
              : 'text-ink-muted dark:text-gray-400'
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div role="group" aria-label={t('shell.auth.language')} className={`flex rounded-full p-1 ${tone === 'dark' ? 'border border-white/20' : 'bg-[#E7ECE6] dark:bg-gray-800'}`}>
      {option('fr', 'FR')}
      {option('en', 'EN')}
    </div>
  );
}

/**
 * Sign-in screens: brand panel on the left (headline and reasons to use the space), the form on
 * the right; on small screens a compact brand header above the form. `variant="mfa"` changes
 * the panel's message for the two-factor step.
 */
export function AuthShell({
  children,
  variant = 'default',
  topLeft,
  wide = false,
}: {
  children: ReactNode;
  variant?: 'default' | 'mfa';
  topLeft?: ReactNode;
  /** Wider form area and a narrower brand panel (2FA setup: QR code beside the code entry) */
  wide?: boolean;
}) {
  const { t } = useLanguage();
  const headline = variant === 'mfa' ? t('shell.auth.mfaHeadline') : t('shell.auth.headline');
  const intro = variant === 'mfa' ? t('shell.auth.mfaIntro') : t('shell.auth.intro');
  return (
    <div className="min-h-screen bg-canvas dark:bg-gray-950 text-ink dark:text-gray-100 flex flex-col lg:flex-row lg:gap-4 lg:p-4">
      {/* Brand panel (desktop) */}
      <section aria-label={t('shell.brandName')} className={`hidden lg:flex relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[28px] bg-brand flex-col justify-between text-[#F2F7EE] ${wide ? 'lg:w-[360px] xl:w-[420px] shrink-0 p-10' : 'flex-1 p-12'}`}>
        <span aria-hidden="true" className="absolute -right-[120px] -top-[120px] w-[440px] h-[440px] rounded-full border border-lime-300/20" />
        <span aria-hidden="true" className="absolute -right-10 -top-10 w-[280px] h-[280px] rounded-full border border-lime-300/30" />
        <span aria-hidden="true" className="absolute -left-40 -bottom-52 w-[520px] h-[520px] rounded-full bg-white/[0.04]" />

        <div className="relative flex items-center gap-3">
          <span aria-hidden="true" className="w-11 h-11 rounded-[14px] bg-accent text-on-accent font-extrabold text-lg flex items-center justify-center tracking-tight">BB</span>
          <span className="flex flex-col leading-tight">
            <span className="font-bold">{t('shell.brandName')}</span>
            <span className="text-xs text-[#B9CFBF]">{t('shell.brandSub')}</span>
          </span>
        </div>

        <div className="relative flex flex-col gap-7 max-w-[480px]">
          {variant === 'mfa' ? (
            <span aria-hidden="true" className="w-[72px] h-[72px] rounded-[22px] bg-accent/15 flex items-center justify-center text-lime-300">
              <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d={benefitIcons.security} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ) : (
            <span className="self-start px-3 py-1.5 rounded-full bg-accent/15 text-lime-200 text-xs font-semibold">{t('shell.auth.tag')}</span>
          )}
          <h1 className={`${wide ? 'text-[34px]' : 'text-[44px]'} leading-[1.08] font-extrabold tracking-[-0.03em]`}>{headline}</h1>
          <p className="text-base leading-relaxed text-[#C9DACE]">{intro}</p>
          {variant === 'default' && (
            <ul className="flex flex-col gap-3.5">
              {(['security', 'pay', 'tele'] as const).map((key) => (
                <li key={key} className="flex items-center gap-3">
                  <span aria-hidden="true" className="w-9 h-9 rounded-[10px] bg-white/[0.08] flex items-center justify-center text-lime-300">
                    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d={benefitIcons[key]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-sm text-[#E6F0E8]">{t(key === 'security' ? 'shell.auth.benefitSecurity' : key === 'pay' ? 'shell.auth.benefitPay' : 'shell.auth.benefitTele')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="relative text-xs text-[#9DB8A6]">{t('shell.auth.footer')}</p>
      </section>

      {/* Brand header (mobile) */}
      <header className="lg:hidden relative overflow-hidden rounded-b-[32px] bg-brand px-6 pt-10 pb-7 text-[#F2F7EE]">
        <span aria-hidden="true" className="absolute -right-[90px] -top-[90px] w-[260px] h-[260px] rounded-full border border-lime-300/25" />
        <span aria-hidden="true" className="absolute -right-8 -top-8 w-[150px] h-[150px] rounded-full border border-lime-300/35" />
        <div className="relative flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <span aria-hidden="true" className="w-10 h-10 rounded-xl bg-accent text-on-accent font-extrabold flex items-center justify-center">BB</span>
            <span className="font-bold text-[15px]">{t('shell.brandName')}</span>
          </span>
          <LanguageSwitch tone="dark" />
        </div>
        <p className="relative mt-8 text-sm text-[#C9DACE]">{t('shell.auth.mobileTagline')}</p>
      </header>

      {/* Form side */}
      <main className="flex-1 flex flex-col px-6 py-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>{topLeft}</div>
          <div className="flex items-center gap-2">
            <span className="hidden lg:inline text-[13px] text-ink-muted dark:text-gray-400">{t('shell.auth.language')}</span>
            <span className="hidden lg:block">
              <LanguageSwitch />
            </span>
            <ThemeToggle />
          </div>
        </div>
        <div className={`flex-1 flex items-center justify-center ${wide ? 'py-4' : 'py-8'}`}>
          <div className={`w-full ${wide ? 'max-w-[760px]' : 'max-w-[420px]'}`}>{children}</div>
        </div>
        <p className="text-center text-[13px] text-ink-muted dark:text-gray-400">
          {t('shell.login.help')} <span className="font-semibold text-brand dark:text-lime-400">{t('shell.login.helpDesk')}</span>
        </p>
      </main>
    </div>
  );
}

/** Kept for the public pages that already use it (forgot and reset password) */
export function AuthCard({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}

export const authInputClass =
  'w-full h-[52px] px-4 rounded-[14px] border-[1.5px] border-line dark:border-gray-600 bg-white dark:bg-gray-800 text-[15px] text-ink dark:text-white placeholder:text-[#8A958E] dark:placeholder:text-gray-500 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 dark:focus:border-lime-400 dark:focus:ring-lime-400/20 transition-colors';

export const authButtonClass =
  'w-full h-[54px] px-4 rounded-[14px] bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-white text-base font-bold shadow-[0_10px_24px_-10px_rgba(20,83,45,0.6)] flex items-center justify-center gap-2.5 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30';

export const authLabelClass = 'block mb-2 text-[13px] font-semibold text-[#2A3830] dark:text-gray-300';

export const authTitleClass = 'text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ink dark:text-white';

export const authErrorClass = 'rounded-[14px] border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-800 dark:text-red-300';

export const authLinkClass = 'font-semibold text-brand dark:text-lime-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded';

/** Password field with a show / hide button */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  autoFocus,
  required,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={required}
        className={`${authInputClass} pr-14`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('shell.login.hidePassword') : t('shell.login.showPassword')}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-[10px] flex items-center justify-center text-ink-muted dark:text-gray-400 hover:bg-canvas dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          {visible ? (
            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.4 10.4 0 0112 4c6.5 0 10 8 10 8a17.6 17.6 0 01-3.2 4.3M6.6 6.6C3.9 8.4 2 12 2 12s3.5 8 10 8a9.8 9.8 0 005.4-1.6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <>
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" strokeWidth={2} />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}

/** Splits pasted or typed text into the 6 digits of a TOTP code */
export function codeDigits(value: string): string[] {
  const digits = value.replace(/\D/g, '').slice(0, 6).split('');
  return Array.from({ length: 6 }, (_, i) => digits[i] ?? '');
}

/**
 * Six digit boxes for a TOTP code: typing moves to the next box, Backspace on an empty box
 * goes back, pasting a code fills every box. `value` is the code as a string (0–6 digits).
 */
export function OtpInput({ value, onChange, autoFocus }: { value: string; onChange: (code: string) => void; autoFocus?: boolean }) {
  const { t } = useLanguage();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = codeDigits(value);

  const setDigit = (index: number, digit: string) => {
    const next = [...digits];
    next[index] = digit;
    onChange(next.join('').slice(0, 6));
  };

  const onInput = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return setDigit(index, '');
    if (typed.length > 1) {
      // Autofill / fast typing: spread from this box
      const merged = codeDigits(digits.slice(0, index).join('') + typed);
      onChange(merged.join(''));
      refs.current[Math.min(index + typed.length, 5)]?.focus();
      return;
    }
    setDigit(index, typed);
    if (index < 5) refs.current[index + 1]?.focus();
  };

  const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault();
      setDigit(index - 1, '');
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!/\d/.test(pasted)) return;
    e.preventDefault();
    const code = codeDigits(pasted).join('');
    onChange(code);
    refs.current[Math.min(code.length, 5)]?.focus();
  };

  return (
    <fieldset className="border-0 m-0 p-0">
      <legend className={authLabelClass}>{t('shell.otp.legend')}</legend>
      <div className="grid grid-cols-6 gap-2.5">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            aria-label={t('shell.otp.digit', { n: index + 1 })}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={index === 0 ? 6 : 1}
            value={digit}
            autoFocus={autoFocus && index === 0}
            onChange={(e) => onInput(index, e.target.value)}
            onKeyDown={(e) => onKeyDown(index, e)}
            onPaste={onPaste}
            onFocus={(e) => e.target.select()}
            className={`h-[60px] w-full text-center text-2xl font-bold rounded-[14px] border-[1.5px] bg-white dark:bg-gray-800 text-ink dark:text-white focus:outline-none focus:ring-4 focus:ring-brand/15 focus:border-brand dark:focus:border-lime-400 ${
              digit ? 'border-brand dark:border-lime-500' : 'border-line dark:border-gray-600'
            }`}
          />
        ))}
      </div>
      <p className="mt-2.5 flex items-center gap-2 text-[13px] text-ink-muted dark:text-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" strokeWidth={2} />
          <path d="M12 6v6l4 2" strokeWidth={2} strokeLinecap="round" />
        </svg>
        {t('shell.otp.hint')}
      </p>
    </fieldset>
  );
}
