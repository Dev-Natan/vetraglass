import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { GlassPanelData } from '@/pages/Producao';
import { Circle, Square, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
import { HoleCutoutEditor, Hole, Cutout } from './HoleCutoutEditor';
import { cn } from '@/lib/utils';

interface GlassProjectCanvasProps {
  panels: GlassPanelData[];
  totalWidth: number;
  totalHeight: number;
  quantity: number;
  lockHeight: number;
  panelModifications: Record<string, { holes: Hole[]; cutouts: Cutout[] }>;
  onPanelModificationsChange: (mods: Record<string, { holes: Hole[]; cutouts: Cutout[] }>) => void;
  glassType?: string;
  hardwareType?: string;
}

// Glass colors with gradients for realistic look
const PANEL_COLORS = [
  { fillStart: '#d4e9f7', fillEnd: '#a8d4f0', stroke: '#2563eb', text: '#1e40af' },
  { fillStart: '#d1fae5', fillEnd: '#a7f3d0', stroke: '#059669', text: '#047857' },
  { fillStart: '#fef3c7', fillEnd: '#fde68a', stroke: '#d97706', text: '#b45309' },
  { fillStart: '#fce7f3', fillEnd: '#fbcfe8', stroke: '#db2777', text: '#be185d' },
  { fillStart: '#e0e7ff', fillEnd: '#c7d2fe', stroke: '#6366f1', text: '#4f46e5' },
];

export function GlassProjectCanvas({ 
  panels, 
  totalWidth, 
  totalHeight, 
  quantity,
  lockHeight,
  panelModifications,
  onPanelModificationsChange,
  glassType = 'CRISTAL INCOLOR 10MM - TEMPERADO',
  hardwareType = 'Ferragens cromadas'
}: GlassProjectCanvasProps) {
  const [editingPanel, setEditingPanel] = useState<GlassPanelData | null>(null);
  const [hoveredPanel, setHoveredPanel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  
  // Calculate total area and weight
  const { totalArea, estimatedWeight } = useMemo(() => {
    const area = panels.reduce((sum, p) => sum + (p.width * p.height) / 1000000, 0);
    // Estimate weight: 2.5 kg/m² per mm of thickness (assuming 10mm glass)
    const weight = area * 25; // 10mm glass = 25 kg/m²
    return { totalArea: area * quantity, estimatedWeight: weight * quantity };
  }, [panels, quantity]);

  const layout = useMemo(() => {
    const padding = { top: 100, right: 140, bottom: 90, left: 80 };
    const canvasWidth = 900;
    const canvasHeight = 560;
    const drawAreaWidth = canvasWidth - padding.left - padding.right;
    const drawAreaHeight = canvasHeight - padding.top - padding.bottom;
    
    // Calculate total glass width
    const glassWidth = panels.reduce((sum, p) => sum + p.width, 0);
    const maxGlassHeight = Math.max(...panels.map(p => p.height), 0);
    
    // Calculate scale with zoom
    const baseScaleX = drawAreaWidth / (glassWidth || 1);
    const baseScaleY = drawAreaHeight / (maxGlassHeight || 1);
    const baseScale = Math.min(baseScaleX, baseScaleY, 0.3);
    const scale = baseScale * (zoom / 100);
    
    // Position panels
    let currentX = 0;
    const gap = 4;
    const positionedPanels = panels.map((panel, index) => {
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
        color: PANEL_COLORS[index % PANEL_COLORS.length]
      };
    });
    
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
  }, [panels, lockHeight, zoom]);

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

  const resetZoom = () => setZoom(100);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 border-b bg-gradient-to-r from-muted/50 to-background">
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold">Visualização do Projeto</span>
            <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
              <span className="flex items-center gap-1 bg-muted/80 px-2 py-1 rounded-md">
                <Circle className="w-3 h-3 text-primary" /> Furos
              </span>
              <span className="flex items-center gap-1 bg-muted/80 px-2 py-1 rounded-md">
                <Square className="w-3 h-3 text-orange-500" /> Recortes
              </span>
            </div>
          </div>
          
          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.max(50, zoom - 10))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <div className="w-24 flex items-center gap-2">
              <Slider
                value={[zoom]}
                onValueChange={([v]) => setZoom(v)}
                min={50}
                max={150}
                step={10}
                className="w-full"
              />
            </div>
            <span className="text-xs text-muted-foreground w-10">{zoom}%</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.min(150, zoom + 10))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetZoom}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Summary Stats */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2 bg-muted/60 px-3 py-2 rounded-lg">
            <Maximize2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Área total:</span>
            <span className="font-semibold">{totalArea.toFixed(2)} m²</span>
          </div>
          <div className="flex items-center gap-2 bg-muted/60 px-3 py-2 rounded-lg">
            <span className="text-muted-foreground">Peso estimado:</span>
            <span className="font-semibold">{estimatedWeight.toFixed(1)} kg</span>
          </div>
          <div className="flex items-center gap-2 bg-muted/60 px-3 py-2 rounded-lg">
            <span className="text-muted-foreground">Peças:</span>
            <span className="font-semibold">{panels.length} × {quantity} = {panels.length * quantity}</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl border-2 border-muted shadow-inner overflow-auto">
          <svg 
            viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
            className="w-full h-auto"
            style={{ minHeight: '460px', maxHeight: '560px' }}
          >
            {/* Gradients definitions */}
            <defs>
              {PANEL_COLORS.map((color, i) => (
                <linearGradient key={i} id={`glass-gradient-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={color.fillStart} />
                  <stop offset="100%" stopColor={color.fillEnd} />
                </linearGradient>
              ))}
              {/* Reflection effect */}
              <linearGradient id="glass-reflection" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="white" stopOpacity="0.4" />
                <stop offset="50%" stopColor="white" stopOpacity="0.1" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
              {/* Shadow filter */}
              <filter id="panel-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="3" stdDeviation="3" floodOpacity="0.15" />
              </filter>
            </defs>
            
            {/* Background pattern */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" strokeOpacity="0.3"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Header info - Glass type and hardware */}
            <g transform="translate(20, 20)">
              <rect x="0" y="0" width="280" height="55" rx="8" fill="hsl(var(--background))" stroke="hsl(var(--border))" />
              <text x="12" y="24" fontSize="13" fontWeight="bold" fill="hsl(var(--foreground))">
                {glassType}
              </text>
              <text x="12" y="42" fontSize="11" fill="hsl(var(--muted-foreground))">
                {hardwareType}
              </text>
            </g>
            
            {/* VÃO indicators in top-right corner */}
            <g transform={`translate(${layout.canvasWidth - 150}, 15)`}>
              <rect x={0} y={0} width={140} height={55} fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary) / 0.3)" rx={8} />
              <text x={70} y={22} textAnchor="middle" fontSize="12" fontWeight="bold" fill="hsl(var(--primary))">
                {totalWidth} mm × Vão
              </text>
              <line x1={10} y1={30} x2={130} y2={30} stroke="hsl(var(--primary) / 0.3)" />
              <text x={70} y={46} textAnchor="middle" fontSize="12" fontWeight="bold" fill="hsl(var(--primary))">
                {totalHeight} mm × Vão
              </text>
            </g>
            
            {/* Glass panels */}
            {layout.panels.map((panel, index) => {
              const mods = panelModifications[panel.id] || { holes: [], cutouts: [] };
              const hasModifications = mods.holes.length > 0 || mods.cutouts.length > 0;
              const isHovered = hoveredPanel === panel.id;
              
              return (
                <g 
                  key={panel.id}
                  className={cn(
                    "transition-transform duration-200",
                    isHovered && "cursor-pointer"
                  )}
                  style={{ transform: isHovered ? 'translateY(-2px)' : 'none' }}
                >
                  {/* Panel rectangle with gradient and shadow */}
                  <rect
                    x={panel.x}
                    y={panel.y}
                    width={panel.scaledWidth}
                    height={panel.scaledHeight}
                    fill={`url(#glass-gradient-${index % PANEL_COLORS.length})`}
                    stroke={panel.color.stroke}
                    strokeWidth={isHovered ? 3 : 2}
                    rx={2}
                    filter="url(#panel-shadow)"
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => handleEditPanel(panel)}
                    onMouseEnter={() => setHoveredPanel(panel.id)}
                    onMouseLeave={() => setHoveredPanel(null)}
                  />
                  
                  {/* Reflection effect on glass */}
                  <rect
                    x={panel.x + 2}
                    y={panel.y + 2}
                    width={panel.scaledWidth - 4}
                    height={(panel.scaledHeight - 4) * 0.3}
                    fill="url(#glass-reflection)"
                    rx={1}
                    className="pointer-events-none"
                  />
                  
                  {/* Draw holes - X from left edge, Y from TOP edge */}
                  {mods.holes.map(hole => {
                    const cx = panel.x + hole.x * layout.scale;
                    const cy = panel.y + hole.y * layout.scale;
                    const r = (hole.diameter / 2) * layout.scale;
                    return (
                      <g key={hole.id}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={Math.max(r, 4)}
                          fill="hsl(var(--background))"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                        />
                        {/* Reference lines */}
                        <line
                          x1={panel.x}
                          y1={cy}
                          x2={cx - Math.max(r, 4)}
                          y2={cy}
                          stroke="hsl(var(--primary))"
                          strokeWidth={1}
                          strokeDasharray="3,3"
                          opacity={0.6}
                        />
                        <line
                          x1={cx}
                          y1={panel.y}
                          x2={cx}
                          y2={cy - Math.max(r, 4)}
                          stroke="hsl(var(--primary))"
                          strokeWidth={1}
                          strokeDasharray="3,3"
                          opacity={0.6}
                        />
                        {/* Dimension label */}
                        <text
                          x={panel.x - 5}
                          y={cy + 3}
                          textAnchor="end"
                          fontSize="8"
                          fill="hsl(var(--primary))"
                        >
                          {hole.y}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Draw cutouts */}
                  {mods.cutouts.map(cutout => {
                    const rectX = panel.x + cutout.x * layout.scale;
                    const rectY = panel.y + panel.scaledHeight - (cutout.y * layout.scale) - (cutout.height * layout.scale);
                    const w = cutout.width * layout.scale;
                    const h = cutout.height * layout.scale;
                    return (
                      <rect
                        key={cutout.id}
                        x={rectX}
                        y={rectY}
                        width={Math.max(w, 4)}
                        height={Math.max(h, 4)}
                        fill="hsl(var(--background))"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                        rx={1}
                      />
                    );
                  })}
                  
                  {/* Letter label with circle background */}
                  <circle
                    cx={panel.x + panel.scaledWidth / 2}
                    cy={panel.y + panel.scaledHeight / 2}
                    r={Math.min(panel.scaledWidth, panel.scaledHeight) * 0.15 + 8}
                    fill="white"
                    fillOpacity={0.9}
                    stroke={panel.color.stroke}
                    strokeWidth={1.5}
                    className="pointer-events-none"
                  />
                  <text
                    x={panel.x + panel.scaledWidth / 2}
                    y={panel.y + panel.scaledHeight / 2 + 7}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={panel.color.text}
                    fontSize="26"
                    fontWeight="bold"
                    className="pointer-events-none select-none"
                  >
                    {panel.letter}
                  </text>
                  
                  {/* Modification count badge */}
                  {hasModifications && (
                    <g transform={`translate(${panel.x + panel.scaledWidth - 10}, ${panel.y + 10})`}>
                      <circle r="10" fill="hsl(var(--destructive))" />
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        y={1}
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {mods.holes.length + mods.cutouts.length}
                      </text>
                    </g>
                  )}
                  
                  {/* Height dimension on left side */}
                  <g transform={`translate(${panel.x - 12}, ${panel.y + panel.scaledHeight / 2})`}>
                    <rect x="-22" y="-8" width="32" height="16" rx="3" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="0.5" />
                    <text
                      x="-6"
                      textAnchor="end"
                      dominantBaseline="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill="hsl(var(--foreground))"
                    >
                      {panel.height}
                    </text>
                  </g>
                  
                  {/* Width dimension below panel */}
                  <g transform={`translate(${panel.x + panel.scaledWidth / 2}, ${layout.bottomY + 18})`}>
                    <rect x="-22" y="-8" width="44" height="16" rx="3" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="0.5" />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill="hsl(var(--foreground))"
                    >
                      {panel.width}
                    </text>
                  </g>
                  
                  {/* Hover tooltip */}
                  {isHovered && (
                    <g transform={`translate(${panel.x + panel.scaledWidth / 2}, ${panel.y - 15})`}>
                      <rect x="-50" y="-20" width="100" height="18" rx="4" fill="hsl(var(--foreground))" />
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        y="-11"
                        fontSize="10"
                        fill="hsl(var(--background))"
                      >
                        Clique para editar
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            
            {/* Lock height indicator with dimension */}
            {lockHeight > 0 && lockHeight < totalHeight && layout.panels.length > 0 && (
              <g>
                {/* Dashed horizontal line for lock position */}
                <line
                  x1={layout.padding.left - 30}
                  y1={layout.lockHeightY}
                  x2={layout.padding.left + layout.totalScaledWidth + 30}
                  y2={layout.lockHeightY}
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                />
                
                {/* Lock icon indicator */}
                <g transform={`translate(${layout.padding.left + layout.totalScaledWidth + 40}, ${layout.lockHeightY})`}>
                  <rect x="-5" y="-10" width="50" height="20" rx="4" fill="hsl(var(--destructive) / 0.15)" stroke="hsl(var(--destructive))" />
                  <text
                    x="20"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight="600"
                    fill="hsl(var(--destructive))"
                  >
                    {lockHeight}
                  </text>
                </g>
              </g>
            )}
            
            {/* Total VÃO dimensions - Excel style */}
            {layout.panels.length > 0 && (
              <>
                {/* Bottom total width with VÃO label */}
                <g transform={`translate(${layout.padding.left}, ${layout.bottomY + 50})`}>
                  <line x1={0} y1={0} x2={layout.totalScaledWidth} y2={0} stroke="hsl(var(--foreground))" strokeWidth={2} />
                  <line x1={0} y1={-6} x2={0} y2={6} stroke="hsl(var(--foreground))" strokeWidth={2} />
                  <line x1={layout.totalScaledWidth} y1={-6} x2={layout.totalScaledWidth} y2={6} stroke="hsl(var(--foreground))" strokeWidth={2} />
                  <rect x={layout.totalScaledWidth / 2 - 40} y={4} width={80} height={20} rx={4} fill="hsl(var(--primary))" />
                  <text
                    x={layout.totalScaledWidth / 2}
                    y={17}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="bold"
                    fill="white"
                  >
                    {totalWidth} VÃO
                  </text>
                </g>
                
                {/* Right side total height with VÃO label */}
                <g transform={`translate(${layout.padding.left + layout.totalScaledWidth + 70}, ${layout.bottomY - layout.totalScaledHeight})`}>
                  <line x1={0} y1={0} x2={0} y2={layout.totalScaledHeight} stroke="hsl(var(--foreground))" strokeWidth={2} />
                  <line x1={-6} y1={0} x2={6} y2={0} stroke="hsl(var(--foreground))" strokeWidth={2} />
                  <line x1={-6} y1={layout.totalScaledHeight} x2={6} y2={layout.totalScaledHeight} stroke="hsl(var(--foreground))" strokeWidth={2} />
                  <g transform={`translate(12, ${layout.totalScaledHeight / 2})`}>
                    <rect x="-5" y="-12" width="60" height="24" rx={4} fill="hsl(var(--primary))" />
                    <text
                      x="25"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="11"
                      fontWeight="bold"
                      fill="white"
                    >
                      VÃO
                    </text>
                  </g>
                  <text
                    x={20}
                    y={layout.totalScaledHeight / 2 + 22}
                    textAnchor="start"
                    fontSize="12"
                    fontWeight="bold"
                    fill="hsl(var(--foreground))"
                  >
                    {totalHeight}
                  </text>
                </g>
              </>
            )}
            
            {/* Quantity indicator */}
            <g transform={`translate(${layout.padding.left}, ${layout.bottomY + 78})`}>
              <rect x="0" y="-6" width="60" height="22" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
              <text
                x="8"
                y="6"
                fontSize="14"
                fontWeight="bold"
                fill="hsl(var(--foreground))"
              >
                × {quantity}
              </text>
              <text
                x="68"
                y="6"
                fontSize="11"
                fill="hsl(var(--muted-foreground))"
              >
                conjuntos
              </text>
            </g>
          </svg>
        </div>
        
        <p className="text-xs text-muted-foreground mt-3 text-center flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-1 rounded">
            💡 Clique em um vidro para adicionar furos e recortes
          </span>
        </p>
      </CardContent>
      
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
