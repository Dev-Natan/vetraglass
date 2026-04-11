import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { GlassProjectCanvas } from '@/components/projeto-vidro/GlassProjectCanvas';
import { ProductionTables } from './ProductionTables';
import { type ProfileCutItem } from '@/components/plano-corte/ProfileCutsTable';
import { type GlassCutItem } from '@/components/plano-corte/GlassCutsTable';
import { type GlassPanelData } from '@/pages/Producao';
import { Hole, Cutout } from '@/components/projeto-vidro/HoleCutoutEditor';
import { Layers, Square, Ruler, Scale, CheckCircle2 } from 'lucide-react';

interface UnifiedProductionViewProps {
  profileCuts: ProfileCutItem[];
  glassCuts: GlassCutItem[];
  glassPanels: GlassPanelData[];
  barOptimizationData: Array<{
    itemTemplateId: string;
    itemName: string;
    cutLength: number;
    quantity: number;
    barLengthMm: number;
  }>;
  width: number;
  height: number;
  quantity: number;
  lockHeight: number;
  onLockHeightChange: (value: number) => void;
  panelModifications: Record<string, { holes: Hole[]; cutouts: Cutout[] }>;
  onPanelModificationsChange: (mods: Record<string, { holes: Hole[]; cutouts: Cutout[] }>) => void;
  glassType: string;
  hardwareType: string;
  completedItems: Set<string>;
  onToggleComplete: (id: string, completed: boolean) => void;
  getStorageUrl: (path: string | null) => string | null;
  selectedProduct: string;
}

export function UnifiedProductionView({
  profileCuts,
  glassCuts,
  glassPanels,
  barOptimizationData,
  width,
  height,
  quantity,
  lockHeight,
  onLockHeightChange,
  panelModifications,
  onPanelModificationsChange,
  glassType,
  hardwareType,
  completedItems,
  onToggleComplete,
  getStorageUrl,
  selectedProduct
}: UnifiedProductionViewProps) {
  // Calculate statistics
  const totalProfilePieces = profileCuts.reduce((sum, cut) => sum + cut.quantity, 0);
  const totalGlassPieces = glassCuts.reduce((sum, glass) => sum + glass.quantity, 0);
  const totalGlassArea = glassCuts.reduce((sum, glass) => sum + (glass.areaM2 * glass.quantity), 0);
  const estimatedWeight = totalGlassArea * 25; // ~25kg/m² for 10mm glass

  // Calculate progress
  const totalItems = profileCuts.length + glassCuts.length;
  const completedCount = completedItems.size;
  const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  if (!selectedProduct) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="text-5xl mb-4">🪟</div>
          <p className="text-muted-foreground">
            Selecione um produto para visualizar o plano de produção unificado.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasGlassPanels = glassPanels.length > 0;

  return (
    <div className="space-y-6">
      {/* Statistics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Square className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vidros</p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{totalGlassPieces}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Ruler className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Perfis</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{totalProfilePieces}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Área Total</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{totalGlassArea.toFixed(2)} m²</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Peso Estimado</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{estimatedWeight.toFixed(1)} kg</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {totalItems > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="py-3 px-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm font-medium">Progresso da Produção</span>
                  <span className="text-sm text-muted-foreground">
                    {completedCount} de {totalItems} itens
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-primary min-w-[60px] text-right">
                  {progressPercent}%
                </div>
                {progressPercent === 100 && (
                  <div className="bg-emerald-500 text-white rounded-full p-1 animate-in zoom-in duration-300">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Glass Project Canvas - Only if there are glass panels */}
      {hasGlassPanels && (
        <GlassProjectCanvas 
          panels={glassPanels}
          totalWidth={width}
          totalHeight={height}
          quantity={quantity}
          lockHeight={lockHeight}
          panelModifications={panelModifications}
          onPanelModificationsChange={onPanelModificationsChange}
          glassType={glassType}
          hardwareType={hardwareType}
        />
      )}

      {/* Production Tables */}
      <ProductionTables
        profileCuts={profileCuts}
        glassCuts={glassCuts}
        barOptimizationData={barOptimizationData}
        showCheckboxes
        onToggleComplete={onToggleComplete}
        getStorageUrl={getStorageUrl}
      />
    </div>
  );
}
