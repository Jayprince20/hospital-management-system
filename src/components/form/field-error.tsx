'use client';

interface FieldErrorProps {
  message?: string;
  id?: string;
  className?: string;
}

export function FieldError({ message, id, className = '' }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p
      id={id}
      className={`mt-1 text-sm text-red-500 dark:text-red-400 ${className}`}
      role="alert"
    >
      {message}
    </p>
  );
}
