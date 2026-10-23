'use client';

import { useLanguage } from '@/context/language-context';

// Screen-reader text announced while a skeleton is visible
function LoadingLabel() {
  const { t } = useLanguage();
  return <span className="sr-only">{t('common.loading')}</span>;
}

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

// Base skeleton element
export function Skeleton({ className = '', width, height }: SkeletonProps) {
  const style = {
    width: width || undefined,
    height: height || undefined,
  };

  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Text line skeleton
interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 1, className = '' }: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

// Avatar/circle skeleton
interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const avatarSizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export function SkeletonAvatar({ size = 'md', className = '' }: SkeletonAvatarProps) {
  return <Skeleton className={`rounded-full ${avatarSizes[size]} ${className}`} />;
}

// Table skeleton
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  className = '',
}: TableSkeletonProps) {
  return (
    <div className={`overflow-hidden ${className}`} role="status" aria-label="Loading table data">
      <table className="min-w-full">
        {showHeader && (
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-4">
                  <Skeleton
                    className={`h-4 ${colIndex === 0 ? 'w-32' : 'w-24'}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <LoadingLabel />
    </div>
  );
}

// Card skeleton
interface CardSkeletonProps {
  showImage?: boolean;
  lines?: number;
  className?: string;
}

export function CardSkeleton({ showImage = false, lines = 3, className = '' }: CardSkeletonProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden ${className}`}
      role="status"
      aria-label="Loading card"
    >
      {showImage && <Skeleton className="w-full h-48" />}
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <SkeletonText lines={lines} />
      </div>
      <LoadingLabel />
    </div>
  );
}

// List item skeleton
interface ListSkeletonProps {
  items?: number;
  showAvatar?: boolean;
  className?: string;
}

export function ListSkeleton({ items = 5, showAvatar = true, className = '' }: ListSkeletonProps) {
  return (
    <div className={`space-y-4 ${className}`} role="status" aria-label="Loading list">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          {showAvatar && <SkeletonAvatar />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
      <LoadingLabel />
    </div>
  );
}

// Stats card skeleton
export function StatsSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 ${className}`}
      role="status"
      aria-label="Loading statistics"
    >
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-4 w-24" />
      <LoadingLabel />
    </div>
  );
}

// Grid of stats skeletons
export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatsSkeleton key={i} />
      ))}
    </div>
  );
}

// Form skeleton
interface FormSkeletonProps {
  fields?: number;
  className?: string;
}

export function FormSkeleton({ fields = 4, className = '' }: FormSkeletonProps) {
  return (
    <div className={`space-y-4 ${className}`} role="status" aria-label="Loading form">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-24" />
      </div>
      <LoadingLabel />
    </div>
  );
}

export type {
  SkeletonProps,
  TableSkeletonProps,
  CardSkeletonProps,
  ListSkeletonProps,
  FormSkeletonProps,
};
