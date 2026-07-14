import { cn } from '@/lib/utils';

interface CutAngleIconProps {
  angle: number;
  side: 'start' | 'end';
  className?: string;
}

/**
 * Small graphic depicting the cut angle of a profile end.
 * 45° = meia-esquadria (diagonal), 90° = corte reto (vertical).
 */
export function CutAngleIcon({ angle, side, className }: CutAngleIconProps) {
  const isMitre = Math.abs(angle - 45) < 5;
  const flip = side === 'end';

  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      className={cn('inline-block text-foreground', className)}
      aria-label={`Corte ${angle}° (${side === 'start' ? 'início' : 'fim'})`}
    >
      {/* Profile body */}
      <rect x="2" y="9" width="20" height="6" fill="currentColor" opacity="0.15" />
      <rect x="2" y="9" width="20" height="6" fill="none" stroke="currentColor" strokeWidth="1" />

      {/* Cut line */}
      {isMitre ? (
        <line
          x1={flip ? 22 : 2}
          y1={flip ? 9 : 9}
          x2={flip ? 16 : 8}
          y2={flip ? 15 : 15}
          stroke="hsl(var(--destructive))"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <line
          x1={flip ? 22 : 2}
          y1={9}
          x2={flip ? 22 : 2}
          y2={15}
          stroke="hsl(var(--destructive))"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
