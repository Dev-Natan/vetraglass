import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ProfileCutItem } from './ProfileCutsTable';

interface FramePreviewSVGProps {
  width: number;
  height: number;
  profileCuts: ProfileCutItem[];
  hoveredId: string | null;
}

/**
 * Interactive proportional SVG preview of the opening.
 * Draws horizontal bars for "Largura" profiles and vertical bars for "Altura" profiles.
 * Highlights the profile whose row is hovered in the cut list.
 */
export function FramePreviewSVG({ width, height, profileCuts, hoveredId }: FramePreviewSVGProps) {
  const view = useMemo(() => {
    const maxSide = 320;
    const w = Math.max(width, 1);
    const h = Math.max(height, 1);
    const scale = maxSide / Math.max(w, h);
    return {
      vw: Math.round(w * scale),
      vh: Math.round(h * scale),
      w,
      h,
    };
  }, [width, height]);

  const { verticals, horizontals } = useMemo(() => {
    const vs = profileCuts.filter(p => p.position === 'Altura');
    const hs = profileCuts.filter(p => p.position === 'Largura');
    return { verticals: vs, horizontals: hs };
  }, [profileCuts]);

  const pad = 16;
  const svgW = view.vw + pad * 2;
  const svgH = view.vh + pad * 2;

  const strokeFor = (id: string, base: string) =>
    hoveredId === id ? 'hsl(var(--destructive))' : base;
  const widthFor = (id: string, base: number) => (hoveredId === id ? base + 3 : base);
  const opacityFor = (id: string) => (hoveredId && hoveredId !== id ? 0.35 : 1);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 sticky top-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">Preview do Vão</h3>
        <span className="text-[11px] font-mono text-muted-foreground">
          {view.w} × {view.h} mm
        </span>
      </div>

      <div className="flex items-center justify-center bg-muted/30 rounded-md p-2">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          style={{ maxHeight: 380 }}
          role="img"
          aria-label="Preview do vão"
        >
          {/* Opening frame */}
          <rect
            x={pad}
            y={pad}
            width={view.vw}
            height={view.vh}
            fill="hsl(var(--background))"
            stroke="hsl(var(--border))"
            strokeWidth={2}
            rx={4}
          />

          {/* Horizontal profiles (Largura) — distribute evenly */}
          {horizontals.map((p, i) => {
            const y = pad + ((i + 1) * view.vh) / (horizontals.length + 1);
            return (
              <line
                key={p.id}
                x1={pad}
                y1={y}
                x2={pad + view.vw}
                y2={y}
                stroke={strokeFor(p.id, 'hsl(var(--primary))')}
                strokeWidth={widthFor(p.id, 3)}
                strokeLinecap="round"
                opacity={opacityFor(p.id)}
                style={{ transition: 'all 150ms ease' }}
              />
            );
          })}

          {/* Vertical profiles (Altura) — distribute evenly */}
          {verticals.map((p, i) => {
            const x = pad + ((i + 1) * view.vw) / (verticals.length + 1);
            return (
              <line
                key={p.id}
                x1={x}
                y1={pad}
                x2={x}
                y2={pad + view.vh}
                stroke={strokeFor(p.id, 'hsl(217 91% 60%)')}
                strokeWidth={widthFor(p.id, 3)}
                strokeLinecap="round"
                opacity={opacityFor(p.id)}
                style={{ transition: 'all 150ms ease' }}
              />
            );
          })}

          {/* Dimension labels */}
          <text
            x={pad + view.vw / 2}
            y={pad + view.vh + 12}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
          >
            L: {view.w} mm
          </text>
          <text
            x={pad - 4}
            y={pad + view.vh / 2}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
            transform={`rotate(-90 ${pad - 4} ${pad + view.vh / 2})`}
          >
            A: {view.h} mm
          </text>
        </svg>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded bg-primary" />
          Perfil horizontal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-0.5 h-3 rounded" style={{ background: 'hsl(217 91% 60%)' }} />
          Perfil vertical
        </span>
        <span className={cn('inline-flex items-center gap-1.5', hoveredId && 'text-destructive')}>
          <span className="w-3 h-0.5 rounded bg-destructive" />
          Item em foco
        </span>
      </div>
    </div>
  );
}
