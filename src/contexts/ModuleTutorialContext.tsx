import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { moduleTutorials, ModuleTutorialStep } from '@/components/tutorial/moduleTutorialSteps';

const MODULE_TUTORIAL_KEY = 'vetraglass_module_tutorial';

interface ModuleTutorialContextType {
  isActive: boolean;
  currentModuleId: string | null;
  currentStep: number;
  totalSteps: number;
  currentStepData: ModuleTutorialStep | null;
  checkAndStartTutorial: (moduleId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  restartModuleTutorial: (moduleId: string) => void;
}

const ModuleTutorialContext = createContext<ModuleTutorialContextType | undefined>(undefined);

export function ModuleTutorialProvider({ children }: { children: React.ReactNode }) {
  const { user, currentCompany } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const getStorageKey = useCallback((moduleId: string) => {
    if (!user?.id || !currentCompany?.id) return null;
    return `${MODULE_TUTORIAL_KEY}_${user.id}_${currentCompany.id}_${moduleId}`;
  }, [user?.id, currentCompany?.id]);

  const isModuleTutorialCompleted = useCallback((moduleId: string) => {
    const key = getStorageKey(moduleId);
    if (!key) return true;
    return localStorage.getItem(key) === 'true';
  }, [getStorageKey]);

  const markModuleAsCompleted = useCallback((moduleId: string) => {
    const key = getStorageKey(moduleId);
    if (key) {
      localStorage.setItem(key, 'true');
    }
  }, [getStorageKey]);

  const checkAndStartTutorial = useCallback((moduleId: string) => {
    // Don't start if no user/company or already in a tutorial
    if (!user?.id || !currentCompany?.id || isActive) return;

    // Check if this module has a tutorial defined
    const tutorial = moduleTutorials[moduleId];
    if (!tutorial || tutorial.steps.length === 0) return;

    // Check if already completed
    if (isModuleTutorialCompleted(moduleId)) return;

    // Start the tutorial
    setCurrentModuleId(moduleId);
    setCurrentStep(0);
    setIsActive(true);
  }, [user?.id, currentCompany?.id, isActive, isModuleTutorialCompleted]);

  const nextStep = useCallback(() => {
    if (!currentModuleId) return;
    
    const tutorial = moduleTutorials[currentModuleId];
    if (!tutorial) return;

    if (currentStep < tutorial.steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Tutorial completed
      setIsActive(false);
      markModuleAsCompleted(currentModuleId);
      setCurrentModuleId(null);
      setCurrentStep(0);
    }
  }, [currentModuleId, currentStep, markModuleAsCompleted]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipTutorial = useCallback(() => {
    if (currentModuleId) {
      markModuleAsCompleted(currentModuleId);
    }
    setIsActive(false);
    setCurrentModuleId(null);
    setCurrentStep(0);
  }, [currentModuleId, markModuleAsCompleted]);

  const restartModuleTutorial = useCallback((moduleId: string) => {
    const tutorial = moduleTutorials[moduleId];
    if (!tutorial || tutorial.steps.length === 0) return;

    setCurrentModuleId(moduleId);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const currentTutorial = currentModuleId ? moduleTutorials[currentModuleId] : null;
  const currentStepData = currentTutorial && isActive ? currentTutorial.steps[currentStep] : null;
  const totalSteps = currentTutorial ? currentTutorial.steps.length : 0;

  return (
    <ModuleTutorialContext.Provider
      value={{
        isActive,
        currentModuleId,
        currentStep,
        totalSteps,
        currentStepData,
        checkAndStartTutorial,
        nextStep,
        prevStep,
        skipTutorial,
        restartModuleTutorial,
      }}
    >
      {children}
    </ModuleTutorialContext.Provider>
  );
}

export function useModuleTutorial() {
  const context = useContext(ModuleTutorialContext);
  
  // Return safe defaults if used outside provider
  if (context === undefined) {
    return {
      isActive: false,
      currentModuleId: null,
      currentStep: 0,
      totalSteps: 0,
      currentStepData: null,
      checkAndStartTutorial: () => {},
      nextStep: () => {},
      prevStep: () => {},
      skipTutorial: () => {},
      restartModuleTutorial: () => {},
    };
  }
  
  return context;
}
