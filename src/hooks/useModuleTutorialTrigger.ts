import { useEffect } from 'react';
import { useModuleTutorial } from '@/contexts/ModuleTutorialContext';

/**
 * Hook to trigger module-specific tutorial on first access
 * Usage: useModuleTutorialTrigger('estoque');
 */
export function useModuleTutorialTrigger(moduleId: string) {
  const { checkAndStartTutorial } = useModuleTutorial();

  useEffect(() => {
    // Small delay to ensure DOM elements are rendered
    const timer = setTimeout(() => {
      checkAndStartTutorial(moduleId);
    }, 600);

    return () => clearTimeout(timer);
  }, [moduleId, checkAndStartTutorial]);
}
