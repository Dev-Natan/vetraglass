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

  // Calculate total area
  const totalArea = glassCuts.reduce((sum, g) => sum + (g.areaM2 * g.quantity * productQuantity), 0);
  const totalPanels = glassCuts.reduce((sum, g) => sum + (g.quantity * productQuantity), 0);

  // Generate all panels with their positions
  const generatePanels = () => {
    const panels: { 
      label: string; 
      width: number; 
      height: number; 
      isMovable: boolean;
      glassName: string;
    }[] = [];
    
    glassCuts.forEach((glass) => {
      for (let i = 0; i < glass.quantity; i++) {
        panels.push({
          label: String.fromCharCode(65 + panels.length),
          width: glass.calculatedWidth,
          height: glass.calculatedHeight,
          isMovable: glass.isMovable ?? false,
          glassName: glass.glassName,
        });
      }
    });
    return panels;
  };

  const panels = generatePanels();
  
  // Calculate total width of all panels
  const totalPanelWidth = panels.reduce((sum, p) => sum + p.width, 0);
  const maxPanelHeight = Math.max(...panels.map(p => p.height));

  // SVG dimensions with margins for dimension lines
  const marginLeft = 60;
  const marginRight = 80;
  const marginTop = 40;
  const marginBottom = 70;
  
  // Calculate scale to fit nicely
  const maxDrawingWidth = 650;
  const maxDrawingHeight = 350;
  const scaleX = maxDrawingWidth / vaoWidth;
  const scaleY = maxDrawingHeight / vaoHeight;
  const scale = Math.min(scaleX, scaleY, 0.35);

  const drawingWidth = vaoWidth * scale;
  const drawingHeight = vaoHeight * scale;
  const svgWidth = drawingWidth + marginLeft + marginRight;
  const svgHeight = drawingHeight + marginTop + marginBottom;

  // Calculate panel positions
  const getPanelPositions = () => {
    const positions: { 
      label: string; 
      x: number; 
      y: number; 
      width: number; 
      height: number; 
      isMovable: boolean;
      glassName: string;
    }[] = [];
    
    let currentX = 0;
    panels.forEach((panel) => {
      const scaledWidth = panel.width * scale;
      const scaledHeight = panel.height * scale;
      const yOffset = (drawingHeight - scaledHeight) / 2;
      
      positions.push({
        label: panel.label,
        x: marginLeft + (currentX * scale),
        y: marginTop + yOffset,
        width: scaledWidth,
        height: scaledHeight,
        isMovable: panel.isMovable,
        glassName: panel.glassName,
      });
      currentX += panel.width;
    });
    
    return positions;
  };

  const panelPositions = getPanelPositions();

  // Get unique glass types for legend
  const uniqueGlassTypes = glassCuts.map((glass, idx) => {
    // Find first panel letter for this glass type
    let letterIndex = 0;
    for (let i = 0; i < idx; i++) {
      letterIndex += glassCuts[i].quantity;
    }
    const letters = Array.from({ length: glass.quantity }, (_, i) => 
      String.fromCharCode(65 + letterIndex + i)
    );
    
    return {
      letters,
      name: glass.glassName,
      width: glass.calculatedWidth,
      height: glass.calculatedHeight,
      quantity: glass.quantity,
      areaM2: glass.areaM2,
      widthFormula: glass.widthFormula,
      heightFormula: glass.heightFormula,
      isMovable: glass.isMovable ?? false,
    };
  });

  return (
    <div className="space-y-4">
      {/* SVG Technical Drawing */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-border overflow-x-auto">
        <svg 
          width={svgWidth} 
          height={svgHeight} 
          className="mx-auto"
          style={{ minWidth: svgWidth }}
        >
          {/* Background */}
          <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="currentColor" className="fill-background" />
          
          {/* VAO outer frame */}
          <rect
            x={marginLeft}
            y={marginTop}
            width={drawingWidth}
            height={drawingHeight}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="stroke-border"
          />

          {/* Glass panels */}
          {panelPositions.map((panel, idx) => (
            <g key={idx}>
              {/* Panel rectangle */}
              <rect
                x={panel.x}
                y={panel.y}
                width={panel.width}
                height={panel.height}
                className={panel.isMovable 
                  ? "fill-sky-100 dark:fill-sky-900/40 stroke-sky-500" 
                  : "fill-amber-50 dark:fill-amber-900/30 stroke-amber-500"
                }
                strokeWidth={2}
              />
              
              {/* Reflection effect line */}
              <line
                x1={panel.x + 4}
                y1={panel.y + 4}
                x2={panel.x + Math.min(panel.width * 0.4, 40)}
                y2={panel.y + 4}
                stroke="white"
                strokeWidth={2}
                opacity={0.6}
              />
              
              {/* Panel label - centered */}
              <text
                x={panel.x + panel.width / 2}
                y={panel.y + panel.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className={`text-2xl font-bold ${
                  panel.isMovable 
                    ? "fill-sky-700 dark:fill-sky-300" 
                    : "fill-amber-700 dark:fill-amber-300"
                }`}
              >
                {panel.label}
              </text>

              {/* Width dimension - top of panel */}
              <g>
                {/* Dimension line */}
                <line
                  x1={panel.x}
                  y1={panel.y - 12}
                  x2={panel.x + panel.width}
                  y2={panel.y - 12}
                  stroke="currentColor"
                  strokeWidth={1}
                  className="stroke-foreground"
                />
                {/* Left tick */}
                <line
                  x1={panel.x}
                  y1={panel.y - 8}
                  x2={panel.x}
                  y2={panel.y - 16}
                  stroke="currentColor"
                  strokeWidth={1}
                  className="stroke-foreground"
                />
                {/* Right tick */}
                <line
                  x1={panel.x + panel.width}
                  y1={panel.y - 8}
                  x2={panel.x + panel.width}
                  y2={panel.y - 16}
                  stroke="currentColor"
                  strokeWidth={1}
                  className="stroke-foreground"
                />
                {/* Dimension text */}
                <text
                  x={panel.x + panel.width / 2}
                  y={panel.y - 20}
                  textAnchor="middle"
                  className="fill-foreground text-[11px] font-mono font-medium"
                >
                  {panels[idx].width}
                </text>
              </g>

              {/* Height dimension - left of first panel or internal */}
              {idx === 0 && (
                <g>
                  {/* Dimension line */}
                  <line
                    x1={panel.x - 12}
                    y1={panel.y}
                    x2={panel.x - 12}
                    y2={panel.y + panel.height}
                    stroke="currentColor"
                    strokeWidth={1}
                    className="stroke-foreground"
                  />
                  {/* Top tick */}
                  <line
                    x1={panel.x - 8}
                    y1={panel.y}
                    x2={panel.x - 16}
                    y2={panel.y}
                    stroke="currentColor"
                    strokeWidth={1}
                    className="stroke-foreground"
                  />
                  {/* Bottom tick */}
                  <line
                    x1={panel.x - 8}
                    y1={panel.y + panel.height}
                    x2={panel.x - 16}
                    y2={panel.y + panel.height}
                    stroke="currentColor"
                    strokeWidth={1}
                    className="stroke-foreground"
                  />
                  {/* Dimension text */}
                  <text
                    x={panel.x - 20}
                    y={panel.y + panel.height / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(-90, ${panel.x - 20}, ${panel.y + panel.height / 2})`}
                    className="fill-foreground text-[11px] font-mono font-medium"
                  >
                    {panels[idx].height}
                  </text>
                </g>
              )}

              {/* Height on right side for each panel */}
              <text
                x={panel.x + panel.width - 4}
                y={panel.y + panel.height / 2}
                textAnchor="end"
                dominantBaseline="central"
                className={`text-[10px] font-mono ${
                  panel.isMovable 
                    ? "fill-sky-600 dark:fill-sky-400" 
                    : "fill-amber-600 dark:fill-amber-400"
                }`}
              >
                {panels[idx].height}
              </text>
            </g>
          ))}

          {/* Lock indicator */}
          {panelPositions.some(p => p.isMovable) && panelPositions.length > 1 && (
            <rect
              x={marginLeft + drawingWidth / 2 - 8}
              y={marginTop + drawingHeight - 25}
              width={16}
              height={16}
              className="fill-muted stroke-muted-foreground"
              strokeWidth={1.5}
            />
          )}

          {/* VAO Width dimension - bottom */}
          <g>
            <line
              x1={marginLeft}
              y1={marginTop + drawingHeight + 20}
              x2={marginLeft + drawingWidth}
              y2={marginTop + drawingHeight + 20}
              stroke="currentColor"
              strokeWidth={1}
              className="stroke-primary"
            />
            <line
              x1={marginLeft}
              y1={marginTop + drawingHeight + 15}
              x2={marginLeft}
              y2={marginTop + drawingHeight + 25}
              stroke="currentColor"
              strokeWidth={1}
              className="stroke-primary"
            />
            <line
              x1={marginLeft + drawingWidth}
              y1={marginTop + drawingHeight + 15}
              x2={marginLeft + drawingWidth}
              y2={marginTop + drawingHeight + 25}
              stroke="currentColor"
              strokeWidth={1}
              className="stroke-primary"
            />
            <text
              x={marginLeft + drawingWidth / 2}
              y={marginTop + drawingHeight + 38}
              textAnchor="middle"
              className="fill-primary text-xs font-medium"
            >
              {vaoWidth} VÃO
            </text>
          </g>

          {/* VAO Height dimension - right */}
          <g>
            <line
              x1={marginLeft + drawingWidth + 20}
              y1={marginTop}
              x2={marginLeft + drawingWidth + 20}
              y2={marginTop + drawingHeight}
              stroke="currentColor"
              strokeWidth={1}
              className="stroke-primary"
            />
            <line
              x1={marginLeft + drawingWidth + 15}
              y1={marginTop}
              x2={marginLeft + drawingWidth + 25}
              y2={marginTop}
              stroke="currentColor"
              strokeWidth={1}
              className="stroke-primary"
            />
            <line
              x1={marginLeft + drawingWidth + 15}
              y1={marginTop + drawingHeight}
              x2={marginLeft + drawingWidth + 25}
              y2={marginTop + drawingHeight}
              stroke="currentColor"
              strokeWidth={1}
              className="stroke-primary"
            />
            <text
              x={marginLeft + drawingWidth + 40}
              y={marginTop + drawingHeight / 2}
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(90, ${marginLeft + drawingWidth + 40}, ${marginTop + drawingHeight / 2})`}
              className="fill-primary text-xs font-medium"
            >
              {vaoHeight} VÃO
            </text>
          </g>
        </svg>
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
              {/* Letter badges */}
              <div className="flex gap-1">
                {glass.letters.map((letter) => (
                  <div 
                    key={letter}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground ${
                      glass.isMovable ? 'bg-sky-500' : 'bg-amber-500'
                    }`}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              
              {/* Glass name */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{glass.name}</div>
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
