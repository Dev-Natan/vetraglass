import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GlassPanelData } from '@/pages/ProjetoVidro';

interface GlassProjectCanvasProps {
  panels: GlassPanelData[];
  totalWidth: number;
  totalHeight: number;
  quantity: number;
  lockHeight: number;
}

// Colors for different panels
const PANEL_COLORS = [
  { fill: '#bfdbfe', stroke: '#3b82f6' }, // Blue
  { fill: '#bbf7d0', stroke: '#22c55e' }, // Green
  { fill: '#fef08a', stroke: '#eab308' }, // Yellow
  { fill: '#fed7aa', stroke: '#f97316' }, // Orange
  { fill: '#e9d5ff', stroke: '#a855f7' }, // Purple
  { fill: '#fecdd3', stroke: '#f43f5e' }, // Pink
  { fill: '#a5f3fc', stroke: '#06b6d4' }, // Cyan
  { fill: '#d9f99d', stroke: '#84cc16' }, // Lime
];

export function GlassProjectCanvas({ 
  panels, 
  totalWidth, 
  totalHeight, 
  quantity,
  lockHeight 
}: GlassProjectCanvasProps) {
  const layout = useMemo(() => {
    // Calculate total glass width (sum of all widths)
    const glassWidth = panels.reduce((sum, p) => sum + p.width, 0);
    const maxGlassHeight = Math.max(...panels.map(p => p.height), 0);
    
    // SVG dimensions with padding for dimension lines
    const padding = { top: 60, right: 80, bottom: 80, left: 80 };
    const canvasWidth = 800;
    const canvasHeight = 500;
    const drawAreaWidth = canvasWidth - padding.left - padding.right;
    const drawAreaHeight = canvasHeight - padding.top - padding.bottom;
    
    // Calculate scale to fit all glasses
    const scaleX = drawAreaWidth / glassWidth;
    const scaleY = drawAreaHeight / maxGlassHeight;
    const scale = Math.min(scaleX, scaleY, 0.4); // Max scale 0.4 to keep reasonable size
    
    // Position each panel
    let currentX = 0;
    const positionedPanels = panels.map((panel, index) => {
      const scaledWidth = panel.width * scale;
      const scaledHeight = panel.height * scale;
      const x = padding.left + currentX;
      const y = padding.top + (drawAreaHeight - scaledHeight); // Align to bottom
      currentX += scaledWidth + 4; // 4px gap between panels
      
      return {
        ...panel,
        x,
        y,
        scaledWidth,
        scaledHeight,
        color: PANEL_COLORS[index % PANEL_COLORS.length]
      };
    });
    
    // Total scaled dimensions
    const totalScaledWidth = currentX - 4; // Remove last gap
    const totalScaledHeight = maxGlassHeight * scale;
    
    return {
      panels: positionedPanels,
      totalScaledWidth,
      totalScaledHeight,
      canvasWidth,
      canvasHeight,
      padding,
      scale,
      lockHeightY: padding.top + (drawAreaHeight - (lockHeight * scale))
    };
  }, [panels, lockHeight]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Visualização do Projeto</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/30 rounded-lg p-4 overflow-auto">
          <svg 
            viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
            className="w-full h-auto min-h-[400px]"
            style={{ maxHeight: '600px' }}
          >
            {/* Background grid pattern */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Glass panels */}
            {layout.panels.map((panel, index) => (
              <g key={panel.id}>
                {/* Panel rectangle */}
                <rect
                  x={panel.x}
                  y={panel.y}
                  width={panel.scaledWidth}
                  height={panel.scaledHeight}
                  fill={panel.color.fill}
                  stroke={panel.color.stroke}
                  strokeWidth={2}
                  rx={2}
                />
                
                {/* Letter label in center */}
                <text
                  x={panel.x + panel.scaledWidth / 2}
                  y={panel.y + panel.scaledHeight / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-2xl font-bold"
                  fill={panel.color.stroke}
                  fontSize="28"
                  fontWeight="bold"
                >
                  {panel.letter}
                </text>
                
                {/* Width dimension (bottom of each panel) */}
                <g transform={`translate(${panel.x}, ${panel.y + panel.scaledHeight + 15})`}>
                  {/* Dimension line */}
                  <line x1={0} y1={0} x2={panel.scaledWidth} y2={0} stroke="hsl(var(--foreground))" strokeWidth={1} />
                  {/* Left arrow */}
                  <path d={`M 0 0 L 6 -3 L 6 3 Z`} fill="hsl(var(--foreground))" />
                  {/* Right arrow */}
                  <path d={`M ${panel.scaledWidth} 0 L ${panel.scaledWidth - 6} -3 L ${panel.scaledWidth - 6} 3 Z`} fill="hsl(var(--foreground))" />
                  {/* Dimension text */}
                  <text
                    x={panel.scaledWidth / 2}
                    y={15}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="600"
                    fill="hsl(var(--foreground))"
                  >
                    {panel.width}
                  </text>
                </g>
                
                {/* Height dimension (right side of each panel) */}
                <g transform={`translate(${panel.x + panel.scaledWidth + 10}, ${panel.y})`}>
                  {/* Dimension line */}
                  <line x1={0} y1={0} x2={0} y2={panel.scaledHeight} stroke="hsl(var(--foreground))" strokeWidth={1} />
                  {/* Top arrow */}
                  <path d={`M 0 0 L -3 6 L 3 6 Z`} fill="hsl(var(--foreground))" />
                  {/* Bottom arrow */}
                  <path d={`M 0 ${panel.scaledHeight} L -3 ${panel.scaledHeight - 6} L 3 ${panel.scaledHeight - 6} Z`} fill="hsl(var(--foreground))" />
                  {/* Dimension text */}
                  <text
                    x={15}
                    y={panel.scaledHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="12"
                    fontWeight="600"
                    fill="hsl(var(--foreground))"
                    transform={`rotate(90, 15, ${panel.scaledHeight / 2})`}
                  >
                    {panel.height}
                  </text>
                </g>
              </g>
            ))}
            
            {/* Total VÃO width dimension (bottom) */}
            {layout.panels.length > 1 && (
              <g transform={`translate(${layout.padding.left}, ${layout.canvasHeight - 30})`}>
                <line x1={0} y1={0} x2={layout.totalScaledWidth} y2={0} stroke="hsl(var(--primary))" strokeWidth={2} />
                <path d={`M 0 0 L 8 -4 L 8 4 Z`} fill="hsl(var(--primary))" />
                <path d={`M ${layout.totalScaledWidth} 0 L ${layout.totalScaledWidth - 8} -4 L ${layout.totalScaledWidth - 8} 4 Z`} fill="hsl(var(--primary))" />
                <rect 
                  x={layout.totalScaledWidth / 2 - 50} 
                  y={-12} 
                  width={100} 
                  height={24} 
                  fill="hsl(var(--background))" 
                  rx={4}
                />
                <text
                  x={layout.totalScaledWidth / 2}
                  y={5}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="bold"
                  fill="hsl(var(--primary))"
                >
                  VÃO: {totalWidth}
                </text>
              </g>
            )}
            
            {/* Lock height indicator (horizontal dashed line) */}
            {lockHeight > 0 && lockHeight < totalHeight && (
              <g>
                <line
                  x1={layout.padding.left - 20}
                  y1={layout.lockHeightY}
                  x2={layout.padding.left + layout.totalScaledWidth + 20}
                  y2={layout.lockHeightY}
                  stroke="hsl(var(--destructive))"
                  strokeWidth={1}
                  strokeDasharray="8 4"
                />
                <text
                  x={layout.padding.left - 25}
                  y={layout.lockHeightY + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="hsl(var(--destructive))"
                >
                  Fecho: {lockHeight}
                </text>
              </g>
            )}
            
            {/* Quantity indicator */}
            <text
              x={layout.padding.left}
              y={layout.canvasHeight - 8}
              fontSize="14"
              fontWeight="bold"
              fill="hsl(var(--muted-foreground))"
            >
              X {quantity}
            </text>
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
