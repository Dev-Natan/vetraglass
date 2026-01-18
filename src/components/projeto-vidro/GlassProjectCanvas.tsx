import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GlassPanelData } from '@/pages/ProjetoVidro';
import { Circle, Square } from 'lucide-react';
import { HoleCutoutEditor, Hole, Cutout } from './HoleCutoutEditor';

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

// More subtle colors inspired by Excel templates
const PANEL_COLORS = [
  { fill: '#e8f4fc', stroke: '#3b82f6', text: '#1d4ed8' },
  { fill: '#e8f4fc', stroke: '#3b82f6', text: '#1d4ed8' },
  { fill: '#e8f4fc', stroke: '#3b82f6', text: '#1d4ed8' },
  { fill: '#e8f4fc', stroke: '#3b82f6', text: '#1d4ed8' },
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

  const layout = useMemo(() => {
    const padding = { top: 100, right: 120, bottom: 80, left: 80 };
    const canvasWidth = 850;
    const canvasHeight = 520;
    const drawAreaWidth = canvasWidth - padding.left - padding.right;
    const drawAreaHeight = canvasHeight - padding.top - padding.bottom;
    
    // Calculate total glass width
    const glassWidth = panels.reduce((sum, p) => sum + p.width, 0);
    const maxGlassHeight = Math.max(...panels.map(p => p.height), 0);
    
    // Calculate scale
    const scaleX = drawAreaWidth / (glassWidth || 1);
    const scaleY = drawAreaHeight / (maxGlassHeight || 1);
    const scale = Math.min(scaleX, scaleY, 0.28);
    
    // Position panels
    let currentX = 0;
    const gap = 3;
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
      <CardHeader className="pb-2 border-b">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Visualização do Projeto</span>
          <div className="flex items-center gap-3 text-xs font-normal text-muted-foreground">
            <span className="flex items-center gap-1">
              <Circle className="w-3 h-3" /> Furos
            </span>
            <span className="flex items-center gap-1">
              <Square className="w-3 h-3" /> Recortes
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="bg-white rounded-lg border-2 border-muted overflow-auto">
          <svg 
            viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
            className="w-full h-auto"
            style={{ minHeight: '420px', maxHeight: '520px' }}
          >
            {/* White background */}
            <rect width="100%" height="100%" fill="white" />
            
            {/* Header info - Glass type and hardware */}
            <text
              x={20}
              y={28}
              fontSize="13"
              fontWeight="bold"
              fill="#1f2937"
            >
              {glassType}
            </text>
            <text
              x={20}
              y={48}
              fontSize="11"
              fill="#6b7280"
            >
              {hardwareType}
            </text>
            
            {/* VÃO indicators in top-right corner */}
            <g transform={`translate(${layout.canvasWidth - 140}, 15)`}>
              <rect x={0} y={0} width={130} height={50} fill="#f3f4f6" stroke="#d1d5db" rx={4} />
              <text x={65} y={20} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#374151">
                {totalWidth} Vão
              </text>
              <line x1={10} y1={28} x2={120} y2={28} stroke="#d1d5db" />
              <text x={65} y={42} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#374151">
                {totalHeight} Vão
              </text>
            </g>
            
            {/* Glass panels */}
            {layout.panels.map((panel, index) => {
              const mods = panelModifications[panel.id] || { holes: [], cutouts: [] };
              const hasModifications = mods.holes.length > 0 || mods.cutouts.length > 0;
              
              return (
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
                    className="cursor-pointer hover:stroke-[3px] transition-all"
                    onClick={() => handleEditPanel(panel)}
                  />
                  
                  {/* Draw holes - X from left edge, Y from bottom edge */}
                  {mods.holes.map(hole => {
                    // X: distance from left edge of panel
                    const cx = panel.x + hole.x * layout.scale;
                    // Y: distance from bottom edge (inverted for SVG)
                    const cy = panel.y + panel.scaledHeight - (hole.y * layout.scale);
                    // Diameter scaled
                    const r = (hole.diameter / 2) * layout.scale;
                    return (
                      <g key={hole.id}>
                        {/* Hole circle */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={Math.max(r, 4)}
                          fill="white"
                          stroke="#ef4444"
                          strokeWidth={1.5}
                        />
                        {/* Reference lines to show position */}
                        <line
                          x1={panel.x}
                          y1={cy}
                          x2={cx - Math.max(r, 4)}
                          y2={cy}
                          stroke="#ef4444"
                          strokeWidth={0.5}
                          strokeDasharray="2,2"
                          opacity={0.7}
                        />
                        <line
                          x1={cx}
                          y1={panel.y + panel.scaledHeight}
                          x2={cx}
                          y2={cy + Math.max(r, 4)}
                          stroke="#ef4444"
                          strokeWidth={0.5}
                          strokeDasharray="2,2"
                          opacity={0.7}
                        />
                      </g>
                    );
                  })}
                  
                  {/* Draw cutouts - X,Y from bottom-left corner (position is bottom-left of cutout) */}
                  {mods.cutouts.map(cutout => {
                    // X: distance from left edge of panel to left edge of cutout
                    const rectX = panel.x + cutout.x * layout.scale;
                    // Y: distance from bottom, then subtract height for SVG (top-left origin)
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
                        fill="white"
                        stroke="#f97316"
                        strokeWidth={1.5}
                      />
                    );
                  })}
                  
                  {/* Letter label */}
                  <text
                    x={panel.x + panel.scaledWidth / 2}
                    y={panel.y + panel.scaledHeight / 2 + 6}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={panel.color.text}
                    fontSize="28"
                    fontWeight="bold"
                    className="pointer-events-none select-none"
                  >
                    {panel.letter}
                  </text>
                  
                  {/* Modification count badge */}
                  {hasModifications && (
                    <g transform={`translate(${panel.x + panel.scaledWidth - 12}, ${panel.y + 12})`}>
                      <circle r="8" fill="#ef4444" />
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        {mods.holes.length + mods.cutouts.length}
                      </text>
                    </g>
                  )}
                  
                  {/* Height dimension on left side of each panel (Excel style) */}
                  <text
                    x={panel.x - 8}
                    y={panel.y + panel.scaledHeight / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize="12"
                    fontWeight="600"
                    fill="#1f2937"
                  >
                    {panel.height}
                  </text>
                  
                  {/* Width dimension below each panel (Excel style) */}
                  <text
                    x={panel.x + panel.scaledWidth / 2}
                    y={layout.bottomY + 20}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="600"
                    fill="#1f2937"
                  >
                    {panel.width}
                  </text>
                </g>
              );
            })}
            
            {/* Lock height indicator with dimension */}
            {lockHeight > 0 && lockHeight < totalHeight && layout.panels.length > 0 && (
              <g>
                {/* Dashed horizontal line for lock position */}
                <line
                  x1={layout.padding.left - 20}
                  y1={layout.lockHeightY}
                  x2={layout.padding.left + layout.totalScaledWidth + 20}
                  y2={layout.lockHeightY}
                  stroke="#dc2626"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
                
                {/* Lock position dimension */}
                <text
                  x={layout.padding.left + layout.totalScaledWidth + 28}
                  y={layout.lockHeightY + 4}
                  fontSize="11"
                  fontWeight="600"
                  fill="#dc2626"
                >
                  {lockHeight}
                </text>
              </g>
            )}
            
            {/* Total VÃO dimensions - Excel style */}
            {layout.panels.length > 0 && (
              <>
                {/* Bottom total width with VÃO label */}
                <g transform={`translate(${layout.padding.left}, ${layout.bottomY + 45})`}>
                  <line x1={0} y1={0} x2={layout.totalScaledWidth} y2={0} stroke="#374151" strokeWidth={1.5} />
                  <line x1={0} y1={-5} x2={0} y2={5} stroke="#374151" strokeWidth={1.5} />
                  <line x1={layout.totalScaledWidth} y1={-5} x2={layout.totalScaledWidth} y2={5} stroke="#374151" strokeWidth={1.5} />
                  <text
                    x={layout.totalScaledWidth / 2}
                    y={16}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="bold"
                    fill="#1f2937"
                  >
                    {totalWidth} VÃO
                  </text>
                </g>
                
                {/* Right side total height with VÃO label */}
                <g transform={`translate(${layout.padding.left + layout.totalScaledWidth + 60}, ${layout.bottomY - layout.totalScaledHeight})`}>
                  <line x1={0} y1={0} x2={0} y2={layout.totalScaledHeight} stroke="#374151" strokeWidth={1.5} />
                  <line x1={-5} y1={0} x2={5} y2={0} stroke="#374151" strokeWidth={1.5} />
                  <line x1={-5} y1={layout.totalScaledHeight} x2={5} y2={layout.totalScaledHeight} stroke="#374151" strokeWidth={1.5} />
                  <text
                    x={0}
                    y={layout.totalScaledHeight / 2}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fontSize="12"
                    fontWeight="bold"
                    fill="#1f2937"
                    transform={`translate(12, 0)`}
                  >
                    VÃO
                  </text>
                  <text
                    x={0}
                    y={layout.totalScaledHeight / 2 + 14}
                    textAnchor="start"
                    fontSize="12"
                    fontWeight="bold"
                    fill="#1f2937"
                    transform={`translate(12, 0)`}
                  >
                    {totalHeight}
                  </text>
                </g>
              </>
            )}
            
            {/* Quantity indicator (X indicator like Excel) */}
            <g transform={`translate(${layout.padding.left}, ${layout.bottomY + 65})`}>
              <text
                fontSize="14"
                fontWeight="bold"
                fill="#374151"
              >
                X
              </text>
              <text
                x={16}
                fontSize="14"
                fontWeight="bold"
                fill="#374151"
              >
                {quantity}
              </text>
            </g>
          </svg>
        </div>
        
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Clique em um vidro para adicionar furos e recortes
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
