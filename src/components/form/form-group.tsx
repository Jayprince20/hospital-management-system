'use client';

import { ReactNode } from 'react';

export interface FormGroupProps {
  children: ReactNode;
  className?: string;
}

export function FormGroup({ children, className = '' }: FormGroupProps) {
  return <div className={`space-y-1 ${className}`}>{children}</div>;
}
