import { useMemo } from 'react';

interface PanelData {
  index: number;
  name: string;
  width: number;
  height: number;
  areaM2: number;
  quantity: number;
  holes?: Array<{ x: number; y: number; diameter: number }>;
  cutouts?: Array<{ x: number; y: number; width: number; height: number }>;
}

interface OSGlassCanvasProps {
  panels: PanelData[];
  vaoWidth: number;
  vaoHeight: number;
  quantity: number;
  lockHeight?: number;
}

// Panel colors - same style as reference image
const PANEL_COLORS = [
  { fill: '#ffffff', stroke: '#1f2937', textColor: '#dc2626' }, // A - red
  { fill: '#ffffff', stroke: '#1f2937', textColor: '#2563eb' }, // B - blue
  { fill: '#ffffff', stroke: '#1f2937', textColor: '#16a34a' }, // C - green
  { fill: '#ffffff', stroke: '#1f2937', textColor: '#9333ea' }, // D - purple
];

export function OSGlassCanvas({ 
  panels, 
  vaoWidth, 
  vaoHeight, 
  quantity,
  lockHeight = 0
}: OSGlassCanvasProps) {
  const layout = useMemo(() => {
    const padding = { top: 30, right: 70, bottom: 50, left: 50 };
    const canvasWidth = 500;
    const canvasHeight = 350;
    const drawAreaWidth = canvasWidth - padding.left - padding.right;
    const drawAreaHeight = canvasHeight - padding.top - padding.bottom;
    
    // Calculate total glass width from panels
    const glassWidth = panels.reduce((sum, p) => sum + p.width, 0);
    const maxGlassHeight = Math.max(...panels.map(p => p.height), 0);
    
    // Calculate scale to fit
    const scaleX = drawAreaWidth / (glassWidth || 1);
    const scaleY = drawAreaHeight / (maxGlassHeight || 1);
    const scale = Math.min(scaleX, scaleY, 0.25);
    
    // Position panels from right to left (A on right, B on left)
    let currentX = 0;
    const gap = 2;
    
    // Reverse to position A on right
    const reversedPanels = [...panels].reverse();
    const positionedPanels = reversedPanels.map((panel, index) => {
      const scaledWidth = panel.width * scale;
      const scaledHeight = panel.height * scale;
      const x = padding.left + currentX;
      const y = padding.top + (drawAreaHeight - scaledHeight);
      currentX += scaledWidth + gap;
      
      return {
        ...panel,
        x,
        y,
        scaledWidth,
        scaledHeight,
        color: PANEL_COLORS[(panels.length - 1 - index) % PANEL_COLORS.length],
        letter: String.fromCharCode(65 + (panels.length - 1 - index))
      };
    });
    
    // Reverse back to display order (left to right)
    positionedPanels.reverse();
    
    const totalScaledWidth = currentX - gap;
    const totalScaledHeight = maxGlassHeight * scale;
    const bottomY = padding.top + drawAreaHeight;
    
    return {
      panels: positionedPanels,
      totalScaledWidth,
      totalScaledHeight,
      canvasWidth,
      canvasHeight,
      padding,
      scale,
      bottomY,
      lockHeightY: bottomY - (lockHeight * scale),
      maxGlassHeight
    };
  }, [panels, lockHeight]);

  if (panels.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Nenhum painel de vidro
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <svg 
        viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
        className="w-full h-auto"
        style={{ minHeight: '280px', maxHeight: '350px' }}
      >
        {/* White background */}
        <rect width="100%" height="100%" fill="white" />
        
        {/* Top edge with circles (roller indicators) */}
        {layout.panels.length > 0 && (
          <>
            <circle 
              cx={layout.padding.left + 10} 
              cy={layout.padding.top - 10} 
              r={4} 
              fill="none" 
              stroke="#1f2937" 
              strokeWidth={1.5}
            />
            <circle 
              cx={layout.padding.left + layout.totalScaledWidth - 10} 
              cy={layout.padding.top - 10} 
              r={4} 
              fill="none" 
              stroke="#1f2937" 
              strokeWidth={1.5}
            />
          </>
        )}
        
        {/* Glass panels */}
        {layout.panels.map((panel, index) => {
          const holes = (panel as any).holes || [];
          const cutouts = (panel as any).cutouts || [];
          
          return (
            <g key={panel.index}>
              {/* Panel rectangle */}
              <rect
                x={panel.x}
                y={panel.y}
                width={panel.scaledWidth}
                height={panel.scaledHeight}
                fill={panel.color.fill}
                stroke={panel.color.stroke}
                strokeWidth={1.5}
              />
              
              {/* Dashed line in middle (for sliding panels) */}
              {index === 0 && layout.panels.length > 1 && (
                <line
                  x1={panel.x + panel.scaledWidth}
                  y1={panel.y}
                  x2={panel.x + panel.scaledWidth}
                  y2={panel.y + panel.scaledHeight}
                  stroke="#1f2937"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                />
              )}
              
              {/* Draw holes */}
              {holes.map((hole: any, hIdx: number) => {
                const cx = panel.x + hole.x * layout.scale;
                const cy = panel.y + hole.y * layout.scale;
                const r = Math.max((hole.diameter / 2) * layout.scale, 4);
                return (
                  <circle
                    key={hIdx}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke="#1f2937"
                    strokeWidth={1}
                  />
                );
              })}
              
              {/* Draw cutouts */}
              {cutouts.map((cutout: any, cIdx: number) => {
                const rectX = panel.x + cutout.x * layout.scale;
                const rectY = panel.y + panel.scaledHeight - (cutout.y * layout.scale) - (cutout.height * layout.scale);
                const w = cutout.width * layout.scale;
                const h = cutout.height * layout.scale;
                return (
                  <rect
                    key={cIdx}
                    x={rectX}
                    y={rectY}
                    width={Math.max(w, 4)}
                    height={Math.max(h, 4)}
                    fill="white"
                    stroke="#1f2937"
                    strokeWidth={1}
                  />
                );
              })}
              
              {/* Letter label */}
              <text
                x={panel.x + panel.scaledWidth / 2}
                y={panel.y + panel.scaledHeight / 2 + 8}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={panel.color.textColor}
                fontSize="24"
                fontWeight="bold"
              >
                {panel.letter}
              </text>
              
              {/* Height dimension on left side */}
              <text
                x={panel.x - 8}
                y={panel.y + panel.scaledHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight="500"
                fill="#1f2937"
              >
                {panel.height}
              </text>
              
              {/* Width dimension below panel */}
              <text
                x={panel.x + panel.scaledWidth / 2}
                y={layout.bottomY + 16}
                textAnchor="middle"
                fontSize="11"
                fontWeight="500"
                fill="#1f2937"
              >
                {panel.width}
              </text>
            </g>
          );
        })}
        
        {/* Lock height indicator with circle (like reference image) */}
        {lockHeight > 0 && layout.panels.length > 0 && (
          <g>
            {/* Circle for lock position on the rightmost panel */}
            <circle
              cx={layout.padding.left + layout.totalScaledWidth - 15}
              cy={layout.lockHeightY}
              r={4}
              fill="none"
              stroke="#1f2937"
              strokeWidth={1}
            />
          </g>
        )}
        
        {/* Right side VÃO dimension (vertical) */}
        {layout.panels.length > 0 && (
          <g transform={`translate(${layout.padding.left + layout.totalScaledWidth + 25}, ${layout.padding.top})`}>
            <line x1={0} y1={0} x2={0} y2={layout.totalScaledHeight} stroke="#1f2937" strokeWidth={1} />
            <line x1={-4} y1={0} x2={4} y2={0} stroke="#1f2937" strokeWidth={1} />
            <line x1={-4} y1={layout.totalScaledHeight} x2={4} y2={layout.totalScaledHeight} stroke="#1f2937" strokeWidth={1} />
            <text
              x={12}
              y={layout.totalScaledHeight / 2}
              textAnchor="start"
              dominantBaseline="middle"
              fontSize="11"
              fontWeight="600"
              fill="#1f2937"
              style={{ writingMode: 'vertical-rl' as any }}
              transform={`rotate(90, 12, ${layout.totalScaledHeight / 2})`}
            >
              {vaoHeight} VÃO
            </text>
          </g>
        )}
        
        {/* Bottom VÃO dimension (horizontal) */}
        {layout.panels.length > 0 && (
          <g transform={`translate(${layout.padding.left}, ${layout.bottomY + 32})`}>
            <line x1={0} y1={0} x2={layout.totalScaledWidth} y2={0} stroke="#1f2937" strokeWidth={1} />
            <line x1={0} y1={-4} x2={0} y2={4} stroke="#1f2937" strokeWidth={1} />
            <line x1={layout.totalScaledWidth} y1={-4} x2={layout.totalScaledWidth} y2={4} stroke="#1f2937" strokeWidth={1} />
            <text
              x={layout.totalScaledWidth / 2}
              y={14}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#1f2937"
            >
              {vaoWidth} VÃO
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
