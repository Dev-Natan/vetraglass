import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Scissors, Package, TrendingDown } from 'lucide-react';
import { optimizeProfiles, distributeAcrossBars, formatMm, type CutPiece, type MaterialSummary } from '@/utils/profileOptimization';
import { useMemo, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface BarOptimizationViewProps {
  cuts: Array<{
    itemTemplateId: string;
    itemName: string;
    cutLength: number;
    quantity: number;
    barLengthMm?: number;
    unit?: string;
  }>;
}

export function BarOptimizationView({ cuts }: BarOptimizationViewProps) {
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());

  // Convert to CutPiece format with defaults
  const cutPieces: CutPiece[] = useMemo(() => 
    cuts.map(c => ({
      itemTemplateId: c.itemTemplateId,
      itemName: c.itemName,
      cutLength: c.cutLength,
      quantity: c.quantity,
      barLengthMm: c.barLengthMm || 6000,
      unit: c.unit || 'mm',
    })),
    [cuts]
  );

  const summary: MaterialSummary = useMemo(
    () => optimizeProfiles(cutPieces),
    [cutPieces]
  );

  const toggleProfile = (id: string) => {
    setExpandedProfiles(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (summary.profiles.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="w-5 h-5" />
            Resumo de Otimização de Barras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{summary.totalProfileBars}</div>
              <div className="text-xs text-muted-foreground">Barras Totais</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">{formatMm(summary.totalProfileWasteMm)}</div>
              <div className="text-xs text-muted-foreground">Desperdício Total</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${summary.avgWastePercent > 15 ? 'text-red-500' : summary.avgWastePercent > 10 ? 'text-amber-500' : 'text-green-500'}`}>
                {summary.avgWastePercent}%
              </div>
              <div className="text-xs text-muted-foreground">Desperdício Médio</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Profile Breakdown */}
      <div className="space-y-3">
        <h4 className="font-semibold flex items-center gap-2">
          <Scissors className="w-4 h-4" />
          Distribuição por Perfil
        </h4>

        {summary.profiles.map((profile) => {
          const isExpanded = expandedProfiles.has(profile.itemTemplateId);
          const barDistribution = distributeAcrossBars(profile.cuts, profile.barLengthMm);

          return (
            <Collapsible 
              key={profile.itemTemplateId} 
              open={isExpanded}
              onOpenChange={() => toggleProfile(profile.itemTemplateId)}
            >
              <Card className="overflow-hidden">
                <CollapsibleTrigger asChild>
                  <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        <div>
                          <CardTitle className="text-sm">{profile.itemName}</CardTitle>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {profile.cuts.length} medida(s) diferentes · {formatMm(profile.totalLengthMm)} total
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {profile.barsNeeded} barra(s)
                        </Badge>
                        <Badge variant={profile.wastePercent > 15 ? 'destructive' : profile.wastePercent > 10 ? 'secondary' : 'default'}>
                          <TrendingDown className="w-3 h-3 mr-1" />
                          {profile.wastePercent}%
                        </Badge>
                      </div>
                    </div>
                    <Progress 
                      value={100 - profile.wastePercent} 
                      className="h-2 mt-2" 
                    />
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4">
                    {/* Cut summary */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {profile.cuts.map((cut, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {formatMm(cut.length)} × {cut.qty}
                        </Badge>
                      ))}
                    </div>

                    {/* Bar visualization */}
                    <div className="space-y-2">
                      {barDistribution.map((bar) => (
                        <div key={bar.barIndex} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-16">
                            Barra {bar.barIndex}
                          </span>
                          <div className="flex-1 h-8 bg-muted rounded-md relative overflow-hidden flex">
                            {bar.cuts.map((cut, idx) => {
                              const widthPercent = (cut.length / profile.barLengthMm) * 100;
                              // Repeat for each piece
                              return Array(cut.qty).fill(0).map((_, pieceIdx) => (
                                <div
                                  key={`${idx}-${pieceIdx}`}
                                  className="h-full bg-primary/80 border-r border-background flex items-center justify-center text-[9px] text-primary-foreground font-medium"
                                  style={{ width: `${widthPercent}%` }}
                                  title={`${formatMm(cut.length)}`}
                                >
                                  {widthPercent > 8 && formatMm(cut.length)}
                                </div>
                              ));
                            })}
                            {/* Remaining space as waste */}
                            {bar.remainingLength > 0 && (
                              <div 
                                className="h-full bg-red-200 dark:bg-red-900/30 flex items-center justify-center text-[9px] text-red-600 dark:text-red-400"
                                style={{ width: `${(bar.remainingLength / profile.barLengthMm) * 100}%` }}
                              >
                                {bar.remainingLength > profile.barLengthMm * 0.08 && `${formatMm(bar.remainingLength)}`}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground w-20 text-right">
                            {Math.round((bar.usedLength / profile.barLengthMm) * 100)}% usado
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
