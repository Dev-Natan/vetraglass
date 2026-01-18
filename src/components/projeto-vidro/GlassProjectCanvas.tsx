import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GlassPanelData } from '@/pages/ProjetoVidro';
import { Circle, Square, Edit } from 'lucide-react';
import { HoleCutoutEditor, Hole, Cutout } from './HoleCutoutEditor';

interface GlassProjectCanvasProps {
  panels: GlassPanelData[];
  totalWidth: number;
  totalHeight: number;
  quantity: number;
  lockHeight: number;
  panelModifications: Record<string, { holes: Hole[]; cutouts: Cutout[] }>;
  onPanelModificationsChange: (mods: Record<string, { holes: Hole[]; cutouts: Cutout[] }>) => void;
}

// Colors for different panels
const PANEL_COLORS = [
  { fill: '#dbeafe', stroke: '#2563eb', text: '#1e40af' }, // Blue
  { fill: '#dcfce7', stroke: '#16a34a', text: '#15803d' }, // Green
  { fill: '#fef9c3', stroke: '#ca8a04', text: '#a16207' }, // Yellow
  { fill: '#fed7aa', stroke: '#ea580c', text: '#c2410c' }, // Orange
  { fill: '#f3e8ff', stroke: '#9333ea', text: '#7c3aed' }, // Purple
  { fill: '#fce7f3', stroke: '#db2777', text: '#be185d' }, // Pink
  { fill: '#cffafe', stroke: '#0891b2', text: '#0e7490' }, // Cyan
  { fill: '#ecfccb', stroke: '#65a30d', text: '#4d7c0f' }, // Lime
];

