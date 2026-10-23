'use client';

import { ReactNode } from 'react';
import { useLanguage } from '@/context/language-context';

type EmptyStateVariant = 'default' | 'search' | 'error' | 'success';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  variant?: EmptyStateVariant;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// Default icons for each variant
const defaultIcons: Record<EmptyStateVariant, ReactNode> = {
  default: (
    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  ),
  search: (
    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  ),
  error: (
    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  success: (
    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

const iconColors: Record<EmptyStateVariant, string> = {
  default: 'text-gray-400',
  search: 'text-gray-400',
  error: 'text-red-400',
  success: 'text-green-400',
};

export function EmptyState({
  title,
  description,
  icon,
  variant = 'default',
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  const displayIcon = icon || defaultIcons[variant];
  const iconColor = iconColors[variant];

  return (
    <div className={`text-center py-12 ${className}`}>
      <div className={`mx-auto mb-4 ${iconColor}`}>{displayIcon}</div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className="px-4 py-2 text-sm font-medium text-white bg-lime-600 rounded-lg hover:bg-lime-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lime-500 transition-colors"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Pre-configured variants for common use cases
interface NoResultsProps {
  searchTerm?: string;
  onClear?: () => void;
  className?: string;
}

export function NoResults({ searchTerm, onClear, className }: NoResultsProps) {
  const { t } = useLanguage();
  return (
    <EmptyState
      variant="search"
      title={t('admin.ui.noResults')}
      description={
        searchTerm
          ? t('admin.ui.noResultsFor', { term: searchTerm })
          : t('admin.ui.adjustFilters')
      }
      action={onClear ? { label: t('admin.ui.clearSearch'), onClick: onClear } : undefined}
      className={className}
    />
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  const { t } = useLanguage();
  return (
    <EmptyState
      variant="error"
      title={title ?? t('admin.ui.somethingWrong')}
      description={message ?? t('admin.ui.loadErrorDesc')}
      action={onRetry ? { label: t('admin.ui.tryAgain'), onClick: onRetry } : undefined}
      className={className}
    />
  );
}

interface NoDataProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function NoData({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: NoDataProps) {
  const { t } = useLanguage();
  return (
    <EmptyState
      variant="default"
      title={title ?? t('admin.ui.noDataYet')}
      description={description ?? t('admin.ui.getStarted')}
      icon={icon}
      action={onAction ? { label: actionLabel ?? t('admin.ui.addNew'), onClick: onAction } : undefined}
      className={className}
    />
  );
}

export type { EmptyStateProps, EmptyStateVariant };
