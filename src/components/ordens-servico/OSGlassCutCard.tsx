import { Badge } from '@/components/ui/badge';
import { Layers, Ruler, Square, ArrowRight } from 'lucide-react';

interface GlassCutData {
  glassName: string;
  widthFormula: string;
  heightFormula: string;
  calculatedWidth: number;
  calculatedHeight: number;
  areaM2: number;
  quantity: number;
}

interface OSGlassCutCardProps {
  glass: GlassCutData;
  index: number;
  totalQuantity: number;
}

export function OSGlassCutCard({ glass, index, totalQuantity }: OSGlassCutCardProps) {
  const totalArea = glass.areaM2 * glass.quantity * totalQuantity;
  const isLandscape = glass.calculatedWidth > glass.calculatedHeight;
  
  // Calculate preview dimensions maintaining aspect ratio
  const maxPreviewSize = 120;
  const aspectRatio = glass.calculatedWidth / glass.calculatedHeight;
  
  let previewWidth: number;
  let previewHeight: number;
  
  if (isLandscape) {
    previewWidth = maxPreviewSize;
    previewHeight = maxPreviewSize / aspectRatio;
  } else {
    previewHeight = maxPreviewSize;
    previewWidth = maxPreviewSize * aspectRatio;
  }
  
  // Ensure minimum sizes
  previewWidth = Math.max(40, Math.min(previewWidth, maxPreviewSize));
  previewHeight = Math.max(40, Math.min(previewHeight, maxPreviewSize));

  // Letter label for the glass panel
  const letterLabel = String.fromCharCode(65 + index);

  return (
    <div className="group relative bg-card border rounded-xl overflow-hidden transition-all hover:shadow-lg hover:border-primary/30">
      {/* Header with glass name */}
      <div className="px-4 py-3 bg-gradient-to-r from-sky-500/10 to-cyan-500/10 dark:from-sky-500/20 dark:to-cyan-500/20 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              {letterLabel}
            </div>
            <h4 className="font-semibold text-sm truncate">{glass.glassName}</h4>
          </div>
          <Badge variant="secondary" className="font-mono">
            {glass.quantity * totalQuantity}x
          </Badge>
        </div>
      </div>

      {/* Main content */}
      <div className="p-4">
        <div className="flex gap-4">
          {/* Glass Preview Visualization */}
          <div className="flex-shrink-0">
            <div 
              className="relative flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-lg p-3"
              style={{ width: maxPreviewSize + 24, height: maxPreviewSize + 24 }}
            >
              {/* Glass panel with realistic effect */}
              <div
                className="relative bg-gradient-to-br from-sky-200/90 via-sky-100/70 to-cyan-50/60 dark:from-sky-400/40 dark:via-sky-300/30 dark:to-cyan-200/20 border-2 border-sky-400/70 dark:border-sky-500/60 rounded shadow-lg"
                style={{
                  width: `${previewWidth}px`,
                  height: `${previewHeight}px`,
                }}
              >
                {/* Reflection effect */}
                <div 
                  className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent rounded"
                  style={{
                    clipPath: 'polygon(0 0, 70% 0, 0 70%)',
                  }}
                />
                {/* Inner frame effect */}
                <div className="absolute inset-1.5 border border-white/40 dark:border-white/20 rounded-sm" />
                
                {/* Dimension labels on the preview */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                  {glass.calculatedWidth}
                </div>
                <div className="absolute -right-6 top-1/2 -translate-y-1/2 rotate-90 text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                  {glass.calculatedHeight}
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-3 min-w-0">
            {/* Main dimensions */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                <Ruler className="w-3.5 h-3.5" />
                <span>Dimensões</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold font-mono text-primary">
                  {glass.calculatedWidth}
                </span>
                <span className="text-muted-foreground">×</span>
                <span className="text-xl font-bold font-mono text-primary">
                  {glass.calculatedHeight}
                </span>
                <span className="text-sm text-muted-foreground">mm</span>
              </div>
            </div>

            {/* Formulas */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/30 rounded-lg px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Largura</div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-mono text-xs px-1.5 py-0">
                    {glass.widthFormula}
                  </Badge>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono text-sm font-medium">{glass.calculatedWidth}</span>
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Altura</div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-mono text-xs px-1.5 py-0">
                    {glass.heightFormula}
                  </Badge>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono text-sm font-medium">{glass.calculatedHeight}</span>
                </div>
              </div>
            </div>

            {/* Area info */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm">
                <Square className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Área unitária:</span>
                <span className="font-medium">{glass.areaM2.toFixed(3)} m²</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Total:</span>
                <span className="font-bold text-primary">{totalArea.toFixed(3)} m²</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