export function GlassProjectCanvas({ 
  panels, 
  totalWidth, 
  totalHeight, 
  quantity,
  lockHeight,
  panelModifications,
  onPanelModificationsChange
}: GlassProjectCanvasProps) {
  const [editingPanel, setEditingPanel] = useState<GlassPanelData | null>(null);

  const layout = useMemo(() => {
    // Calculate total glass width (sum of all widths)
    const glassWidth = panels.reduce((sum, p) => sum + p.width, 0);
    const maxGlassHeight = Math.max(...panels.map(p => p.height), 0);
    
    // SVG dimensions with padding for dimension lines
    const padding = { top: 80, right: 100, bottom: 100, left: 100 };
    const canvasWidth = 900;
    const canvasHeight = 550;
    const drawAreaWidth = canvasWidth - padding.left - padding.right;
    const drawAreaHeight = canvasHeight - padding.top - padding.bottom;
    
    // Calculate scale to fit all glasses
    const scaleX = drawAreaWidth / (glassWidth || 1);
    const scaleY = drawAreaHeight / (maxGlassHeight || 1);
    const scale = Math.min(scaleX, scaleY, 0.35);
    
    // Position each panel
    let currentX = 0;
    const gap = 6; // Gap between panels
    const positionedPanels = panels.map((panel, index) => {
      const scaledWidth = panel.width * scale;
      const scaledHeight = panel.height * scale;
      const x = padding.left + currentX;
      const y = padding.top + (drawAreaHeight - scaledHeight); // Align to bottom
      currentX += scaledWidth + gap;
      
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
    const totalScaledWidth = currentX - gap;
    const totalScaledHeight = maxGlassHeight * scale;
    
    return {
      panels: positionedPanels,
      totalScaledWidth,
      totalScaledHeight,
      canvasWidth,
      canvasHeight,
      padding,
      scale,
      lockHeightY: padding.top + (drawAreaHeight - (lockHeight * scale)),
      maxGlassHeight
    };
  }, [panels, lockHeight]);

  const handleEditPanel = (panel: GlassPanelData) => {
    setEditingPanel(panel);
  };

  const handleHolesChange = (holes: Hole[]) => {
    if (!editingPanel) return;
    onPanelModificationsChange({
      ...panelModifications,
      [editingPanel.id]: {
        holes,
        cutouts: panelModifications[editingPanel.id]?.cutouts || []
      }
    });
  };

  const handleCutoutsChange = (cutouts: Cutout[]) => {
    if (!editingPanel) return;
    onPanelModificationsChange({
      ...panelModifications,
      [editingPanel.id]: {
        holes: panelModifications[editingPanel.id]?.holes || [],
        cutouts
      }
    });
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Visualização do Projeto</span>
          <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
            <Circle className="w-4 h-4" /> Furos
            <Square className="w-4 h-4 ml-2" /> Recortes
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/20 rounded-lg p-4 overflow-auto border">
          <svg 
            viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
            className="w-full h-auto min-h-[450px]"
            style={{ maxHeight: '650px' }}
          >
            {/* Background grid pattern */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.4" />
              </pattern>
              {/* Arrow marker */}
              <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="hsl(var(--foreground))" />
              </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Glass panels */}
            {layout.panels.map((panel, index) => {
              const mods = panelModifications[panel.id] || { holes: [], cutouts: [] };
              const hasModifications = mods.holes.length > 0 || mods.cutouts.length > 0;
              
              return (
                <g key={panel.id}>
                  {/* Panel rectangle with shadow */}
                  <rect
                    x={panel.x + 3}
                    y={panel.y + 3}
                    width={panel.scaledWidth}
                    height={panel.scaledHeight}
                    fill="rgba(0,0,0,0.1)"
                    rx={3}
                  />
                  <rect
                    x={panel.x}
                    y={panel.y}
                    width={panel.scaledWidth}
                    height={panel.scaledHeight}
                    fill={panel.color.fill}
                    stroke={panel.color.stroke}
                    strokeWidth={2.5}
                    rx={3}
                    className="cursor-pointer hover:stroke-[3.5px] transition-all"
                    onClick={() => handleEditPanel(panel)}
                  />
                  
                  {/* Draw holes */}
                  {mods.holes.map(hole => {
                    const cx = panel.x + (hole.x / panel.width) * panel.scaledWidth;
                    const cy = panel.y + panel.scaledHeight - (hole.y / panel.height) * panel.scaledHeight;
                    const r = (hole.diameter / 2 / panel.width) * panel.scaledWidth;
                    return (
                      <circle
                        key={hole.id}
                        cx={cx}
                        cy={cy}
                        r={Math.max(r, 4)}
                        fill="white"
                        stroke={panel.color.stroke}
                        strokeWidth={1.5}
                      />
                    );
                  })}
                  
                  {/* Draw cutouts */}
                  {mods.cutouts.map(cutout => {
                    const cx = panel.x + (cutout.x / panel.width) * panel.scaledWidth;
                    const cy = panel.y + panel.scaledHeight - (cutout.y / panel.height) * panel.scaledHeight;
                    const w = (cutout.width / panel.width) * panel.scaledWidth;
                    const h = (cutout.height / panel.height) * panel.scaledHeight;
                    return (
                      <rect
                        key={cutout.id}
                        x={cx - w / 2}
                        y={cy - h / 2}
                        width={w}
                        height={h}
                        fill="white"
                        stroke={panel.color.stroke}
                        strokeWidth={1.5}
                      />
                    );
                  })}
                  
                  {/* Letter label in center */}
                  <text
                    x={panel.x + panel.scaledWidth / 2}
                    y={panel.y + panel.scaledHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={panel.color.text}
                    fontSize="32"
                    fontWeight="bold"
                    className="pointer-events-none select-none"
                  >
                    {panel.letter}
                  </text>
                  
                  {/* Modification indicator */}
                  {hasModifications && (
                    <g transform={`translate(${panel.x + panel.scaledWidth - 16}, ${panel.y + 8})`}>
                      <circle r="8" fill={panel.color.stroke} />
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {mods.holes.length + mods.cutouts.length}
                      </text>
                    </g>
                  )}
                  
                  {/* Edit button */}
                  <g 
                    transform={`translate(${panel.x + panel.scaledWidth - 16}, ${panel.y + panel.scaledHeight - 20})`}
                    className="cursor-pointer"
                    onClick={() => handleEditPanel(panel)}
                  >
                    <rect x="-12" y="-8" width="24" height="16" fill={panel.color.stroke} rx="3" />
                    <Edit x="-6" y="-4" width="12" height="12" className="text-white" />
                  </g>
                  
                  {/* Width dimension (bottom of each panel) */}
                  <g transform={`translate(${panel.x}, ${panel.y + panel.scaledHeight + 20})`}>
                    <line x1={0} y1={0} x2={panel.scaledWidth} y2={0} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
                    <line x1={0} y1={-6} x2={0} y2={6} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
                    <line x1={panel.scaledWidth} y1={-6} x2={panel.scaledWidth} y2={6} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
                    <rect 
                      x={panel.scaledWidth / 2 - 25} 
                      y={4} 
                      width={50} 
                      height={18} 
                      fill="hsl(var(--background))" 
                      rx={3}
                    />
                    <text
                      x={panel.scaledWidth / 2}
                      y={16}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="700"
                      fill="hsl(var(--foreground))"
                    >
                      {panel.width}
                    </text>
                  </g>
                  
                  {/* Height dimension (right side of panel) */}
                  <g transform={`translate(${panel.x + panel.scaledWidth + 15}, ${panel.y})`}>
                    <line x1={0} y1={0} x2={0} y2={panel.scaledHeight} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
                    <line x1={-6} y1={0} x2={6} y2={0} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
                    <line x1={-6} y1={panel.scaledHeight} x2={6} y2={panel.scaledHeight} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
                    <rect 
                      x={8} 
                      y={panel.scaledHeight / 2 - 10} 
                      width={40} 
                      height={20} 
                      fill="hsl(var(--background))" 
                      rx={3}
                    />
                    <text
                      x={28}
                      y={panel.scaledHeight / 2 + 4}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="700"
                      fill="hsl(var(--foreground))"
                    >
                      {panel.height}
                    </text>
                  </g>
                </g>
              );
            })}
            
            {/* Total VÃO width dimension (bottom) */}
            {layout.panels.length > 0 && (
              <g transform={`translate(${layout.padding.left}, ${layout.canvasHeight - 35})`}>
                <line x1={0} y1={0} x2={layout.totalScaledWidth} y2={0} stroke="hsl(var(--primary))" strokeWidth={2.5} />
                <line x1={0} y1={-8} x2={0} y2={8} stroke="hsl(var(--primary))" strokeWidth={2.5} />
                <line x1={layout.totalScaledWidth} y1={-8} x2={layout.totalScaledWidth} y2={8} stroke="hsl(var(--primary))" strokeWidth={2.5} />
                <rect 
                  x={layout.totalScaledWidth / 2 - 60} 
                  y={-14} 
                  width={120} 
                  height={28} 
                  fill="hsl(var(--primary))" 
                  rx={4}
                />
                <text
                  x={layout.totalScaledWidth / 2}
                  y={4}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="bold"
                  fill="hsl(var(--primary-foreground))"
                >
                  VÃO: {totalWidth} mm
                </text>
              </g>
            )}
            
            {/* Total height dimension (left side) */}
            {layout.panels.length > 0 && (
              <g transform={`translate(${layout.padding.left - 30}, ${layout.padding.top + (layout.canvasHeight - layout.padding.top - layout.padding.bottom - layout.totalScaledHeight)})`}>
                <line x1={0} y1={0} x2={0} y2={layout.totalScaledHeight} stroke="hsl(var(--primary))" strokeWidth={2.5} />
                <line x1={-8} y1={0} x2={8} y2={0} stroke="hsl(var(--primary))" strokeWidth={2.5} />
                <line x1={-8} y1={layout.totalScaledHeight} x2={8} y2={layout.totalScaledHeight} stroke="hsl(var(--primary))" strokeWidth={2.5} />
                <rect 
                  x={-55} 
                  y={layout.totalScaledHeight / 2 - 12} 
                  width={50} 
                  height={24} 
                  fill="hsl(var(--primary))" 
                  rx={4}
                />
                <text
                  x={-30}
                  y={layout.totalScaledHeight / 2 + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="bold"
                  fill="hsl(var(--primary-foreground))"
                >
                  {totalHeight}
                </text>
              </g>
            )}
            
            {/* Lock height indicator */}
            {lockHeight > 0 && lockHeight < totalHeight && layout.panels.length > 0 && (
              <g>
                <line
                  x1={layout.padding.left - 15}
                  y1={layout.lockHeightY}
                  x2={layout.padding.left + layout.totalScaledWidth + 15}
                  y2={layout.lockHeightY}
                  stroke="hsl(var(--destructive))"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                />
                <rect 
                  x={layout.padding.left + layout.totalScaledWidth + 20} 
                  y={layout.lockHeightY - 10} 
                  width={65} 
                  height={20} 
                  fill="hsl(var(--destructive))" 
                  rx={3}
                />
                <text
                  x={layout.padding.left + layout.totalScaledWidth + 52}
                  y={layout.lockHeightY + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="white"
                >
                  Fecho: {lockHeight}
                </text>
              </g>
            )}
            
            {/* Quantity indicator */}
            <text
              x={layout.padding.left}
              y={25}
              fontSize="16"
              fontWeight="bold"
              fill="hsl(var(--muted-foreground))"
            >
              Quantidade: {quantity} unidade{quantity > 1 ? 's' : ''}
            </text>
          </svg>
        </div>
        
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Clique em um vidro para adicionar furos e recortes
        </p>
      </CardContent>
      
      {/* Hole/Cutout Editor Dialog */}
      {editingPanel && (
        <HoleCutoutEditor
          open={!!editingPanel}
          onOpenChange={(open) => !open && setEditingPanel(null)}
          panelLetter={editingPanel.letter}
          panelWidth={editingPanel.width}
          panelHeight={editingPanel.height}
          holes={panelModifications[editingPanel.id]?.holes || []}
          cutouts={panelModifications[editingPanel.id]?.cutouts || []}
          onHolesChange={handleHolesChange}
          onCutoutsChange={handleCutoutsChange}
        />
      )}
    </Card>
  );
}
