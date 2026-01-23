import { Badge } from '@/components/ui/badge';
import { Square, Layers, Ruler } from 'lucide-react';

interface GlassCutData {
  glassName: string;
  widthFormula: string;
  heightFormula: string;
  calculatedWidth: number;
  calculatedHeight: number;
  areaM2: number;
  quantity: number;
  isMovable?: boolean;
  panelIndex?: number;
}

interface OSGlassUnifiedViewProps {
  glassCuts: GlassCutData[];
  vaoWidth: number;
  vaoHeight: number;
  productQuantity: number;
}

export function OSGlassUnifiedView({ glassCuts, vaoWidth, vaoHeight, productQuantity }: OSGlassUnifiedViewProps) {
  if (!glassCuts || glassCuts.length === 0) return null;

  // Calculate total width and max height for positioning
  const totalGlassWidth = glassCuts.reduce((sum, g) => sum + g.calculatedWidth * g.quantity, 0);
  const maxGlassHeight = Math.max(...glassCuts.map(g => g.calculatedHeight));
  
  // Calculate total area
  const totalArea = glassCuts.reduce((sum, g) => sum + (g.areaM2 * g.quantity * productQuantity), 0);
  const totalPanels = glassCuts.reduce((sum, g) => sum + (g.quantity * productQuantity), 0);

  // Calculate scale to fit in container (max 600px width, 400px height)
  const maxContainerWidth = 600;
  const maxContainerHeight = 350;
  const scaleX = maxContainerWidth / vaoWidth;
  const scaleY = maxContainerHeight / vaoHeight;
  const scale = Math.min(scaleX, scaleY, 0.4); // Max scale of 0.4 to keep it readable

  const containerWidth = vaoWidth * scale;
  const containerHeight = vaoHeight * scale;

  // Generate panel labels (A, B, C, D...)
  const generatePanelLabels = () => {
    const labels: { label: string; width: number; height: number; isMovable: boolean }[] = [];
    glassCuts.forEach((glass, idx) => {
      for (let i = 0; i < glass.quantity; i++) {
        labels.push({
          label: String.fromCharCode(65 + labels.length), // A, B, C, D...
          width: glass.calculatedWidth,
          height: glass.calculatedHeight,
          isMovable: glass.isMovable ?? false,
        });
      }
    });
    return labels;
  };

  const panelLabels = generatePanelLabels();
  
  // Calculate panel positions (side by side)
  const calculatePanelPositions = () => {
    const positions: { label: string; x: number; y: number; width: number; height: number; isMovable: boolean }[] = [];
    let currentX = 0;
    
    panelLabels.forEach((panel, idx) => {
      positions.push({
        label: panel.label,
        x: currentX,
        y: (vaoHeight - panel.height) / 2, // Center vertically
        width: panel.width,
        height: panel.height,
        isMovable: panel.isMovable,
      });
      currentX += panel.width;
    });
    
    return positions;
  };

  const panelPositions = calculatePanelPositions();

  // Get unique glass types for legend
  const uniqueGlassTypes = glassCuts.map((glass, idx) => ({
    label: String.fromCharCode(65 + idx),
    name: glass.glassName,
    width: glass.calculatedWidth,
    height: glass.calculatedHeight,
    quantity: glass.quantity,
    areaM2: glass.areaM2,
    widthFormula: glass.widthFormula,
    heightFormula: glass.heightFormula,
    isMovable: glass.isMovable ?? false,
  }));

  return (
    <div className="space-y-4">
      {/* Unified Glass Diagram */}
      <div className="relative bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl p-6 border-2 border-slate-200 dark:border-slate-700 overflow-x-auto">
        {/* Main diagram container */}
        <div className="flex justify-center">
          <div className="relative" style={{ width: containerWidth + 100, height: containerHeight + 100 }}>
            {/* VAO outer frame with dimension lines */}
            <svg 
              width={containerWidth + 100} 
              height={containerHeight + 100} 
              className="absolute inset-0"
            >
              {/* VAO rectangle */}
              <rect
                x={50}
                y={25}
                width={containerWidth}
                height={containerHeight}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="text-slate-400 dark:text-slate-500"
              />
              
              {/* Bottom dimension line - VAO Width */}
              <line x1={50} y1={containerHeight + 40} x2={50 + containerWidth} y2={containerHeight + 40} 
                stroke="currentColor" strokeWidth={1} className="text-blue-600" />
              <line x1={50} y1={containerHeight + 35} x2={50} y2={containerHeight + 45} 
                stroke="currentColor" strokeWidth={1} className="text-blue-600" />
              <line x1={50 + containerWidth} y1={containerHeight + 35} x2={50 + containerWidth} y2={containerHeight + 45} 
                stroke="currentColor" strokeWidth={1} className="text-blue-600" />
              <text 
                x={50 + containerWidth / 2} 
                y={containerHeight + 55} 
                textAnchor="middle" 
                className="fill-blue-600 text-xs font-medium"
              >
                {vaoWidth} VÃO
              </text>

              {/* Right dimension line - VAO Height */}
              <line x1={containerWidth + 65} y1={25} x2={containerWidth + 65} y2={25 + containerHeight} 
                stroke="currentColor" strokeWidth={1} className="text-blue-600" />
              <line x1={containerWidth + 60} y1={25} x2={containerWidth + 70} y2={25} 
                stroke="currentColor" strokeWidth={1} className="text-blue-600" />
              <line x1={containerWidth + 60} y1={25 + containerHeight} x2={containerWidth + 70} y2={25 + containerHeight} 
                stroke="currentColor" strokeWidth={1} className="text-blue-600" />
              <text 
                x={containerWidth + 80} 
                y={25 + containerHeight / 2} 
                textAnchor="middle" 
                className="fill-blue-600 text-xs font-medium"
                transform={`rotate(90, ${containerWidth + 80}, ${25 + containerHeight / 2})`}
              >
                {vaoHeight} VÃO
              </text>
            </svg>

            {/* Glass panels */}
            {panelPositions.map((panel, idx) => {
              const panelX = 50 + (panel.x * scale);
              const panelY = 25 + (panel.y * scale);
              const panelWidth = panel.width * scale;
              const panelHeight = panel.height * scale;
              
              return (
                <div
                  key={idx}
                  className={`absolute border-2 ${
                    panel.isMovable 
                      ? 'bg-gradient-to-br from-sky-200/80 via-sky-100/60 to-cyan-50/50 dark:from-sky-400/30 dark:via-sky-300/20 dark:to-cyan-200/10 border-sky-500' 
                      : 'bg-gradient-to-br from-amber-100/80 via-amber-50/60 to-yellow-50/50 dark:from-amber-400/30 dark:via-amber-300/20 dark:to-yellow-200/10 border-amber-500'
                  }`}
                  style={{
                    left: panelX,
                    top: panelY,
                    width: panelWidth,
                    height: panelHeight,
                  }}
                >
                  {/* Reflection effect */}
                  <div 
                    className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-transparent"
                    style={{ clipPath: 'polygon(0 0, 60% 0, 0 60%)' }}
                  />
                  
                  {/* Panel label */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-2xl font-bold ${
                      panel.isMovable ? 'text-sky-700 dark:text-sky-300' : 'text-amber-700 dark:text-amber-300'
                    }`}>
                      {panel.label}
                    </span>
                  </div>
                  
                  {/* Width dimension - top */}
                  {panelWidth > 60 && (
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono font-medium text-slate-600 dark:text-slate-400">
                      {panel.width}
                    </div>
                  )}
                  
                  {/* Height dimension - left */}
                  <div 
                    className="absolute -left-6 top-1/2 -translate-y-1/2 text-[10px] font-mono font-medium text-slate-600 dark:text-slate-400"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg) translateX(50%)' }}
                  >
                    {panel.height}
                  </div>
                </div>
              );
            })}
            
            {/* Lock indicator (small square in the middle bottom area) */}
            {panelPositions.some(p => p.isMovable) && (
              <div
                className="absolute bg-slate-200 dark:bg-slate-600 border-2 border-slate-400 dark:border-slate-500"
                style={{
                  left: 50 + (containerWidth / 2) - 8,
                  top: 25 + containerHeight - 30,
                  width: 16,
                  height: 16,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Legend / Details Table */}
      <div className="bg-muted/30 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Ruler className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Detalhamento dos Vidros</span>
        </div>
        
        <div className="grid gap-2">
          {uniqueGlassTypes.map((glass, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-4 bg-card rounded-lg p-3 border"
            >
              {/* Letter badge */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                glass.isMovable 
                  ? 'bg-sky-500 text-white' 
                  : 'bg-amber-500 text-white'
              }`}>
                {glass.label}
              </div>
              
              {/* Glass name */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{glass.name}</div>
                <div className="text-xs text-muted-foreground">
                  {glass.isMovable ? 'Vidro Móvel' : 'Vidro Fixo'}
                </div>
              </div>
              
              {/* Dimensions */}
              <div className="text-center">
                <div className="font-mono font-bold text-primary">
                  {glass.width} × {glass.height}
                </div>
                <div className="text-[10px] text-muted-foreground">mm</div>
              </div>
              
              {/* Formulas */}
              <div className="hidden sm:flex gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  L: {glass.widthFormula}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  A: {glass.heightFormula}
                </Badge>
              </div>
              
              {/* Quantity */}
              <Badge variant="secondary">
                {glass.quantity * productQuantity}×
              </Badge>
              
              {/* Area */}
              <div className="text-right">
                <div className="font-medium text-sm">{(glass.areaM2 * glass.quantity * productQuantity).toFixed(3)}</div>
                <div className="text-[10px] text-muted-foreground">m²</div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Totals row */}
        <div className="flex items-center justify-end gap-6 mt-4 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className="font-bold">{totalPanels} painéis</span>
          </div>
          <div className="flex items-center gap-2">
            <Square className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Área:</span>
            <span className="font-bold text-primary">{totalArea.toFixed(3)} m²</span>
          </div>
        </div>
      </div>
    </div>
  );
}
