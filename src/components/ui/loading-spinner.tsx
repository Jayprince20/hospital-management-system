'use client';

import { useLanguage } from '@/context/language-context';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type SpinnerVariant = 'primary' | 'secondary' | 'white' | 'success' | 'danger';

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const variantClasses: Record<SpinnerVariant, { track: string; spinner: string }> = {
  primary: {
    track: 'text-[#d1e7b3] dark:text-[#1e280d]',
    spinner: 'text-[#8DC63F] dark:text-[#a1cb64]',
  },
  secondary: {
    track: 'text-gray-200 dark:text-gray-700',
    spinner: 'text-gray-600 dark:text-gray-400',
  },
  white: {
    track: 'text-white/30',
    spinner: 'text-white',
  },
  success: {
    track: 'text-green-200 dark:text-green-900',
    spinner: 'text-green-600 dark:text-green-400',
  },
  danger: {
    track: 'text-red-200 dark:text-red-900',
    spinner: 'text-red-600 dark:text-red-400',
  },
};

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
  label?: string;
}

export function LoadingSpinner({
  size = 'md',
  variant = 'primary',
  className = '',
  label,
}: LoadingSpinnerProps) {
  const { t } = useLanguage();
  const colors = variantClasses[variant];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <svg
        className={`animate-spin ${sizeClasses[size]}`}
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className={`opacity-25 ${colors.track}`}
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className={colors.spinner}
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && <span className="text-gray-600 dark:text-gray-400">{label}</span>}
      <span className="sr-only">{label || t('common.loading')}</span>
    </div>
  );
}

// Full page loading overlay
interface LoadingOverlayProps {
  label?: string;
}

export function LoadingOverlay({ label }: LoadingOverlayProps) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="xl" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">{label ?? t('common.loading')}</p>
      </div>
    </div>
  );
}

// Centered loading state for content areas
interface LoadingStateProps {
  label?: string;
  minHeight?: string;
}

export function LoadingState({ label, minHeight = 'h-64' }: LoadingStateProps) {
  const { t } = useLanguage();
  return (
    <div className={`flex items-center justify-center ${minHeight}`}>
      <LoadingSpinner size="lg" label={label ?? t('common.loading')} />
    </div>
  );
}

// Button loading spinner (inline, small)
export function ButtonSpinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export type { SpinnerSize, SpinnerVariant, LoadingSpinnerProps };
