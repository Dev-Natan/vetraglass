import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Package, TrendingUp, AlertTriangle, Percent, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type PricingResult, formatBRL } from '@/utils/pricingEngine';

const typeLabels: Record<string, string> = {
  profile: 'Perfis de Alumínio',
  glass: 'Vidros',
  accessory: 'Acessórios',
  component: 'Componentes',
  service: 'Serviços',
};

const typeIcons: Record<string, string> = {
  profile: '🔩', glass: '🪟', accessory: '⚙️', component: '🧩', service: '🔧',
};

interface CalculationMemoryProps {
  productName: string;
  result: PricingResult;
  width: number;
  height: number;
  quantity: number;
}

export function CalculationMemory({ productName, result, width, height, quantity }: CalculationMemoryProps) {
  // Group items by type
  const grouped: Record<string, typeof result.items> = {};
  result.items.forEach(item => {
    if (!grouped[item.itemType]) grouped[item.itemType] = [];
    grouped[item.itemType].push(item);
  });

  const hasIndirect = result.indirectCosts.totalIndirect > 0;
  const hasLosses = result.totalLossCost > 0;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Memória de Cálculo
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {productName} — {width} × {height} mm — {quantity} un — {result.areaM2.toFixed(3)} m²
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {/* Items by type */}
        {['profile', 'glass', 'accessory', 'component', 'service'].map(type => {
          const items = grouped[type];
          if (!items?.length) return null;
          const typeCost = items.reduce((s, i) => s + i.totalCost, 0);

          return (
            <div key={type}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold flex items-center gap-1">
                  {typeIcons[type]} {typeLabels[type] || type}
                </span>
                <span className="font-semibold">{formatBRL(typeCost)}</span>
              </div>
              <div className="space-y-1 pl-5">
                {items.map(item => (
                  <div key={item.id} className="flex items-start justify-between py-1 border-b border-dashed border-muted last:border-0">
                    <div className="flex-1">
                      <span className="font-medium">{item.itemName}</span>
                      <p className="text-muted-foreground">{item.displayMeasure}</p>
                      {item.lossPercent > 0 && (
                        <p className="text-amber-600 flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" />
                          +{item.lossPercent}% perda = {formatBRL(item.lossCost)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="font-medium">{formatBRL(item.subtotalCost)}</span>
                      <p className="text-muted-foreground">
                        {item.unitCost > 0 && `${formatBRL(item.unitCost)}/${item.consumoUnit}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <Separator />

        {/* Cost summary */}
        <div className="space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span>Custo direto</span>
            <span>{formatBRL(result.directCost)}</span>
          </div>
          
          {hasLosses && (
            <div className="flex justify-between text-amber-600">
              <span>Perdas/desperdícios</span>
              <span>+ {formatBRL(result.totalLossCost)}</span>
            </div>
          )}

          {hasIndirect && (
            <>
              <Separator className="my-1" />
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider font-sans">Custos Adicionais</div>
              {result.indirectCosts.laborCost > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Mão de obra</span>
                  <span>+ {formatBRL(result.indirectCosts.laborCost)}</span>
                </div>
              )}
              {result.indirectCosts.packagingCost > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Embalagem</span>
                  <span>+ {formatBRL(result.indirectCosts.packagingCost)}</span>
                </div>
              )}
              {result.indirectCosts.installationCost > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Instalação</span>
                  <span>+ {formatBRL(result.indirectCosts.installationCost)}</span>
                </div>
              )}
              {result.indirectCosts.transportCost > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Transporte</span>
                  <span>+ {formatBRL(result.indirectCosts.transportCost)}</span>
                </div>
              )}
              {result.indirectCosts.commissionCost > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Comissão</span>
                  <span>+ {formatBRL(result.indirectCosts.commissionCost)}</span>
                </div>
              )}
              {result.indirectCosts.taxCost > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Impostos</span>
                  <span>+ {formatBRL(result.indirectCosts.taxCost)}</span>
                </div>
              )}
              {result.indirectCosts.adminFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxa administrativa</span>
                  <span>+ {formatBRL(result.indirectCosts.adminFee)}</span>
                </div>
              )}
            </>
          )}

          <Separator className="my-1" />

          <div className="flex justify-between font-semibold">
            <span>Custo total</span>
            <span>{formatBRL(result.totalCost)}</span>
          </div>

          <div className="flex justify-between text-primary">
            <span className="flex items-center gap-1">
              <Percent className="h-3 w-3" />
              Margem ({result.marginType === 'markup' ? 'markup' : 'simples'}) {result.marginPercent}%
            </span>
            <span>+ {formatBRL(result.marginValue)}</span>
          </div>

          <Separator className="my-1" />

          <div className="flex justify-between text-base font-bold text-primary">
            <span className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Preço Final
            </span>
            <span>{formatBRL(result.finalPrice)}</span>
          </div>

          <div className="flex justify-between text-muted-foreground text-[11px]">
            <span>Custo/m²: {formatBRL(result.costPerSqm)}</span>
            <span>Venda/m²: {formatBRL(result.pricePerSqm)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
