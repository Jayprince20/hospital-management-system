'use client';

import { ReactNode, useEffect, useRef, useCallback, createContext, useContext, useId } from 'react';
import { useLanguage } from '@/context/language-context';
import { createPortal } from 'react-dom';

// Modal size variants
type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

// Context for modal state
interface ModalContextValue {
  titleId: string;
  descriptionId: string;
  onClose: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('Modal compound components must be used within a Modal');
  }
  return context;
}

// Main Modal Props
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocus?: React.RefObject<HTMLElement | null>;
}

// Focus trap hook
function useFocusTrap(modalRef: React.RefObject<HTMLDivElement | null>, isOpen: boolean, initialFocus?: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Store previously focused element
    const previouslyFocused = document.activeElement as HTMLElement;

    // Focus initial element or first focusable
    if (initialFocus?.current) {
      initialFocus.current.focus();
    } else if (firstFocusable) {
      firstFocusable.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    }

    modal.addEventListener('keydown', handleKeyDown);

    return () => {
      modal.removeEventListener('keydown', handleKeyDown);
      // Restore focus when modal closes
      previouslyFocused?.focus();
    };
  }, [isOpen, modalRef, initialFocus]);
}

// Main Modal Component
export function Modal({
  isOpen,
  onClose,
  children,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocus,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Focus trap
  useFocusTrap(modalRef, isOpen, initialFocus);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdrop && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdrop, onClose]
  );

  if (!isOpen) return null;

  const modalContent = (
    <ModalContext.Provider value={{ titleId, descriptionId, onClose }}>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
        role="presentation"
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className={`bg-white dark:bg-gray-800 rounded-xl w-full ${sizeClasses[size]} shadow-xl animate-in fade-in zoom-in-95 duration-200`}
        >
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  );

  // Use portal to render at document root
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}

// Modal Header Component
interface ModalHeaderProps {
  children: ReactNode;
  showCloseButton?: boolean;
  className?: string;
}

function ModalHeader({ children, showCloseButton = true, className = '' }: ModalHeaderProps) {
  const { titleId, onClose } = useModalContext();
  const { t } = useLanguage();

  return (
    <div className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 ${className}`}>
      <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
        {children}
      </h2>
      {showCloseButton && (
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label={t('common.close')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Modal Body Component
interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

function ModalBody({ children, className = '' }: ModalBodyProps) {
  const { descriptionId } = useModalContext();

  return (
    <div id={descriptionId} className={`p-4 ${className}`}>
      {children}
    </div>
  );
}

// Modal Footer Component
interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={`px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl flex justify-end gap-3 ${className}`}>
      {children}
    </div>
  );
}

// Attach compound components
Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

// Re-export for convenience
export type { ModalSize, ModalProps, ModalHeaderProps, ModalBodyProps, ModalFooterProps };
