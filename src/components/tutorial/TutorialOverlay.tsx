import { useEffect, useState, useCallback } from 'react';
import { useTutorial } from '@/contexts/TutorialContext';
import { TutorialTooltip } from './TutorialTooltip';
import { useIsMobile } from '@/hooks/use-mobile';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TutorialOverlay() {
  const {
    isActive,
    currentStep,
    totalSteps,
    currentStepData,
    nextStep,
    prevStep,
    skipTutorial,
  } = useTutorial();

  const isMobile = useIsMobile();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [arrowPosition, setArrowPosition] = useState<'left' | 'right' | 'top' | 'bottom'>('left');

  const calculatePositions = useCallback(() => {
    if (!currentStepData) return;

    const element = document.querySelector(`[data-tutorial="${currentStepData.target}"]`);
    if (!element) {
      // Element not found, skip to next step or end tutorial
      console.warn(`Tutorial element not found: ${currentStepData.target}`);
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = 8;

    // Set spotlight position
    setSpotlight({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calculate tooltip position based on step preference
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const gap = 16;

    let newPosition = { top: 0, left: 0 };
    let newArrow: 'left' | 'right' | 'top' | 'bottom' = 'left';

    switch (currentStepData.position) {
      case 'right':
        newPosition = {
          top: rect.top + rect.height / 2 - tooltipHeight / 2,
          left: rect.right + gap,
        };
        newArrow = 'left';
        break;
      case 'left':
        newPosition = {
          top: rect.top + rect.height / 2 - tooltipHeight / 2,
          left: rect.left - tooltipWidth - gap,
        };
        newArrow = 'right';
        break;
      case 'bottom':
        newPosition = {
          top: rect.bottom + gap,
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
        };
        newArrow = 'top';
        break;
      case 'top':
        newPosition = {
          top: rect.top - tooltipHeight - gap,
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
        };
        newArrow = 'bottom';
        break;
    }

    // Ensure tooltip stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (newPosition.left < 16) {
      newPosition.left = 16;
    }
    if (newPosition.left + tooltipWidth > viewportWidth - 16) {
      newPosition.left = viewportWidth - tooltipWidth - 16;
    }
    if (newPosition.top < 16) {
      newPosition.top = 16;
    }
    if (newPosition.top + tooltipHeight > viewportHeight - 16) {
      newPosition.top = viewportHeight - tooltipHeight - 16;
    }

    setTooltipPosition(newPosition);
    setArrowPosition(newArrow);
  }, [currentStepData]);

  useEffect(() => {
    if (!isActive || !currentStepData) return;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(calculatePositions, 100);

    // Recalculate on resize
    window.addEventListener('resize', calculatePositions);
    window.addEventListener('scroll', calculatePositions);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePositions);
      window.removeEventListener('scroll', calculatePositions);
    };
  }, [isActive, currentStepData, calculatePositions]);

  // Don't show on mobile
  if (isMobile || !isActive || !currentStepData) {
    return null;
  }

  return (
    <>
      {/* Dark overlay with spotlight cutout */}
      <div className="fixed inset-0 z-[10000] pointer-events-none">
        <svg className="w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlight && (
                <rect
                  x={spotlight.left}
                  y={spotlight.top}
                  width={spotlight.width}
                  height={spotlight.height}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.7)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      </div>

      {/* Spotlight border glow */}
      {spotlight && (
        <div
          className="fixed z-[10000] rounded-lg ring-4 ring-primary/50 ring-offset-2 ring-offset-transparent pointer-events-none animate-pulse"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

      {/* Tooltip */}
      <TutorialTooltip
        step={currentStepData}
        currentStep={currentStep}
        totalSteps={totalSteps}
        position={tooltipPosition}
        arrowPosition={arrowPosition}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTutorial}
      />

      {/* Click blocker - allows clicking only on navigation */}
      <div
        className="fixed inset-0 z-[9999]"
        onClick={(e) => {
          // Prevent any click through except tutorial elements
          e.stopPropagation();
        }}
      />
    </>
  );
}
