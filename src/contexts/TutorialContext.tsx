import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { tutorialSteps } from '@/components/tutorial/tutorialSteps';

const TUTORIAL_COMPLETED_KEY = 'vetraglass_tutorial_completed';

interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  restartTutorial: () => void;
  currentStepData: typeof tutorialSteps[0] | null;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { user, currentCompany } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  const getStorageKey = useCallback(() => {
    if (!user?.id || !currentCompany?.id) return null;
    return `${TUTORIAL_COMPLETED_KEY}_${user.id}_${currentCompany.id}`;
  }, [user?.id, currentCompany?.id]);

  const isTutorialCompleted = useCallback(() => {
    const key = getStorageKey();
    if (!key) return true; // Don't show if no user/company
    return localStorage.getItem(key) === 'true';
  }, [getStorageKey]);

  const markAsCompleted = useCallback(() => {
    const key = getStorageKey();
    if (key) {
      localStorage.setItem(key, 'true');
    }
  }, [getStorageKey]);

  // Check if should show tutorial on mount
  useEffect(() => {
    if (user && currentCompany && !hasCheckedStorage) {
      setHasCheckedStorage(true);
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        if (!isTutorialCompleted()) {
          setIsActive(true);
          setCurrentStep(0);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, currentCompany, hasCheckedStorage, isTutorialCompleted]);

  const startTutorial = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Tutorial completed
      setIsActive(false);
      markAsCompleted();
    }
  }, [currentStep, markAsCompleted]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipTutorial = useCallback(() => {
    setIsActive(false);
    markAsCompleted();
  }, [markAsCompleted]);

  const restartTutorial = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const currentStepData = isActive ? tutorialSteps[currentStep] : null;

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps: tutorialSteps.length,
        startTutorial,
        nextStep,
        prevStep,
        skipTutorial,
        restartTutorial,
        currentStepData,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
