'use client';

import { SelectHTMLAttributes, forwardRef } from 'react';

export interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
  errorId?: string;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ hasError, errorId, className = '', children, ...props }, ref) => {
    const baseClasses =
      'w-full px-4 py-2.5 rounded-lg border transition-colors text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent';

    const stateClasses = hasError
      ? 'border-red-500 focus:ring-red-500'
      : 'border-gray-300 dark:border-gray-600 focus:ring-lime-500';

    return (
      <select
        ref={ref}
        className={`${baseClasses} ${stateClasses} ${className}`}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={hasError && errorId ? errorId : undefined}
        {...props}
      >
        {children}
      </select>
    );
  }
);

FormSelect.displayName = 'FormSelect';
