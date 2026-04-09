'use client';

import { useState, useCallback } from 'react';

interface UseFormStepsOptions {
  totalSteps: number;
  initialStep?: number;
  onStepChange?: (step: number) => void;
}

interface UseFormStepsReturn {
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  progress: number;
  next: () => void;
  previous: () => void;
  goToStep: (step: number) => void;
  reset: () => void;
}

export function useFormSteps({
  totalSteps,
  initialStep = 1,
  onStepChange,
}: UseFormStepsOptions): UseFormStepsReturn {
  const [currentStep, setCurrentStep] = useState(initialStep);

  const next = useCallback(() => {
    setCurrentStep((prev) => {
      const newStep = Math.min(prev + 1, totalSteps);
      if (newStep !== prev && onStepChange) {
        onStepChange(newStep);
      }
      return newStep;
    });
  }, [totalSteps, onStepChange]);

  const previous = useCallback(() => {
    setCurrentStep((prev) => {
      const newStep = Math.max(prev - 1, 1);
      if (newStep !== prev && onStepChange) {
        onStepChange(newStep);
      }
      return newStep;
    });
  }, [onStepChange]);

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 1 && step <= totalSteps) {
        setCurrentStep(step);
        if (onStepChange) {
          onStepChange(step);
        }
      }
    },
    [totalSteps, onStepChange]
  );

  const reset = useCallback(() => {
    setCurrentStep(initialStep);
    if (onStepChange) {
      onStepChange(initialStep);
    }
  }, [initialStep, onStepChange]);

  return {
    currentStep,
    totalSteps,
    isFirstStep: currentStep === 1,
    isLastStep: currentStep === totalSteps,
    progress: (currentStep / totalSteps) * 100,
    next,
    previous,
    goToStep,
    reset,
  };
}
