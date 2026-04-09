'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

export interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  errorId?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ hasError, errorId, className = '', ...props }, ref) => {
    const baseClasses =
      'w-full px-4 py-2.5 rounded-lg border transition-colors text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:border-transparent';

    const stateClasses = hasError
      ? 'border-red-500 focus:ring-red-500'
      : 'border-gray-300 dark:border-gray-600 focus:ring-lime-500';

    return (
      <input
        ref={ref}
        className={`${baseClasses} ${stateClasses} ${className}`}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={hasError && errorId ? errorId : undefined}
        {...props}
      />
    );
  }
);

FormInput.displayName = 'FormInput';
